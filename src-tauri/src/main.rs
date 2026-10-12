#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod profiles;
mod rpc;
mod scw;
mod updates;
mod window;

use serde_json::{json, Value};
use tauri::Manager;

#[tauri::command]
async fn rpc<R: tauri::Runtime>(
    app: tauri::AppHandle<R>,
    window: tauri::WebviewWindow<R>,
    backend: tauri::State<'_, scw::Backend>,
    method: String,
    params: Value,
) -> Result<Value, String> {
    if window.label() != "main" {
        return Err("unauthorized".into());
    }
    rpc::validate_params(&method, &params)?;
    match method.as_str() {
        "openExternal" => {
            updates::open_external(params["url"].as_str().ok_or("invalid parameters")?).await?;
            Ok(json!({ "ok": true }))
        }
        "getLatestRelease" => Ok(updates::latest().await.unwrap_or(Value::Null)),
        "getUpdateSupport" => Ok(json!({ "canInstall": updates::can_install() })),
        "installUpdate" => {
            updates::install(params["version"].as_str().ok_or("invalid parameters")?).await?;
            tauri::async_runtime::spawn(async move {
                tokio::time::sleep(std::time::Duration::from_millis(300)).await;
                app.exit(0);
            });
            Ok(json!({ "ok": true }))
        }
        _ => backend.call(&method, params).await,
    }
}

fn local_navigation(url: &tauri::Url) -> bool {
    let local = matches!(url.scheme(), "tauri" | "http" | "https")
        && matches!(url.host_str(), Some("tauri.localhost"))
        && url.port().is_none()
        || url.scheme() == "tauri" && url.host_str() == Some("localhost");
    local
        || cfg!(debug_assertions)
            && url.scheme() == "http"
            && url.host_str() == Some("localhost")
            && url.port() == Some(5181)
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_window_state::Builder::default().build())
        .plugin(tauri_plugin_clipboard_manager::init())
        .setup(|app| {
            app.manage(scw::Backend::new().map_err(std::io::Error::other)?);
            tauri::WebviewWindowBuilder::from_config(app, &window::config(app))?
                .on_navigation(local_navigation)
                .build()?;
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![rpc])
        .run(tauri::generate_context!())
        .expect("failed to run Scw Secrets");
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn ipc_enforces_capabilities_and_input_validation() {
        let app = tauri::test::mock_builder()
            .manage(scw::Backend::new().unwrap())
            .invoke_handler(tauri::generate_handler![rpc])
            .build(tauri::generate_context!())
            .unwrap();
        for (label, origin, method, params, expected) in [
            (
                "main",
                "tauri://localhost",
                "getHttpLogs",
                json!({}),
                Ok(json!([])),
            ),
            (
                "other",
                "tauri://localhost",
                "getHttpLogs",
                json!({}),
                Err("not allowed"),
            ),
            (
                "main",
                "https://evil.example",
                "getHttpLogs",
                json!({}),
                Err("not allowed"),
            ),
            (
                "main",
                "tauri://localhost",
                "deleteSecret",
                json!({"secretId": "../outside"}),
                Err("invalid parameters"),
            ),
            (
                "main",
                "tauri://localhost",
                "getProfiles",
                json!({"profile": null}),
                Err("invalid parameters"),
            ),
        ] {
            let window = app.get_webview_window(label).unwrap_or_else(|| {
                tauri::WebviewWindowBuilder::new(&app, label, Default::default())
                    .build()
                    .unwrap()
            });
            let result = tauri::test::get_ipc_response(
                &window,
                tauri::webview::InvokeRequest {
                    cmd: "rpc".into(),
                    callback: tauri::ipc::CallbackFn(0),
                    error: tauri::ipc::CallbackFn(1),
                    url: origin.parse().unwrap(),
                    body: tauri::ipc::InvokeBody::Json(json!({"method": method, "params": params})),
                    headers: Default::default(),
                    invoke_key: tauri::test::INVOKE_KEY.into(),
                },
            )
            .map(|body| body.deserialize::<Value>().unwrap());
            match expected {
                Ok(value) => assert_eq!(result.unwrap(), value),
                Err(message) => assert!(
                    result.unwrap_err().to_string().contains(message),
                    "{label} {origin}"
                ),
            }
        }
    }

    #[test]
    fn navigation_keeps_the_secret_window_local() {
        for (url, allowed) in [
            ("tauri://localhost/index.html", true),
            ("http://tauri.localhost/index.html", true),
            ("https://evil.example", false),
            ("http://tauri.localhost.evil.example", false),
            ("http://tauri.localhost:9000", false),
            ("file:///etc/passwd", false),
            ("http://localhost:5181", cfg!(debug_assertions)),
        ] {
            assert_eq!(local_navigation(&url.parse().unwrap()), allowed, "{url}");
        }
    }
}
