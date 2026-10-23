use serde_json::Value;

pub(crate) fn uuid(value: &str) -> bool {
    value.len() == 36
        && value.bytes().enumerate().all(|(index, byte)| {
            if [8, 13, 18, 23].contains(&index) {
                byte == b'-'
            } else {
                byte.is_ascii_hexdigit()
            }
        })
}

fn revision(value: &str) -> bool {
    matches!(value, "latest" | "latest_enabled")
        || (value.starts_with(|c: char| c.is_ascii_digit() && c != '0')
            && value.bytes().all(|c| c.is_ascii_digit()))
}

pub(crate) fn validate_params(method: &str, params: &Value) -> Result<(), String> {
    let fields: &[&str] = match method {
        "getProfiles" | "getHttpLogs" | "clearHttpLogs" | "getLatestRelease"
        | "getUpdateSupport" => &[],
        "switchProfile" => &["profile"],
        "getProjects" | "getApiKeyInfo" => &["profile?"],
        "getSecrets" => &["profile?", "projectId?", "query?", "path?", "status?"],
        "getSecretVersions" | "deleteSecret" => &["secretId", "profile?", "projectId?"],
        "getSecretValue"
        | "enableSecretVersion"
        | "disableSecretVersion"
        | "destroySecretVersion" => &["secretId", "revision", "profile?", "projectId?"],
        "prefetchSecretValues" | "getActiveVersionCounts" => {
            &["secretIds", "profile?", "projectId?"]
        }
        "createSecret" => &[
            "name",
            "path?",
            "type?",
            "value",
            "tags?",
            "profile?",
            "projectId?",
        ],
        "duplicateSecret" => &[
            "secretId",
            "name",
            "path?",
            "type?",
            "tags?",
            "profile?",
            "projectId?",
        ],
        "updateSecretValue" => &["secretId", "value", "profile?", "projectId?"],
        "updateSecret" => &["secretId", "name?", "tags?", "profile?", "projectId?"],
        "openExternal" => &["url"],
        "installUpdate" => &["version"],
        _ => return Err("not found".into()),
    };
    if serde_json::to_vec(params)
        .map_err(|_| "invalid parameters")?
        .len()
        > 2 * 1024 * 1024
    {
        return Err("request too large".into());
    }
    let data = params.as_object().ok_or("invalid parameters")?;
    if data.keys().any(|key| {
        !fields
            .iter()
            .any(|field| field.trim_end_matches('?') == key)
    }) {
        return Err("invalid parameters".into());
    }
    for field in fields {
        let key = field.trim_end_matches('?');
        let Some(value) = data.get(key) else {
            if field.ends_with('?') {
                continue;
            }
            return Err("invalid parameters".into());
        };
        let valid = match key {
            "revision" if method == "getSecretValue" => value.as_str().is_some_and(revision),
            "revision" => value
                .as_f64()
                .is_some_and(|n| n > 0.0 && n <= 9_007_199_254_740_991.0 && n.fract() == 0.0),
            "tags" | "secretIds" => value.as_array().is_some_and(|items| {
                items.len() <= 10_000
                    && items
                        .iter()
                        .all(|item| item.as_str().is_some_and(|s| key != "secretIds" || uuid(s)))
            }),
            _ => value.as_str().is_some_and(|s| match key {
                "secretId" | "projectId" => uuid(s),
                "status" => matches!(s, "all" | "ready" | "disabled"),
                "version" => {
                    s.split('.').count() == 3
                        && s.split('.')
                            .all(|p| !p.is_empty() && p.bytes().all(|b| b.is_ascii_digit()))
                }
                "name" | "profile" | "url" | "type" => !s.is_empty(),
                _ => true,
            }),
        };
        if !valid {
            return Err("invalid parameters".into());
        }
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn rejects_invalid_and_unknown_ipc_inputs() {
        let id = "12345678-1234-1234-1234-123456789abc";
        for (method, params) in [
            ("deleteSecret", json!({"secretId": "../other"})),
            ("deleteSecret", Value::Null),
            ("getProfiles", json!({"__proto__": {}})),
            (
                "getSecretValue",
                json!({"secretId": id, "revision": "1/access"}),
            ),
            (
                "destroySecretVersion",
                json!({"secretId": id, "revision": -1}),
            ),
            (
                "destroySecretVersion",
                json!({"secretId": id, "revision": 9_007_199_254_740_992_u64}),
            ),
            ("prefetchSecretValues", json!({"secretIds": [id, {}]})),
            ("getProjects", json!({"profile": null})),
            ("constructor", json!({})),
        ] {
            assert!(
                validate_params(method, &params).is_err(),
                "{method}: {params}"
            );
        }
        assert!(validate_params("deleteSecret", &json!({"secretId": id})).is_ok());
        assert!(
            validate_params(
                "destroySecretVersion",
                &json!({"secretId": id, "revision": 1.0})
            )
            .is_ok()
        );
        assert!(
            validate_params(
                "updateSecretValue",
                &json!({"secretId": id, "value": "x".repeat(2 * 1024 * 1024)})
            )
            .is_err()
        );
    }
}
