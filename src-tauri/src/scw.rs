pub(crate) use crate::rpc::validate_params;
use crate::{
    profiles::{Profile, Profiles},
    rpc::uuid,
};
use base64::{Engine, engine::general_purpose::STANDARD};
use futures_util::{StreamExt, stream};
use reqwest::{Client, Method};
use serde::Serialize;
use serde_json::{Map, Value, json};
use std::{collections::VecDeque, sync::Mutex, time::Instant};

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct HttpLog {
    id: u64,
    method: String,
    url: String,
    status: u16,
    duration_ms: u128,
    timestamp: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    error: Option<String>,
}

#[derive(Default)]
struct Logs {
    next_id: u64,
    entries: VecDeque<HttpLog>,
}

pub(crate) struct Backend {
    client: Client,
    profiles: Profiles,
    api_base: String,
    logs: Mutex<Logs>,
}

pub(crate) fn by_name(a: &str, b: &str) -> std::cmp::Ordering {
    a.to_lowercase()
        .cmp(&b.to_lowercase())
        .then_with(|| a.cmp(b))
}

fn text<'a>(value: &'a Value, key: &str) -> &'a str {
    value.get(key).and_then(Value::as_str).unwrap_or_default()
}

fn secret_path(id: &str, suffix: &str) -> Result<String, String> {
    if !uuid(id) {
        return Err("request failed".into());
    }
    Ok(format!(
        "/secret-manager/v1beta1/regions/fr-par/secrets/{id}{suffix}"
    ))
}

fn access_key(value: &str) -> bool {
    !value.is_empty() && value.len() <= 64 && value.bytes().all(|b| b.is_ascii_alphanumeric())
}

// Scaleway encodes durations as decimal seconds, e.g. "2592000.000000000s".
fn duration_seconds(value: &Value) -> Option<u64> {
    let (whole, fraction) = value.as_str()?.strip_suffix('s')?.split_once('.')?;
    if !fraction.bytes().all(|b| b.is_ascii_digit()) {
        return None;
    }
    whole.parse().ok()
}

fn validation_error(status: u16, body: &Value) -> Option<String> {
    if status != 400 || body.get("type").and_then(Value::as_str) != Some("invalid_arguments") {
        return None;
    }
    let mut lines = Vec::new();
    for detail in body.get("details")?.as_array()? {
        if let Some(help) = detail.get("help_message").and_then(Value::as_str) {
            for line in help.split('\n') {
                let sanitized: String = line
                    .chars()
                    .map(|c| if c.is_ascii_control() { ' ' } else { c })
                    .collect();
                let line = sanitized
                    .trim()
                    .strip_prefix('-')
                    .unwrap_or(sanitized.trim())
                    .trim();
                if !line.is_empty() {
                    lines.push(line.to_owned());
                }
            }
        }
    }
    if lines.is_empty() {
        return None;
    }
    let message = format!("invalid value: {}", lines.join("; "));
    Some(if message.chars().count() > 300 {
        format!("{}…", message.chars().take(299).collect::<String>())
    } else {
        message
    })
}

impl Backend {
    pub(crate) fn new() -> Result<Self, String> {
        let client = Client::builder()
            .redirect(reqwest::redirect::Policy::none())
            .build()
            .map_err(|_| "request failed")?;
        Ok(Self {
            client,
            profiles: Profiles::new(),
            api_base: "https://api.scaleway.com".into(),
            logs: Mutex::default(),
        })
    }

    fn record(
        &self,
        method: &Method,
        url: String,
        status: u16,
        start: Instant,
        error: Option<String>,
    ) {
        let mut logs = self
            .logs
            .lock()
            .unwrap_or_else(std::sync::PoisonError::into_inner);
        logs.next_id += 1;
        let id = logs.next_id;
        logs.entries.push_front(HttpLog {
            id,
            method: method.to_string(),
            url,
            status,
            duration_ms: start.elapsed().as_millis(),
            timestamp: chrono::Utc::now().to_rfc3339_opts(chrono::SecondsFormat::Millis, true),
            error,
        });
        logs.entries.truncate(500);
    }

    async fn request(
        &self,
        method: Method,
        path: &str,
        profile: &Profile,
        params: &[(&str, &str)],
        body: Option<Value>,
    ) -> Result<Value, String> {
        let mut url = reqwest::Url::parse(&format!("{}{path}", self.api_base))
            .map_err(|_| "request failed")?;
        {
            let mut query = url.query_pairs_mut();
            for (key, value) in params {
                if !value.is_empty() {
                    query.append_pair(key, value);
                }
            }
        }
        let mut request = self
            .client
            .request(method.clone(), url.clone())
            .header("X-Auth-Token", &profile.secret_key);
        if let Some(body) = body {
            request = request.json(&body);
        }
        let start = Instant::now();
        let Ok(response) = request.send().await else {
            self.record(
                &method,
                url.to_string(),
                0,
                start,
                Some("request failed".into()),
            );
            return Err("request failed".into());
        };
        let status = response.status();
        let result = if status.is_success() && method == Method::DELETE {
            Ok(Value::Null)
        } else {
            match response.json::<Value>().await {
                Ok(body) if status.is_success() => Ok(body),
                Ok(body) => Err(validation_error(status.as_u16(), &body)
                    .unwrap_or_else(|| "request failed".into())),
                Err(_) => Err("request failed".into()),
            }
        };
        self.record(
            &method,
            url.to_string(),
            status.as_u16(),
            start,
            result.as_ref().err().cloned(),
        );
        result
    }

    async fn pages(
        &self,
        path: &str,
        profile: &Profile,
        params: &[(&str, &str)],
        field: &str,
    ) -> Result<Vec<Value>, String> {
        let mut items = Vec::new();
        let mut page = 1_u64;
        loop {
            let page_number = page.to_string();
            let mut query = params.to_vec();
            query.extend([("page", page_number.as_str()), ("page_size", "100")]);
            let data = self
                .request(Method::GET, path, profile, &query, None)
                .await?;
            let total = data
                .get("total_count")
                .and_then(Value::as_u64)
                .ok_or("request failed")?;
            let batch = match data.get(field) {
                Some(value) => value.as_array().ok_or("request failed")?.clone(),
                None => Vec::new(),
            };
            let empty = batch.is_empty();
            items.extend(batch);
            if empty || items.len() as u64 >= total {
                break;
            }
            page += 1;
        }
        Ok(items)
    }

    async fn versions(
        &self,
        id: &str,
        profile: &Profile,
        project: &str,
    ) -> Result<Vec<Value>, String> {
        let mut versions = self
            .pages(
                &secret_path(id, "/versions")?,
                profile,
                &[("project_id", project)],
                "versions",
            )
            .await?;
        versions.sort_by_key(|version| {
            std::cmp::Reverse(
                version
                    .get("revision")
                    .and_then(Value::as_u64)
                    .unwrap_or_default(),
            )
        });
        Ok(versions)
    }

    async fn value(
        &self,
        id: &str,
        revision: &str,
        profile: &Profile,
        project: &str,
    ) -> Result<String, String> {
        let data = self
            .request(
                Method::GET,
                &secret_path(id, &format!("/versions/{revision}/access"))?,
                profile,
                &[("project_id", project)],
                None,
            )
            .await?;
        let encoded = data
            .get("data")
            .and_then(Value::as_str)
            .ok_or("request failed")?;
        let decoded = STANDARD.decode(encoded).map_err(|_| "request failed")?;
        Ok(String::from_utf8_lossy(&decoded).into_owned())
    }

    async fn create_version(
        &self,
        id: &str,
        value: &str,
        profile: &Profile,
        project: &str,
    ) -> Result<(), String> {
        self.request(
            Method::POST,
            &secret_path(id, "/versions")?,
            profile,
            &[("project_id", project)],
            Some(json!({"data": STANDARD.encode(value)})),
        )
        .await?;
        Ok(())
    }

    pub(crate) async fn call(&self, method: &str, params: Value) -> Result<Value, String> {
        validate_params(method, &params)?;
        match method {
            "getProfiles" => return self.profiles.summaries().await,
            "switchProfile" => return self.profiles.switch(text(&params, "profile")).await,
            "getHttpLogs" => {
                let logs = self
                    .logs
                    .lock()
                    .unwrap_or_else(std::sync::PoisonError::into_inner);
                return serde_json::to_value(&logs.entries).map_err(|_| "request failed".into());
            }
            "clearHttpLogs" => {
                self.logs
                    .lock()
                    .unwrap_or_else(std::sync::PoisonError::into_inner)
                    .entries
                    .clear();
                return Ok(json!({"ok": true}));
            }
            _ => {}
        }
        let profile = match self
            .profiles
            .load(params.get("profile").and_then(Value::as_str))
            .await
        {
            Ok(profile) => profile,
            Err(_) if matches!(method, "getActiveVersionCounts" | "prefetchSecretValues") => {
                return Ok(if method == "getActiveVersionCounts" {
                    json!({"counts": {}, "failed": params["secretIds"]})
                } else {
                    json!({"values": {}, "failed": params["secretIds"]})
                });
            }
            Err(error) => return Err(error),
        };
        let project = params
            .get("projectId")
            .and_then(Value::as_str)
            .unwrap_or(&profile.project_id);
        let id = text(&params, "secretId");
        match method {
            "getProjects" => {
                let mut projects = self
                    .pages(
                        "/account/v3/projects",
                        &profile,
                        &[("organization_id", &profile.organization_id)],
                        "projects",
                    )
                    .await?;
                projects.sort_by(|a, b| by_name(text(a, "name"), text(b, "name")));
                Ok(json!(projects))
            }
            "getApiKeyInfo" => {
                let key = async {
                    if !access_key(&profile.access_key) {
                        return None;
                    }
                    let path = format!("/iam/v1alpha1/api-keys/{}", profile.access_key);
                    let data = self
                        .request(Method::GET, &path, &profile, &[], None)
                        .await
                        .ok()?;
                    match data.get("expires_at") {
                        None | Some(Value::Null) => Some(None),
                        Some(value) => chrono::DateTime::parse_from_rfc3339(value.as_str()?)
                            .ok()
                            .map(|date| {
                                Some(
                                    date.with_timezone(&chrono::Utc)
                                        .to_rfc3339_opts(chrono::SecondsFormat::Secs, true),
                                )
                            }),
                    }
                };
                let max_lifetime = async {
                    if !uuid(&profile.organization_id) {
                        return None;
                    }
                    let path = format!(
                        "/iam/v1alpha1/organizations/{}/security-settings",
                        profile.organization_id
                    );
                    let data = self
                        .request(Method::GET, &path, &profile, &[], None)
                        .await
                        .ok()?;
                    duration_seconds(data.get("max_api_key_expiration_duration")?)
                };
                let (key, max_lifetime) = tokio::join!(key, max_lifetime);
                Ok(json!({
                    "key": key.map(|expires_at| json!({"expiresAt": expires_at})),
                    "maxKeyLifetimeSeconds": max_lifetime,
                }))
            }
            "getSecrets" => {
                let mut secrets = self
                    .pages(
                        "/secret-manager/v1beta1/regions/fr-par/secrets",
                        &profile,
                        &[("project_id", project)],
                        "secrets",
                    )
                    .await?;
                let query = text(&params, "query").trim().to_lowercase();
                let path = text(&params, "path");
                let status = text(&params, "status");
                secrets.retain(|secret| {
                    (query.is_empty()
                        || format!("{} {}", text(secret, "name"), text(secret, "path"))
                            .to_lowercase()
                            .contains(&query))
                        && (path.is_empty() || path == "all" || text(secret, "path") == path)
                        && match status {
                            "ready" => text(secret, "status") == "ready",
                            "disabled" => text(secret, "status") != "ready",
                            _ => true,
                        }
                });
                secrets.sort_by(|a, b| {
                    by_name(text(a, "path"), text(b, "path"))
                        .then_with(|| by_name(text(a, "name"), text(b, "name")))
                });
                Ok(json!(secrets))
            }
            "getSecretVersions" => Ok(json!(self.versions(id, &profile, project).await?)),
            "getSecretValue" => Ok(
                json!({"value": self.value(id, text(&params, "revision"), &profile, project).await?}),
            ),
            "getActiveVersionCounts" | "prefetchSecretValues" => {
                let ids: Vec<String> = params["secretIds"]
                    .as_array()
                    .ok_or("invalid parameters")?
                    .iter()
                    .map(|id| id.as_str().map(str::to_owned).ok_or("invalid parameters"))
                    .collect::<Result<_, _>>()?;
                let profile = &profile;
                let mut outcomes = stream::iter(ids.into_iter().map(|id| async move {
                    let result = if method == "getActiveVersionCounts" {
                        self.versions(&id, profile, project).await.map(|versions| {
                            json!(
                                versions
                                    .iter()
                                    .filter(|v| !matches!(
                                        text(v, "status"),
                                        "scheduled_for_deletion" | "destroyed"
                                    ))
                                    .count()
                            )
                        })
                    } else {
                        self.value(&id, "latest_enabled", profile, project)
                            .await
                            .map(|value| {
                                let mut units = 0;
                                json!(
                                    value
                                        .chars()
                                        .take_while(|c| {
                                            units += c.len_utf16();
                                            units <= 64 * 1024
                                        })
                                        .collect::<String>()
                                )
                            })
                    };
                    (id, result)
                }))
                .buffer_unordered(8);
                let mut values = Map::new();
                let mut failed = Vec::new();
                while let Some(outcome) = outcomes.next().await {
                    let (id, result) = outcome;
                    match result {
                        Ok(value) => {
                            values.insert(id, value);
                        }
                        Err(_) => failed.push(id),
                    }
                }
                Ok(if method == "getActiveVersionCounts" {
                    json!({"counts": values, "failed": failed})
                } else {
                    json!({"values": values, "failed": failed})
                })
            }
            "createSecret" | "duplicateSecret" => {
                let value = if method == "duplicateSecret" {
                    self.value(id, "latest_enabled", &profile, project).await?
                } else {
                    text(&params, "value").to_owned()
                };
                let mut body = json!({"name": params["name"], "project_id": project});
                let path = text(&params, "path");
                let kind = text(&params, "type");
                if !path.is_empty() && path != "/" {
                    body["path"] = json!(path);
                }
                if !kind.is_empty() && kind != "opaque" {
                    body["type"] = json!(kind);
                }
                if let Some(tags) = params
                    .get("tags")
                    .filter(|tags| tags.as_array().is_some_and(|tags| !tags.is_empty()))
                {
                    body["tags"] = tags.clone();
                }
                let secret = self
                    .request(
                        Method::POST,
                        "/secret-manager/v1beta1/regions/fr-par/secrets",
                        &profile,
                        &[],
                        Some(body),
                    )
                    .await?;
                let created_id = secret
                    .get("id")
                    .and_then(Value::as_str)
                    .ok_or("request failed")?;
                self.create_version(created_id, &value, &profile, project)
                    .await?;
                Ok(json!({"secretId": created_id}))
            }
            "updateSecretValue" => {
                self.create_version(id, text(&params, "value"), &profile, project)
                    .await?;
                Ok(json!({"ok": true}))
            }
            "updateSecret" => {
                let mut updates = Map::new();
                for field in ["name", "tags"] {
                    if let Some(value) = params.get(field) {
                        updates.insert(field.to_owned(), value.clone());
                    }
                }
                self.request(
                    Method::PATCH,
                    &secret_path(id, "")?,
                    &profile,
                    &[("project_id", project)],
                    Some(Value::Object(updates)),
                )
                .await?;
                Ok(json!({"ok": true}))
            }
            "enableSecretVersion"
            | "disableSecretVersion"
            | "destroySecretVersion"
            | "deleteSecret" => {
                let suffix = if method == "deleteSecret" {
                    String::new()
                } else {
                    let revision = params["revision"].as_f64().ok_or("invalid parameters")?;
                    let action = match method {
                        "enableSecretVersion" => "/enable",
                        "disableSecretVersion" => "/disable",
                        _ => "",
                    };
                    format!("/versions/{revision:.0}{action}")
                };
                let destructive = matches!(method, "destroySecretVersion" | "deleteSecret");
                self.request(
                    if destructive {
                        Method::DELETE
                    } else {
                        Method::POST
                    },
                    &secret_path(id, &suffix)?,
                    &profile,
                    &[("project_id", project)],
                    if destructive { None } else { Some(json!({})) },
                )
                .await?;
                Ok(json!({"ok": true}))
            }
            _ => Err("not found".into()),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn names_sort_case_insensitively() {
        let mut names = vec!["Zeta", "alpha", "Alpha", "beta"];
        names.sort_by(|a, b| by_name(a, b));
        assert_eq!(names, ["Alpha", "alpha", "beta", "Zeta"]);
    }
    use tokio::{
        io::{AsyncReadExt, AsyncWriteExt},
        net::TcpListener,
    };

    const ID: &str = "12345678-1234-1234-1234-123456789abc";
    const PROJECT: &str = "aaaaaaaa-1234-1234-1234-123456789abc";

    async fn read_request(socket: &mut tokio::net::TcpStream) -> String {
        let mut bytes = Vec::new();
        let mut chunk = [0; 4096];
        loop {
            let count = socket.read(&mut chunk).await.unwrap();
            assert!(count > 0, "request ended early");
            bytes.extend_from_slice(&chunk[..count]);
            if let Some(end) = bytes.windows(4).position(|s| s == b"\r\n\r\n") {
                let headers = String::from_utf8_lossy(&bytes[..end]);
                let length = headers
                    .lines()
                    .find_map(|line| {
                        let (name, value) = line.split_once(':')?;
                        name.eq_ignore_ascii_case("content-length")
                            .then(|| value.trim().parse::<usize>().unwrap())
                    })
                    .unwrap_or_default();
                if bytes.len() >= end + 4 + length {
                    break;
                }
            }
        }
        String::from_utf8(bytes).unwrap()
    }

    async fn mock(responses: Vec<(u16, Value)>) -> (Backend, tokio::task::JoinHandle<Vec<String>>) {
        mock_raw(
            responses
                .into_iter()
                .map(|(status, body)| (status, body.to_string()))
                .collect(),
        )
        .await
    }

    async fn mock_raw(
        responses: Vec<(u16, String)>,
    ) -> (Backend, tokio::task::JoinHandle<Vec<String>>) {
        let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
        let address = listener.local_addr().unwrap();
        let handle = tokio::spawn(async move {
            let mut requests = Vec::new();
            for (status, body) in responses {
                let (mut socket, _) = listener.accept().await.unwrap();
                requests.push(read_request(&mut socket).await);
                let body = if status == 204 { String::new() } else { body };
                socket.write_all(format!("HTTP/1.1 {status} Test\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{body}", body.len()).as_bytes()).await.unwrap();
            }
            requests
        });
        let mut backend = Backend::new().unwrap();
        backend.api_base = format!("http://{address}");
        backend.profiles = Profiles::at(
            std::env::temp_dir().join("scw-missing-test-config"),
            Some(Profile {
                access_key: "test-access".into(),
                secret_key: "private-token".into(),
                project_id: "default-project".into(),
                organization_id: "organization".into(),
            }),
        );
        (backend, handle)
    }

    fn body(request: &str) -> Value {
        serde_json::from_str(request.split_once("\r\n\r\n").unwrap().1).unwrap()
    }

    #[tokio::test]
    async fn lists_all_pages_and_preserves_filters_and_project_scope() {
        let (backend, server) = mock(vec![
            (200, json!({"total_count": 3, "secrets": [
                {"id": ID, "name": "Zoo", "path": "/team", "status": "ready"},
                {"name": "Hidden", "path": "/team", "status": "disabled"}
            ]})),
            (200, json!({"total_count": 3, "secrets": [{"name": "Alpha", "path": "/team", "status": "ready"}]})),
        ]).await;
        let secrets = backend.call("getSecrets", json!({"projectId": PROJECT, "query": "  TEAM ", "path": "/team", "status": "ready"})).await.unwrap();
        assert_eq!(
            secrets
                .as_array()
                .unwrap()
                .iter()
                .map(|s| text(s, "name"))
                .collect::<Vec<_>>(),
            ["Alpha", "Zoo"]
        );
        let requests = server.await.unwrap();
        assert!(requests[0].starts_with(&format!("GET /secret-manager/v1beta1/regions/fr-par/secrets?project_id={PROJECT}&page=1&page_size=100 ")));
        assert!(requests[1].contains("page=2&page_size=100"));
        assert!(
            requests
                .iter()
                .all(|r| r.to_lowercase().contains("x-auth-token: private-token"))
        );
    }

    #[tokio::test]
    async fn mutation_contract_creates_immutable_versions_and_scopes_every_request() {
        let (backend, server) = mock(vec![
            (200, json!({"id": ID})),
            (200, json!({"revision": 1})),
            (200, json!({})),
            (200, json!({})),
            (200, json!({})),
            (204, Value::Null),
            (204, Value::Null),
        ])
        .await;
        assert_eq!(backend.call("createSecret", json!({"name": "New", "value": "hello 🌍", "projectId": PROJECT, "path": "/", "type": "opaque", "tags": []})).await.unwrap(), json!({"secretId": ID}));
        backend
            .call(
                "updateSecret",
                json!({"secretId": ID, "tags": [], "projectId": PROJECT}),
            )
            .await
            .unwrap();
        for (method, revision) in [
            ("enableSecretVersion", json!(2)),
            ("disableSecretVersion", json!(2.0)),
            ("destroySecretVersion", json!(2)),
        ] {
            backend
                .call(
                    method,
                    json!({"secretId": ID, "revision": revision, "projectId": PROJECT}),
                )
                .await
                .unwrap();
        }
        backend
            .call(
                "deleteSecret",
                json!({"secretId": ID, "projectId": PROJECT}),
            )
            .await
            .unwrap();
        let requests = server.await.unwrap();
        assert_eq!(
            body(&requests[0]),
            json!({"name": "New", "project_id": PROJECT})
        );
        assert_eq!(
            body(&requests[1]),
            json!({"data": STANDARD.encode("hello 🌍")})
        );
        assert_eq!(body(&requests[2]), json!({"tags": []}));
        for request in &requests[1..] {
            assert!(
                request
                    .lines()
                    .next()
                    .unwrap()
                    .contains(&format!("project_id={PROJECT}"))
            );
        }
        assert!(requests[3].starts_with(&format!(
            "POST /secret-manager/v1beta1/regions/fr-par/secrets/{ID}/versions/2/enable?"
        )));
        assert!(requests[4].contains("/versions/2/disable?"));
        assert!(requests[5].starts_with("DELETE "));
        assert!(requests[6].starts_with("DELETE "));
        let logs = backend
            .call("getHttpLogs", json!({}))
            .await
            .unwrap()
            .to_string();
        assert!(!logs.contains("hello") && !logs.contains("private-token"));
    }

    #[tokio::test]
    async fn errors_and_logs_do_not_publish_upstream_details() {
        let (backend, server) = mock(vec![
            (403, json!({"message": "private-token secret-value"})),
            (400, json!({"type": "invalid_arguments", "details": [{"help_message": "- N: wrong type\n- B\u{001b}: wrong"}]})),
        ]).await;
        let params = json!({"secretId": ID, "value": "secret-value"});
        assert_eq!(
            backend
                .call("updateSecretValue", params.clone())
                .await
                .unwrap_err(),
            "request failed"
        );
        assert_eq!(
            backend.call("updateSecretValue", params).await.unwrap_err(),
            "invalid value: N: wrong type; B : wrong"
        );
        server.await.unwrap();
        let logs = backend.call("getHttpLogs", json!({})).await.unwrap();
        assert_eq!(logs[0]["status"], 400);
        assert!(
            !logs.to_string().contains("private-token")
                && !logs.to_string().contains("secret-value")
        );
        backend.call("clearHttpLogs", json!({})).await.unwrap();
        assert_eq!(
            backend.call("getHttpLogs", json!({})).await.unwrap(),
            json!([])
        );
    }

    #[tokio::test]
    async fn unrecognized_upstream_errors_keep_responses_and_logs_private() {
        let responses = vec![
            (502, "<html>private-token secret-value</html>".into()),
            (400, json!({"type": "other_error", "message": "private-token", "details": [{"help_message": "secret-value"}]}).to_string()),
            (400, json!({"type": "invalid_arguments", "message": "private-token", "details": [{"message": "secret-value"}]}).to_string()),
        ];
        let statuses: Vec<_> = responses.iter().map(|(status, _)| *status).collect();
        let (backend, server) = mock_raw(responses).await;
        for status in &statuses {
            assert_eq!(
                backend
                    .call(
                        "updateSecretValue",
                        json!({"secretId": ID, "value": "secret-value"})
                    )
                    .await
                    .unwrap_err(),
                "request failed",
                "upstream HTTP {status}"
            );
        }
        assert_eq!(server.await.unwrap().len(), statuses.len());
        let logs = backend.call("getHttpLogs", json!({})).await.unwrap();
        assert_eq!(logs.as_array().unwrap().len(), statuses.len());
        for (log, status) in logs.as_array().unwrap().iter().zip(statuses.iter().rev()) {
            assert_eq!(log["status"], *status);
            assert_eq!(log["error"], "request failed");
        }
        let serialized = logs.to_string();
        assert!(!serialized.contains("private-token") && !serialized.contains("secret-value"));
    }

    #[tokio::test]
    async fn authenticated_requests_never_follow_redirects() {
        let target = TcpListener::bind("127.0.0.1:0").await.unwrap();
        let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
        let mut backend = Backend::new().unwrap();
        backend.api_base = format!("http://{}", listener.local_addr().unwrap());
        backend.profiles = Profiles::at(
            std::env::temp_dir().join("scw-missing-test-config"),
            Some(Profile {
                secret_key: "private-token".into(),
                project_id: PROJECT.into(),
                ..Profile::default()
            }),
        );
        let location = format!("http://{}/capture", target.local_addr().unwrap());
        let server = tokio::spawn(async move {
            let (mut socket, _) = listener.accept().await.unwrap();
            read_request(&mut socket).await;
            socket.write_all(format!("HTTP/1.1 302 Found\r\nLocation: {location}\r\nContent-Length: 2\r\nConnection: close\r\n\r\n{{}}" ).as_bytes()).await.unwrap();
        });
        assert_eq!(
            backend
                .call("deleteSecret", json!({"secretId": ID}))
                .await
                .unwrap_err(),
            "request failed"
        );
        server.await.unwrap();
        assert!(
            tokio::time::timeout(std::time::Duration::from_millis(30), target.accept())
                .await
                .is_err()
        );
    }

    #[tokio::test]
    async fn rejects_path_injection_before_network_and_limits_public_validation_help() {
        let (backend, server) = mock(Vec::new()).await;
        for input in [
            "../other",
            ".",
            "..",
            "%2e%2e",
            "id?x=y",
            "id#x",
            "id\\other",
            "id\n",
            "",
            "not-a-uuid",
            "0",
            "-1",
        ] {
            for method in [
                "getSecretVersions",
                "getSecretValue",
                "updateSecretValue",
                "updateSecret",
                "enableSecretVersion",
                "disableSecretVersion",
                "destroySecretVersion",
                "deleteSecret",
            ] {
                let mut params = json!({"secretId": input});
                if method == "getSecretValue" {
                    params["revision"] = json!("latest_enabled");
                }
                if method == "updateSecretValue" {
                    params["value"] = json!("value");
                }
                if method.ends_with("SecretVersion") {
                    params["revision"] = json!(1);
                }
                assert_eq!(
                    backend.call(method, params).await.unwrap_err(),
                    "invalid parameters"
                );
            }
        }
        assert_eq!(
            backend.call("getHttpLogs", json!({})).await.unwrap(),
            json!([])
        );
        assert_eq!(server.await.unwrap(), Vec::<String>::new());
        let message = validation_error(
            400,
            &json!({"type": "invalid_arguments", "details": [{"help_message": "x".repeat(1000)}]}),
        )
        .unwrap();
        assert_eq!(message.chars().count(), 300);
        assert!(message.ends_with('…'));
        assert!(
            validation_error(
                403,
                &json!({"type": "invalid_arguments", "details": [{"help_message": "no"}]})
            )
            .is_none()
        );
    }

    #[tokio::test]
    async fn active_counts_ignore_deleted_revisions_and_stop_on_empty_pages() {
        let (backend, server) = mock(vec![
            (200, json!({"total_count": 99, "versions": [{"revision": 4, "status": "disabled"}, {"revision": 3, "status": "enabled"}, {"revision": 2, "status": "scheduled_for_deletion"}, {"revision": 1, "status": "destroyed"}]})),
            (200, json!({"total_count": 99, "versions": []})),
        ]).await;
        assert_eq!(
            backend
                .call(
                    "getActiveVersionCounts",
                    json!({"secretIds": [ID], "projectId": PROJECT})
                )
                .await
                .unwrap(),
            json!({"counts": {ID: 2}, "failed": []})
        );
        assert_eq!(server.await.unwrap().len(), 2);
    }

    #[tokio::test]
    async fn prefetch_bounds_concurrency_truncates_values_and_reports_individual_failures() {
        use std::sync::{
            Arc,
            atomic::{AtomicUsize, Ordering},
        };

        let ids: Vec<String> = (0..16)
            .map(|i| format!("{i:08x}-1234-1234-1234-123456789abc"))
            .collect();
        let first = ids[0].clone();
        let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
        let address = listener.local_addr().unwrap();
        let active = Arc::new(AtomicUsize::new(0));
        let maximum = Arc::new(AtomicUsize::new(0));
        let server_maximum = maximum.clone();
        let server = tokio::spawn(async move {
            let mut replies = Vec::new();
            for _ in 0..16 {
                let (mut socket, _) = listener.accept().await.unwrap();
                let active = active.clone();
                let maximum = server_maximum.clone();
                let first = first.clone();
                replies.push(tokio::spawn(async move {
                    let request = read_request(&mut socket).await;
                    assert!(request.contains("/versions/latest_enabled/access?project_id="));
                    let running = active.fetch_add(1, Ordering::SeqCst) + 1;
                    maximum.fetch_max(running, Ordering::SeqCst);
                    tokio::time::sleep(std::time::Duration::from_millis(10)).await;
                    let failed = request.contains(&first);
                    let body = if failed { json!({"message": "private-upstream-detail"}) } else { json!({"data": STANDARD.encode(format!("{}🌍suffix", "a".repeat(65_535)))}) }.to_string();
                    socket.write_all(format!("HTTP/1.1 {} Test\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{body}", if failed { 403 } else { 200 }, body.len()).as_bytes()).await.unwrap();
                    active.fetch_sub(1, Ordering::SeqCst);
                }));
            }
            for reply in replies {
                reply.await.unwrap();
            }
        });
        let (mut backend, empty_server) = mock(Vec::new()).await;
        empty_server.await.unwrap();
        backend.api_base = format!("http://{address}");
        let result = backend
            .call(
                "prefetchSecretValues",
                json!({"secretIds": ids, "projectId": PROJECT}),
            )
            .await
            .unwrap();
        server.await.unwrap();
        assert_eq!(result["failed"], json!([ids[0]]));
        assert_eq!(result["values"].as_object().unwrap().len(), 15);
        assert_eq!(result["values"][&ids[1]].as_str().unwrap().len(), 65_535);
        assert!((2..=8).contains(&maximum.load(Ordering::SeqCst)));
    }

    #[tokio::test]
    async fn api_key_info_reads_key_expiry_and_org_cap_and_hides_what_it_cannot_read() {
        const ORG: &str = "bbbbbbbb-1234-1234-1234-123456789abc";
        let key = "/iam/v1alpha1/api-keys/SCWTESTKEY";
        let settings = format!("/iam/v1alpha1/organizations/{ORG}/security-settings");
        let denied = json!({"type": "permissions_denied", "message": "private-token"});
        for (access_key, organization_id, routes, expected) in [
            (
                "SCWTESTKEY",
                ORG,
                vec![
                    (key, 200, json!({"expires_at": "2026-12-29T19:18:53.127Z"})),
                    (
                        settings.as_str(),
                        200,
                        json!({"max_api_key_expiration_duration": "7776000.000000000s"}),
                    ),
                ],
                json!({"key": {"expiresAt": "2026-12-29T19:18:53Z"}, "maxKeyLifetimeSeconds": 7_776_000}),
            ),
            (
                "SCWTESTKEY",
                ORG,
                vec![
                    (key, 200, json!({"expires_at": null})),
                    (
                        settings.as_str(),
                        200,
                        json!({"max_api_key_expiration_duration": "0.000000000s"}),
                    ),
                ],
                json!({"key": {"expiresAt": null}, "maxKeyLifetimeSeconds": 0}),
            ),
            (
                "SCWTESTKEY",
                ORG,
                vec![
                    (key, 403, denied.clone()),
                    (settings.as_str(), 403, denied.clone()),
                ],
                json!({"key": null, "maxKeyLifetimeSeconds": null}),
            ),
            (
                "SCWTESTKEY",
                ORG,
                vec![
                    (key, 200, json!({"expires_at": "soon"})),
                    (
                        settings.as_str(),
                        200,
                        json!({"max_api_key_expiration_duration": "-1s"}),
                    ),
                ],
                json!({"key": null, "maxKeyLifetimeSeconds": null}),
            ),
            (
                "../secret-manager",
                "../../other",
                vec![],
                json!({"key": null, "maxKeyLifetimeSeconds": null}),
            ),
        ] {
            let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
            let address = listener.local_addr().unwrap();
            let routes: Vec<(String, u16, String)> = routes
                .into_iter()
                .map(|(path, status, body)| (path.to_owned(), status, body.to_string()))
                .collect();
            let count = routes.len();
            let server = tokio::spawn(async move {
                let mut requests = Vec::new();
                for _ in 0..count {
                    let (mut socket, _) = listener.accept().await.unwrap();
                    let request = read_request(&mut socket).await;
                    let (_, status, body) = routes
                        .iter()
                        .find(|(path, _, _)| request.starts_with(&format!("GET {path}? ")))
                        .unwrap_or_else(|| panic!("unexpected request: {request}"));
                    socket.write_all(format!("HTTP/1.1 {status} Test\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{body}", body.len()).as_bytes()).await.unwrap();
                    requests.push(request);
                }
                requests
            });
            let mut backend = Backend::new().unwrap();
            backend.api_base = format!("http://{address}");
            backend.profiles = Profiles::at(
                std::env::temp_dir().join("scw-missing-test-config"),
                Some(Profile {
                    access_key: access_key.into(),
                    secret_key: "private-token".into(),
                    project_id: "default-project".into(),
                    organization_id: organization_id.into(),
                }),
            );
            let info = backend.call("getApiKeyInfo", json!({})).await.unwrap();
            assert_eq!(info, expected, "{access_key}");
            assert!(!info.to_string().contains("private-token"));
            assert_eq!(server.await.unwrap().len(), count);
        }
    }
}
