use serde::Deserialize;
use serde_json::{Value, json};
use std::{collections::BTreeMap, path::PathBuf};

#[derive(Clone, Default, Deserialize)]
#[serde(default)]
pub(crate) struct Profile {
    #[serde(rename = "access_key")]
    pub access_key: String,
    #[serde(rename = "secret_key")]
    pub secret_key: String,
    #[serde(rename = "default_project_id")]
    pub project_id: String,
    #[serde(rename = "default_organization_id")]
    pub organization_id: String,
}

#[derive(Default, Deserialize)]
#[serde(default)]
struct Config {
    active_profile: Option<String>,
    profiles: BTreeMap<String, Profile>,
}

pub(crate) struct Profiles {
    pub path: PathBuf,
    pub environment: Option<Profile>,
    write_lock: tokio::sync::Mutex<()>,
}

impl Profiles {
    pub(crate) fn new() -> Self {
        let home = std::env::var_os("HOME")
            .or_else(|| std::env::var_os("USERPROFILE"))
            .unwrap_or_else(|| ".".into());
        let get = |name| std::env::var(name).unwrap_or_default().trim().to_owned();
        let profile = Profile {
            access_key: get("SCW_ACCESS_KEY"),
            secret_key: get("SCW_SECRET_KEY"),
            project_id: get("SCW_PROJECT_ID"),
            organization_id: get("SCW_ORGANIZATION_ID"),
        };
        Self::at(
            PathBuf::from(home).join(".config/scw/config.yaml"),
            (!profile.secret_key.is_empty() && !profile.project_id.is_empty()).then_some(profile),
        )
    }

    pub(crate) fn at(path: PathBuf, environment: Option<Profile>) -> Self {
        Self {
            path,
            environment,
            write_lock: tokio::sync::Mutex::new(()),
        }
    }

    async fn config(&self) -> Result<Config, String> {
        let text = tokio::fs::read_to_string(&self.path)
            .await
            .map_err(|_| "request failed")?;
        serde_yaml::from_str(&text).map_err(|_| "request failed".into())
    }

    pub(crate) async fn load(&self, name: Option<&str>) -> Result<Profile, String> {
        if name.is_none() || name == Some("env") {
            if let Some(profile) = &self.environment {
                return Ok(profile.clone());
            }
        }
        let config = self.config().await?;
        let name = name
            .or(config.active_profile.as_deref())
            .unwrap_or("default");
        let profile = config.profiles.get(name).ok_or("request failed")?;
        if profile.secret_key.is_empty() || profile.project_id.is_empty() {
            return Err("request failed".into());
        }
        Ok(profile.clone())
    }

    pub(crate) async fn summaries(&self) -> Result<Value, String> {
        let config = match tokio::fs::read_to_string(&self.path).await {
            Ok(text) => serde_yaml::from_str::<Config>(&text).map_err(|_| "request failed")?,
            Err(_) => Config::default(),
        };
        let active = if self.environment.is_some() {
            Some("env")
        } else {
            config.active_profile.as_deref()
        };
        let summary = |name: &str, profile: &Profile, is_active| {
            json!({
                "name": name, "accessKey": profile.access_key, "projectId": profile.project_id,
                "organizationId": profile.organization_id, "isActive": is_active,
            })
        };
        let mut profiles = Vec::new();
        if let Some(profile) = &self.environment {
            profiles.push(summary("env", profile, true));
        }
        let mut names: Vec<_> = config.profiles.iter().collect();
        names.sort_by(|(a, _), (b, _)| crate::scw::by_name(a, b));
        for (name, profile) in names {
            profiles.push(summary(
                name,
                profile,
                self.environment.is_none() && active == Some(name.as_str()),
            ));
        }
        Ok(json!({ "active": active, "profiles": profiles }))
    }

    pub(crate) async fn switch(&self, name: &str) -> Result<Value, String> {
        let _guard = self.write_lock.lock().await;
        if name == "env" || !self.config().await?.profiles.contains_key(name) {
            return Err("request failed".into());
        }
        let text = tokio::fs::read_to_string(&self.path)
            .await
            .map_err(|_| "request failed")?;
        let mut updated = false;
        let quoted = serde_json::to_string(name).map_err(|_| "request failed")?;
        let mut lines = Vec::new();
        for line in text.lines() {
            if line.starts_with("active_profile:") {
                lines.push(format!("active_profile: {quoted}"));
                updated = true;
            } else {
                lines.push(line.to_owned());
            }
        }
        if !updated {
            return Err("request failed".into());
        }
        let path = self.path.clone();
        let rewritten = format!("{}\n", lines.join("\n"));
        tokio::task::spawn_blocking(move || -> std::io::Result<()> {
            use std::io::Write;
            let path = std::fs::canonicalize(path)?;
            let parent = path
                .parent()
                .ok_or_else(|| std::io::Error::other("missing config directory"))?;
            let mut file = tempfile::NamedTempFile::new_in(parent)?;
            file.write_all(rewritten.as_bytes())?;
            file.as_file()
                .set_permissions(std::fs::metadata(&path)?.permissions())?;
            file.as_file().sync_all()?;
            file.persist(path).map_err(|error| error.error)?;
            Ok(())
        })
        .await
        .map_err(|_| "request failed")?
        .map_err(|_| "request failed")?;
        Ok(json!({ "active": name }))
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    fn config_file(text: &str) -> tempfile::TempDir {
        let directory = tempfile::tempdir().unwrap();
        std::fs::write(directory.path().join("config.yaml"), text).unwrap();
        directory
    }

    const CONFIG: &str = "# keep comment\nactive_profile: default\nprofiles:\n  default:\n    secret_key: private-config-token\n    access_key: config-access\n    default_project_id: config-project\n  __proto__:\n    secret_key: proto-token\n    default_project_id: proto-project\n  'name: with spaces':\n    secret_key: named-token\n    default_project_id: named-project\n";

    #[tokio::test]
    async fn environment_takes_precedence_and_summaries_never_contain_credentials() {
        let file = config_file(CONFIG);
        let profiles = Profiles::at(
            file.path().join("config.yaml"),
            Some(Profile {
                secret_key: "private-env-token".into(),
                project_id: "env-project".into(),
                ..Profile::default()
            }),
        );
        assert_eq!(
            profiles.load(None).await.unwrap().secret_key,
            "private-env-token"
        );
        assert_eq!(
            profiles.load(Some("default")).await.unwrap().secret_key,
            "private-config-token"
        );
        assert_eq!(
            profiles.load(Some("__proto__")).await.unwrap().project_id,
            "proto-project"
        );
        assert!(profiles.load(Some("constructor")).await.is_err());
        let summaries = profiles.summaries().await.unwrap();
        assert_eq!(summaries["active"], "env");
        assert_eq!(summaries["profiles"][0]["name"], "env");
        assert!(!summaries.to_string().contains("token"));
    }

    #[cfg(unix)]
    #[tokio::test]
    async fn switching_preserves_symlinks_and_target_permissions() {
        use std::os::unix::fs::{PermissionsExt, symlink};

        let file = config_file(CONFIG);
        let target = file.path().join("config.yaml");
        std::fs::set_permissions(&target, std::fs::Permissions::from_mode(0o600)).unwrap();
        let directory = file.path().join("scw");
        std::fs::create_dir(&directory).unwrap();
        let link = directory.join("config.yaml");
        symlink("../config.yaml", &link).unwrap();
        let profiles = Profiles::at(link.clone(), None);

        profiles.switch("name: with spaces").await.unwrap();

        assert_eq!(
            std::fs::read_link(&link).unwrap(),
            PathBuf::from("../config.yaml")
        );
        assert_eq!(
            profiles.load(None).await.unwrap().project_id,
            "named-project"
        );
        let text = std::fs::read_to_string(&target).unwrap();
        assert!(text.starts_with("# keep comment\nactive_profile: \"name: with spaces\"\n"));
        assert!(text.contains("secret_key: private-config-token"));
        assert_eq!(
            std::fs::metadata(&target).unwrap().permissions().mode() & 0o777,
            0o600
        );
        assert_eq!(std::fs::read_dir(&directory).unwrap().count(), 1);
        assert_eq!(std::fs::read_dir(file.path()).unwrap().count(), 2);
    }

    #[tokio::test]
    async fn switching_preserves_config_and_round_trips_quoted_names() {
        let file = config_file(CONFIG);
        let profiles = Profiles::at(file.path().join("config.yaml"), None);
        assert_eq!(
            profiles.switch("name: with spaces").await.unwrap(),
            json!({"active": "name: with spaces"})
        );
        assert_eq!(
            profiles.load(None).await.unwrap().project_id,
            "named-project"
        );
        let text = tokio::fs::read_to_string(file.path().join("config.yaml"))
            .await
            .unwrap();
        assert!(text.starts_with("# keep comment\n"));
        assert!(text.contains("secret_key: private-config-token"));
        assert!(profiles.switch("env").await.is_err());
        assert!(profiles.switch("missing\nprofiles:").await.is_err());
        assert_eq!(
            tokio::fs::read_to_string(file.path().join("config.yaml"))
                .await
                .unwrap(),
            text
        );
    }
}
