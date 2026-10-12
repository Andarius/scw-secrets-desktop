use serde::Deserialize;
use std::path::PathBuf;
use tauri::{utils::config::WindowConfig, Manager, Runtime};

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

pub fn config<R: Runtime>(app: &tauri::App<R>) -> WindowConfig {
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
