use std::collections::{BTreeMap, BTreeSet};

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PreviewManifest {
    pub manifest_version: String,
    pub project_id: String,
    pub project_version_id: String,
    pub published_at: DateTime<Utc>,
    pub runnable: bool,
    pub files: Vec<PreviewManifestFile>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PreviewManifestFile {
    pub path: String,
    pub object_key: String,
    pub size: u64,
    pub content_type: Option<String>,
    pub sha256: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ManifestRef {
    pub manifest_version: String,
    pub manifest_key: String,
    pub project_id: String,
    pub project_version_id: Option<String>,
    pub published_at: Option<DateTime<Utc>>,
    pub runnable: bool,
}

#[derive(Debug, Clone, Copy, Serialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum ReconcileMode {
    Bootstrap,
    Reinstall,
    Restart,
    SyncOnly,
    Noop,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ManifestDiff {
    pub mode: ReconcileMode,
    pub added: Vec<String>,
    pub changed: Vec<String>,
    pub removed: Vec<String>,
}

impl PreviewManifest {
    pub fn effective_runnable(&self) -> bool {
        if !self.runnable {
            return false;
        }

        let paths = self
            .files
            .iter()
            .map(|file| file.path.as_str())
            .collect::<BTreeSet<_>>();

        paths.contains("package.json")
            && paths.contains("index.html")
            && paths.iter().any(|path| path.starts_with("src/"))
    }

    pub fn file_map(&self) -> BTreeMap<&str, &PreviewManifestFile> {
        self.files
            .iter()
            .map(|file| (file.path.as_str(), file))
            .collect::<BTreeMap<_, _>>()
    }
}

impl ManifestDiff {
    pub fn between(previous: Option<&PreviewManifest>, next: &PreviewManifest) -> Self {
        let previous_files = previous.map(PreviewManifest::file_map).unwrap_or_default();
        let next_files = next.file_map();

        let mut added = Vec::new();
        let mut changed = Vec::new();
        let mut removed = Vec::new();

        for (path, next_file) in &next_files {
            match previous_files.get(path) {
                Some(previous_file) => {
                    let previous_signature = previous_file
                        .sha256
                        .as_deref()
                        .unwrap_or(&previous_file.object_key);
                    let next_signature =
                        next_file.sha256.as_deref().unwrap_or(&next_file.object_key);

                    if previous_signature != next_signature || previous_file.size != next_file.size
                    {
                        changed.push((*path).to_string());
                    }
                }
                None => added.push((*path).to_string()),
            }
        }

        for path in previous_files.keys() {
            if !next_files.contains_key(path) {
                removed.push((*path).to_string());
            }
        }

        let has_changes = !added.is_empty() || !changed.is_empty() || !removed.is_empty();
        let paths = added
            .iter()
            .chain(changed.iter())
            .chain(removed.iter())
            .map(String::as_str)
            .collect::<Vec<_>>();

        let mode = if previous.is_none() {
            ReconcileMode::Bootstrap
        } else if !has_changes {
            ReconcileMode::Noop
        } else if paths.iter().any(|path| is_dependency_file(path)) {
            ReconcileMode::Reinstall
        } else if paths.iter().any(|path| is_config_file(path)) {
            ReconcileMode::Restart
        } else {
            ReconcileMode::SyncOnly
        };

        Self {
            mode,
            added,
            changed,
            removed,
        }
    }

    pub fn changed_paths(&self) -> Vec<&str> {
        self.added
            .iter()
            .chain(self.changed.iter())
            .map(String::as_str)
            .collect()
    }
}

pub fn is_newer_manifest(current: Option<&ManifestRef>, next: &ManifestRef) -> bool {
    let Some(current) = current else {
        return true;
    };

    match (current.published_at, next.published_at) {
        (Some(current_published_at), Some(next_published_at))
            if next_published_at != current_published_at =>
        {
            return next_published_at > current_published_at;
        }
        _ => {}
    }

    next.manifest_version >= current.manifest_version
}

fn is_dependency_file(path: &str) -> bool {
    matches!(
        path,
        "package.json"
            | "bun.lock"
            | "bun.lockb"
            | "package-lock.json"
            | "pnpm-lock.yaml"
            | "yarn.lock"
    )
}

fn is_config_file(path: &str) -> bool {
    path == "index.html"
        || path == "tsconfig.json"
        || path == "bunfig.toml"
        || path.starts_with(".env")
        || matches!(
            path,
            "vite.config.ts"
                | "vite.config.js"
                | "vite.config.mts"
                | "vite.config.mjs"
                | "postcss.config.js"
                | "postcss.config.cjs"
                | "tailwind.config.js"
                | "tailwind.config.ts"
                | "tailwind.config.cjs"
        )
}
