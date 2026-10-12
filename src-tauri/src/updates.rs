use serde_json::{json, Value};
use sha2::{Digest, Sha256};
use std::{
    path::{Path, PathBuf},
    process::Stdio,
    time::Duration,
};
use tokio::{
    io::AsyncWriteExt,
    process::Command,
    sync::{watch, Mutex},
};

const REPO: &str = "Andarius/scw-secrets-desktop";
type InstallResult = Result<(), String>;
static INSTALL: Mutex<Option<watch::Receiver<Option<InstallResult>>>> = Mutex::const_new(None);

#[derive(Debug, PartialEq)]
struct Target {
    path: PathBuf,
    asset: &'static str,
    macos: bool,
}

fn valid_version(version: &str) -> bool {
    let parts: Vec<_> = version.split('.').collect();
    parts.len() == 3
        && parts
            .iter()
            .all(|part| !part.is_empty() && part.bytes().all(|b| b.is_ascii_digit()))
}

fn release_url(url: &str) -> bool {
    url.strip_prefix(&format!("https://github.com/{REPO}/releases/tag/v"))
        .is_some_and(valid_version)
}

fn external_url(url: &str) -> bool {
    if release_url(url) {
        return true;
    }
    let Some(path) = url.strip_prefix("https://console.scaleway.com/secret-manager/secrets/")
    else {
        return false;
    };
    let parts: Vec<_> = path.split('/').collect();
    if parts.len() != 3 || parts[2] != "overview" {
        return false;
    }
    let Some((country, region)) = parts[0].split_once('-') else {
        return false;
    };
    country.len() == 2
        && country.bytes().all(|b| b.is_ascii_lowercase())
        && !region.is_empty()
        && region.bytes().all(|b| b.is_ascii_lowercase())
        && parts[1].len() == 36
        && parts[1]
            .bytes()
            .all(|b| b.is_ascii_digit() || (b'a'..=b'f').contains(&b) || b == b'-')
}

fn parse_latest(payload: &Value) -> Option<Value> {
    if payload
        .get("draft")
        .is_some_and(|v| v != &Value::Bool(false) && !v.is_null())
        || payload
            .get("prerelease")
            .is_some_and(|v| v != &Value::Bool(false) && !v.is_null())
    {
        return None;
    }
    let tag = payload.get("tag_name")?.as_str()?;
    let version = tag.strip_prefix('v').unwrap_or(tag);
    let url = payload.get("html_url")?.as_str()?;
    (valid_version(version) && release_url(url)).then(|| json!({"version": version, "url": url}))
}

fn client(timeout: Duration) -> Result<reqwest::Client, String> {
    reqwest::Client::builder()
        .timeout(timeout)
        .connect_timeout(Duration::from_secs(10))
        .user_agent("scw-secrets-desktop")
        .build()
        .map_err(|e| e.to_string())
}

pub async fn latest() -> Option<Value> {
    let response = client(Duration::from_secs(5))
        .ok()?
        .get(format!(
            "https://api.github.com/repos/{REPO}/releases/latest"
        ))
        .header("accept", "application/vnd.github+json")
        .send()
        .await
        .ok()?;
    if !response.status().is_success() {
        return None;
    }
    parse_latest(&response.json::<Value>().await.ok()?)
}

fn detect_target(exec: &Path, appimage: Option<&Path>, os: &str, arch: &str) -> Option<Target> {
    if os == "macos" {
        let macos = exec.parent()?;
        let contents = macos.parent()?;
        let app = contents.parent()?;
        if !exec.is_absolute()
            || macos.file_name()? != "MacOS"
            || contents.file_name()? != "Contents"
            || app.file_name()? != "ScwSecrets.app"
        {
            return None;
        }
        Some(Target {
            path: app.to_owned(),
            macos: true,
            asset: if arch == "aarch64" {
                "ScwSecrets-macos-arm64.app.zip"
            } else {
                "ScwSecrets-macos-x64.app.zip"
            },
        })
    } else if os == "linux" {
        let path = appimage.filter(|path| path.is_absolute())?;
        Some(Target {
            path: path.to_owned(),
            macos: false,
            asset: "ScwSecrets.AppImage",
        })
    } else {
        None
    }
}

fn current_target() -> Option<Target> {
    let exec = std::env::current_exe().ok()?;
    let appimage = std::env::var_os("APPIMAGE").map(PathBuf::from);
    detect_target(
        &exec,
        appimage.as_deref(),
        std::env::consts::OS,
        std::env::consts::ARCH,
    )
}

pub fn can_install() -> bool {
    current_target().is_some()
}

fn pick_asset(payload: &Value, version: &str, name: &str) -> Option<(String, String)> {
    if !valid_version(version) {
        return None;
    }
    let asset = payload
        .get("assets")?
        .as_array()?
        .iter()
        .find(|asset| asset.get("name").and_then(Value::as_str) == Some(name))?;
    let url = format!("https://github.com/{REPO}/releases/download/v{version}/{name}");
    if asset.get("browser_download_url")?.as_str()? != url {
        return None;
    }
    let sha256 = asset.get("digest")?.as_str()?.strip_prefix("sha256:")?;
    (sha256.len() == 64
        && sha256
            .bytes()
            .all(|b| b.is_ascii_digit() || (b'a'..=b'f').contains(&b)))
    .then(|| (url, sha256.to_owned()))
}

fn verify_digest(bytes: &[u8], expected: &str) -> InstallResult {
    if format!("{:x}", Sha256::digest(bytes)) != expected {
        return Err("downloaded file doesn't match the published SHA-256".into());
    }
    Ok(())
}

pub async fn install(version: &str) -> InstallResult {
    if !valid_version(version) {
        return Err("invalid release version".into());
    }
    let mut current = INSTALL.lock().await;
    let mut result = if let Some(receiver) = current.as_ref() {
        receiver.clone()
    } else {
        let (sender, receiver) = watch::channel(None);
        *current = Some(receiver.clone());
        let version = version.to_owned();
        tokio::spawn(async move {
            sender.send_replace(Some(run_install(&version).await));
            *INSTALL.lock().await = None;
        });
        receiver
    };
    drop(current);
    loop {
        if let Some(value) = result.borrow().clone() {
            return value;
        }
        result
            .changed()
            .await
            .map_err(|_| "update task stopped unexpectedly".to_owned())?;
    }
}

async fn validate_target(target: &Target) -> InstallResult {
    let metadata = tokio::fs::symlink_metadata(&target.path)
        .await
        .map_err(|e| e.to_string())?;
    if metadata.file_type().is_symlink()
        || if target.macos {
            !metadata.is_dir()
        } else {
            !metadata.is_file()
        }
    {
        return Err("install target is not a regular app file or bundle".into());
    }
    Ok(())
}

async fn run_install(version: &str) -> InstallResult {
    let target = current_target()
        .ok_or("this install can't update itself; run the update command instead")?;
    validate_target(&target).await?;
    let release = client(Duration::from_secs(10))?
        .get(format!(
            "https://api.github.com/repos/{REPO}/releases/tags/v{version}"
        ))
        .header("accept", "application/vnd.github+json")
        .send()
        .await
        .map_err(|e| e.to_string())?;
    if !release.status().is_success() {
        return Err(format!(
            "release v{version} not found ({})",
            release.status()
        ));
    }
    let payload = release.json::<Value>().await.map_err(|e| e.to_string())?;
    let (url, sha256) = pick_asset(&payload, version, target.asset)
        .ok_or_else(|| format!("release v{version} has no verifiable {}", target.asset))?;
    let download = client(Duration::from_secs(300))?
        .get(url)
        .send()
        .await
        .map_err(|e| e.to_string())?;
    if !download.status().is_success() {
        return Err(format!("download failed ({})", download.status()));
    }
    let bytes = download.bytes().await.map_err(|e| e.to_string())?;
    verify_digest(&bytes, &sha256)?;
    let replace = if target.macos {
        replace_macos(&target.path, &bytes).await
    } else {
        replace_appimage(&target.path, &bytes).await
    };
    replace.map_err(|error| format!("couldn't replace the app: {error}"))?;
    if target.macos {
        relaunch(Path::new("/usr/bin/open"), &[Path::new("-n"), &target.path])
    } else {
        relaunch(&target.path, &[])
    }
}

async fn replace_appimage(path: &Path, bytes: &[u8]) -> InstallResult {
    let parent = path
        .parent()
        .ok_or("install target has no parent directory")?;
    let staged = tempfile::Builder::new()
        .prefix(".scw-secrets-update-")
        .tempfile_in(parent)
        .map_err(|e| e.to_string())?;
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        staged
            .as_file()
            .set_permissions(std::fs::Permissions::from_mode(0o755))
            .map_err(|e| e.to_string())?;
    }
    let mut file = tokio::fs::File::from_std(staged.reopen().map_err(|e| e.to_string())?);
    file.write_all(bytes).await.map_err(|e| e.to_string())?;
    file.sync_all().await.map_err(|e| e.to_string())?;
    drop(file);
    tokio::fs::rename(staged.path(), path)
        .await
        .map_err(|e| e.to_string())
}

async fn run(executable: &str, args: &[&Path]) -> InstallResult {
    let output = tokio::time::timeout(
        Duration::from_secs(120),
        Command::new(executable)
            .args(args)
            .stdin(Stdio::null())
            .stdout(Stdio::null())
            .stderr(Stdio::piped())
            .kill_on_drop(true)
            .output(),
    )
    .await
    .map_err(|_| format!("{executable} timed out"))?
    .map_err(|e| e.to_string())?;
    if !output.status.success() {
        return Err(format!(
            "{executable} failed: {}",
            String::from_utf8_lossy(&output.stderr).trim()
        ));
    }
    Ok(())
}

async fn replace_macos(path: &Path, bytes: &[u8]) -> InstallResult {
    let work = tempfile::Builder::new()
        .prefix("scw-secrets-update-")
        .tempdir()
        .map_err(|e| e.to_string())?;
    let parent = path
        .parent()
        .ok_or("install target has no parent directory")?;
    let mut stage = tempfile::Builder::new()
        .prefix(".scw-secrets-update-")
        .tempdir_in(parent)
        .map_err(|e| e.to_string())?;
    let result = async {
        let zip = work.path().join("update.zip");
        let extract = work.path().join("extract");
        tokio::fs::write(&zip, bytes)
            .await
            .map_err(|e| e.to_string())?;
        run("/usr/bin/ditto", &[Path::new("-xk"), &zip, &extract]).await?;
        let app = extract.join("ScwSecrets.app");
        let metadata = tokio::fs::symlink_metadata(app.join("Contents/MacOS"))
            .await
            .map_err(|e| e.to_string())?;
        if !metadata.is_dir() || metadata.file_type().is_symlink() {
            return Err("update archive has no app executable directory".into());
        }
        let next = stage.path().join("ScwSecrets.app");
        let previous = stage.path().join("previous.app");
        run("/usr/bin/ditto", &[&app, &next]).await?;
        let _ = run(
            "/usr/bin/xattr",
            &[Path::new("-dr"), Path::new("com.apple.quarantine"), &next],
        )
        .await;
        swap_macos(path, &next, &previous, &mut stage).await
    }
    .await;
    tokio::task::spawn_blocking(move || drop((work, stage)))
        .await
        .map_err(|e| e.to_string())?;
    result
}

async fn swap_macos(
    path: &Path,
    next: &Path,
    previous: &Path,
    stage: &mut tempfile::TempDir,
) -> InstallResult {
    tokio::fs::rename(path, previous)
        .await
        .map_err(|e| e.to_string())?;
    if let Err(error) = tokio::fs::rename(next, path).await {
        if let Err(rollback) = tokio::fs::rename(previous, path).await {
            stage.disable_cleanup(true);
            return Err(format!(
                "{error}; rollback failed: {rollback}; previous app preserved in {}",
                stage.path().display()
            ));
        }
        return Err(error.to_string());
    }
    Ok(())
}

fn relaunch(executable: &Path, args: &[&Path]) -> InstallResult {
    std::process::Command::new("/bin/sh")
        .args(["-c", "sleep 1; exec \"$@\"", "sh"])
        .arg(executable)
        .args(args)
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .spawn()
        .map_err(|e| e.to_string())?;
    Ok(())
}

pub async fn open_external(url: &str) -> InstallResult {
    if !external_url(url) {
        return Err("only Scaleway secret console and app release URLs can be opened".into());
    }
    #[cfg(target_os = "windows")]
    let mut command = {
        let root = std::env::var_os("SystemRoot").unwrap_or_else(|| "C:\\Windows".into());
        let mut command = Command::new(PathBuf::from(root).join("System32/rundll32.exe"));
        command.arg("url.dll,FileProtocolHandler");
        command
    };
    #[cfg(target_os = "macos")]
    let mut command = Command::new("/usr/bin/open");
    #[cfg(not(any(target_os = "macos", target_os = "windows")))]
    let mut command = Command::new("/usr/bin/xdg-open");
    let mut child = command
        .arg(url)
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .spawn()
        .map_err(|e| e.to_string())?;
    tokio::spawn(async move {
        let _ = child.wait().await;
    });
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn release_and_external_url_boundaries() {
        let url = format!("https://github.com/{REPO}/releases/tag/v1.2.3");
        assert!(external_url(&url));
        assert!(external_url("https://console.scaleway.com/secret-manager/secrets/fr-par/00000000-0000-0000-0000-000000000000/overview"));
        for invalid in [format!("{url}?redirect=evil"), format!("{url}\n"), url.replace("github.com", "github.com.evil"),
            "https://console.scaleway.com/secret-manager/secrets/fr-par/00000000-0000-0000-0000-000000000000/overview/evil".into(),
            "file:///etc/passwd".into(), "https://evil.example".into()] { assert!(!external_url(&invalid), "{invalid}"); }
        let valid =
            json!({"tag_name": "v1.2.3", "html_url": url, "draft": false, "prerelease": false});
        assert_eq!(parse_latest(&valid).unwrap()["version"], "1.2.3");
        for key in ["draft", "prerelease"] {
            let mut invalid = valid.clone();
            invalid[key] = json!(true);
            assert!(parse_latest(&invalid).is_none());
        }
        for tag in ["v1.2.3-beta", "1.2", "1.2.3/evil", "1.2.3\n"] {
            let mut invalid = valid.clone();
            invalid["tag_name"] = json!(tag);
            assert!(parse_latest(&invalid).is_none());
        }
    }

    #[test]
    fn selects_installed_targets_only() {
        let mac = Path::new("/Applications/ScwSecrets.app/Contents/MacOS/scw-secrets");
        assert_eq!(
            detect_target(mac, None, "macos", "aarch64").unwrap().asset,
            "ScwSecrets-macos-arm64.app.zip"
        );
        assert_eq!(
            detect_target(mac, None, "macos", "x86_64").unwrap().asset,
            "ScwSecrets-macos-x64.app.zip"
        );
        assert!(detect_target(Path::new("/tmp/dev"), None, "macos", "aarch64").is_none());
        assert!(detect_target(Path::new("/tmp/dev"), None, "linux", "x86_64").is_none());
        assert!(detect_target(mac, Some(Path::new("relative")), "linux", "x86_64").is_none());
        assert_eq!(
            detect_target(
                mac,
                Some(Path::new("/home/user/AppImage")),
                "linux",
                "x86_64"
            )
            .unwrap()
            .asset,
            "ScwSecrets.AppImage"
        );
        assert!(detect_target(mac, None, "windows", "x86_64").is_none());
    }

    #[test]
    fn assets_require_exact_urls_and_sha256() {
        let hash = format!("{:x}", Sha256::digest(b"app"));
        let url = format!("https://github.com/{REPO}/releases/download/v1.2.3/ScwSecrets.AppImage");
        let valid = json!({"assets": [{"name": "ScwSecrets.AppImage", "browser_download_url": url, "digest": format!("sha256:{hash}")}]});
        assert_eq!(
            pick_asset(&valid, "1.2.3", "ScwSecrets.AppImage"),
            Some((url.clone(), hash.clone()))
        );
        for digest in [
            "",
            "md5:abc",
            "sha256:ABC",
            &format!("sha256:{}", "A".repeat(64)),
        ] {
            let mut invalid = valid.clone();
            invalid["assets"][0]["digest"] = json!(digest);
            assert!(pick_asset(&invalid, "1.2.3", "ScwSecrets.AppImage").is_none());
        }
        for invalid_url in [
            "https://evil.example/app".to_owned(),
            format!("{url}?evil"),
            url.replace("v1.2.3", "v1.2.4"),
        ] {
            let mut invalid = valid.clone();
            invalid["assets"][0]["browser_download_url"] = json!(invalid_url);
            assert!(pick_asset(&invalid, "1.2.3", "ScwSecrets.AppImage").is_none());
        }
        assert!(pick_asset(&valid, "1.2.3; echo evil", "ScwSecrets.AppImage").is_none());
        assert!(verify_digest(b"app", &hash).is_ok());
        assert!(verify_digest(b"tampered", &hash).is_err());
    }

    #[tokio::test]
    async fn invalid_inputs_and_targets_fail_without_network_or_changes() {
        assert!(install("1.2.3/evil").await.is_err());
        assert!(open_external("https://evil.example").await.is_err());
        let dir = tempfile::tempdir().unwrap();
        let target = Target {
            path: dir.path().join("missing"),
            macos: false,
            asset: "ScwSecrets.AppImage",
        };
        assert!(validate_target(&target).await.is_err());
        let target = Target {
            path: dir.path().to_owned(),
            ..target
        };
        assert!(validate_target(&target).await.is_err());
        #[cfg(unix)]
        {
            let original = dir.path().join("original");
            let link = dir.path().join("link");
            tokio::fs::write(&original, b"keep").await.unwrap();
            std::os::unix::fs::symlink(&original, &link).unwrap();
            let target = Target {
                path: link,
                ..target
            };
            assert!(validate_target(&target).await.is_err());
            assert_eq!(tokio::fs::read(original).await.unwrap(), b"keep");
        }
    }

    #[tokio::test]
    async fn appimage_replacement_is_atomic_and_preserves_unrelated_files() {
        let dir = tempfile::tempdir().unwrap();
        let app = dir.path().join("app with spaces");
        let unrelated = dir.path().join("app with spaces.new");
        tokio::fs::write(&app, b"old").await.unwrap();
        tokio::fs::write(&unrelated, b"leave alone").await.unwrap();
        replace_appimage(&app, b"new").await.unwrap();
        assert_eq!(tokio::fs::read(&app).await.unwrap(), b"new");
        assert_eq!(tokio::fs::read(&unrelated).await.unwrap(), b"leave alone");
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            assert_eq!(
                std::fs::metadata(&app).unwrap().permissions().mode() & 0o777,
                0o755
            );
        }
        assert_eq!(std::fs::read_dir(dir.path()).unwrap().count(), 2);
    }

    #[tokio::test]
    async fn macos_swap_replaces_app_or_restores_previous_on_failure() {
        for valid_next in [true, false] {
            let dir = tempfile::tempdir().unwrap();
            let app = dir.path().join("ScwSecrets.app");
            tokio::fs::create_dir(&app).await.unwrap();
            tokio::fs::write(app.join("marker"), b"old").await.unwrap();
            let mut stage = tempfile::tempdir_in(dir.path()).unwrap();
            let next = stage.path().join("next.app");
            let previous = stage.path().join("previous.app");
            if valid_next {
                tokio::fs::create_dir(&next).await.unwrap();
                tokio::fs::write(next.join("marker"), b"new").await.unwrap();
            }

            let result = swap_macos(&app, &next, &previous, &mut stage).await;

            assert_eq!(result.is_ok(), valid_next);
            assert_eq!(
                tokio::fs::read(app.join("marker")).await.unwrap(),
                if valid_next { b"new" } else { b"old" }
            );
            if valid_next {
                assert_eq!(
                    tokio::fs::read(previous.join("marker")).await.unwrap(),
                    b"old"
                );
            } else {
                assert!(!previous.exists());
            }
        }
    }

    #[tokio::test]
    async fn failed_appimage_replacement_preserves_existing_target_and_cleans_stage() {
        let dir = tempfile::tempdir().unwrap();
        let target = dir.path().join("directory");
        tokio::fs::create_dir(&target).await.unwrap();
        tokio::fs::write(target.join("marker"), b"keep")
            .await
            .unwrap();
        assert!(replace_appimage(&target, b"new").await.is_err());
        assert_eq!(
            tokio::fs::read(target.join("marker")).await.unwrap(),
            b"keep"
        );
        assert_eq!(std::fs::read_dir(dir.path()).unwrap().count(), 1);
    }
}
