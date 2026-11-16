// Backend modules are shared verbatim with src-tauri.
#[path = "../../../src-tauri/src/profiles.rs"]
mod profiles;
#[path = "../../../src-tauri/src/rpc.rs"]
mod rpc;
#[path = "../../../src-tauri/src/scw.rs"]
mod scw;

use napi_derive::napi;
use std::sync::OnceLock;

// Read-only slice exposed to JS; writes stay unreachable from this POC.
const ALLOWED: &[&str] = &[
    "getProfiles",
    "getProjects",
    "getSecrets",
    "getSecretValue",
    "getActiveVersionCounts",
];

static BACKEND: OnceLock<Result<scw::Backend, String>> = OnceLock::new();

async fn dispatch(method: &str, params: &str) -> Result<String, String> {
    if !ALLOWED.contains(&method) {
        return Err("unsupported method".into());
    }
    let params: serde_json::Value =
        serde_json::from_str(params).map_err(|_| "invalid parameters")?;
    let backend = BACKEND
        .get_or_init(scw::Backend::new)
        .as_ref()
        .map_err(Clone::clone)?;
    let value = backend.call(method, params).await?;
    serde_json::to_string(&value).map_err(|_| "request failed".into())
}

/// Calls the Scaleway backend with JSON params and returns the JSON result.
#[napi]
pub async fn call(method: String, params: String) -> napi::Result<String> {
    dispatch(&method, &params)
        .await
        .map_err(napi::Error::from_reason)
}

#[cfg(test)]
mod tests {
    use super::dispatch;

    #[tokio::test]
    async fn rejects_methods_and_params_outside_the_read_only_slice() {
        for (method, params) in [
            (
                "deleteSecret",
                r#"{"secretId":"00000000-0000-0000-0000-000000000000"}"#,
            ),
            ("switchProfile", r#"{"profile":"default"}"#),
            (
                "getSecretValue",
                r#"{"secretId":"../x","revision":"latest"}"#,
            ),
            ("getProjects", "not json"),
            ("getProjects", r#"{"profile":"default","extra":1}"#),
        ] {
            assert!(dispatch(method, params).await.is_err(), "{method} {params}");
        }
    }
}
