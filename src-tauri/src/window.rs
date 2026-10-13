use serde::Deserialize;
use std::{collections::HashMap, path::PathBuf, time::Duration};
use tauri::{Manager, Runtime, WebviewWindow, WindowEvent, utils::config::WindowConfig};
use tauri_plugin_window_state::{AppHandleExt, StateFlags};
use tokio::sync::mpsc;

async fn pending_save(receiver: &mut mpsc::Receiver<()>) -> bool {
    if receiver.recv().await.is_none() {
        return false;
    }
    while matches!(
        tokio::time::timeout(Duration::from_millis(500), receiver.recv()).await,
        Ok(Some(()))
    ) {}
    true
}

pub(crate) fn persist<R: Runtime>(window: &WebviewWindow<R>) {
    let (sender, mut receiver) = mpsc::channel(1);
    let app = window.app_handle().clone();
    tauri::async_runtime::spawn(async move {
        while pending_save(&mut receiver).await {
            let app = app.clone();
            let _ = tauri::async_runtime::spawn_blocking(move || {
                // Empty flags flush the cache without querying the UI while holding its lock.
                app.save_window_state(StateFlags::empty())
            })
            .await;
        }
    });
    let _ = sender.try_send(());
    window.on_window_event(move |event| {
        if matches!(
            event,
            WindowEvent::Resized(_)
                | WindowEvent::Moved(_)
                | WindowEvent::ScaleFactorChanged { .. }
        ) {
            let _ = sender.try_send(());
        }
    });
}

#[derive(Deserialize)]
struct SavedSize {
    width: u32,
    height: u32,
}

fn parse_saved_size(text: &str) -> Option<tauri::PhysicalSize<u32>> {
    let states: HashMap<String, SavedSize> = serde_json::from_str(text).ok()?;
    let size = states.get("main")?;
    (size.width > 0 && size.height > 0).then(|| tauri::PhysicalSize::new(size.width, size.height))
}

pub(crate) fn saved_size<R: Runtime>(app: &tauri::App<R>) -> Option<tauri::PhysicalSize<u32>> {
    let path = app
        .path()
        .app_config_dir()
        .ok()?
        .join(tauri_plugin_window_state::DEFAULT_FILENAME);
    parse_saved_size(&std::fs::read_to_string(path).ok()?)
}

#[derive(Default, Deserialize)]
struct Geometry {
    width: Option<f64>,
    height: Option<f64>,
    x: Option<f64>,
    y: Option<f64>,
}

fn apply_legacy(config: &mut WindowConfig, text: &str) {
    let Ok(saved) = serde_json::from_str::<Geometry>(text) else {
        return;
    };
    if let (Some(width), Some(height)) = (saved.width, saved.height) {
        if width > 0.0 && height > 0.0 {
            config.width = width;
            config.height = height;
        }
    }
    if let (Some(x), Some(y)) = (saved.x, saved.y) {
        config.x = Some(x);
        config.y = Some(y);
    }
}

pub(crate) fn config<R: Runtime>(app: &tauri::App<R>) -> WindowConfig {
    let mut config = app.config().app.windows[0].clone();
    let has_state = app.path().app_config_dir().is_ok_and(|path| {
        path.join(tauri_plugin_window_state::DEFAULT_FILENAME)
            .exists()
    });
    if !has_state {
        let home = std::env::var_os("HOME").or_else(|| std::env::var_os("USERPROFILE"));
        let data = std::env::var_os("XDG_DATA_HOME")
            .map(PathBuf::from)
            .or_else(|| home.map(|home| PathBuf::from(home).join(".local/share")));
        if let Some(data) = data {
            if let Ok(text) = std::fs::read_to_string(data.join("scw-secrets/window.json")) {
                apply_legacy(&mut config, &text);
            }
        }
    }
    config
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn coalesces_pending_changes_and_flushes_on_disconnect() {
        for disconnect in [false, true] {
            let (sender, mut receiver) = mpsc::channel(3);
            for _ in 0..3 {
                sender.try_send(()).unwrap();
            }
            let sender = (!disconnect).then_some(sender);
            assert!(pending_save(&mut receiver).await);
            assert!(receiver.try_recv().is_err());
            drop(sender);
            assert!(!pending_save(&mut receiver).await);
        }
    }

    #[test]
    fn reads_valid_physical_size_from_existing_plugin_state() {
        for (text, expected) in [
            (
                r#"{"main":{"width":1107,"height":735,"maximized":false}}"#,
                Some(tauri::PhysicalSize::new(1107, 735)),
            ),
            (
                r#"{"main":{"width":2214,"height":1470}}"#,
                Some(tauri::PhysicalSize::new(2214, 1470)),
            ),
            (r#"{"main":{"width":0,"height":735}}"#, None),
            (r#"{"main":{"width":1107,"height":-1}}"#, None),
            (r#"{"other":{"width":1107,"height":735}}"#, None),
            ("invalid", None),
        ] {
            assert_eq!(parse_saved_size(text), expected);
        }
    }

    #[test]
    fn imports_legacy_geometry_without_losing_negative_monitor_coordinates() {
        let mut config = WindowConfig::default();
        apply_legacy(
            &mut config,
            r#"{"width":1440,"height":920,"x":-1400,"y":0}"#,
        );
        assert_eq!(
            (config.width, config.height, config.x, config.y),
            (1440.0, 920.0, Some(-1400.0), Some(0.0))
        );
        for invalid in ["invalid", r#"{"width":0,"height":-1}"#, r#"{"width":800}"#] {
            apply_legacy(&mut config, invalid);
            assert_eq!((config.width, config.height), (1440.0, 920.0));
        }
    }
}
