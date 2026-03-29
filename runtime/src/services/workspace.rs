use std::path::{Path, PathBuf};

use tokio::fs;

use crate::{
    domain::{
        error::RuntimeServiceError,
        manifest::{ManifestDiff, PreviewManifest},
    },
    services::storage::ObjectStorage,
};

pub async fn ensure_workspace(
    root: &Path,
    preview_id: &str,
) -> Result<PathBuf, RuntimeServiceError> {
    let path = root.join(preview_id);
    fs::create_dir_all(path.join(".phasehumans"))
        .await
        .map_err(|error| {
            RuntimeServiceError::infra_runtime(
                "failed to create preview workspace",
                Some(error.to_string()),
            )
        })?;
    Ok(path)
}

pub async fn sync_workspace(
    workspace_root: &Path,
    storage: &ObjectStorage,
    manifest: &PreviewManifest,
    diff: &ManifestDiff,
) -> Result<(), RuntimeServiceError> {
    let file_map = manifest.file_map();

    for path in &diff.removed {
        if path.starts_with(".phasehumans/") {
            continue;
        }

        let absolute_path = workspace_root.join(path);
        if fs::metadata(&absolute_path).await.is_ok() {
            fs::remove_file(&absolute_path).await.map_err(|error| {
                RuntimeServiceError::infra_runtime(
                    "failed to remove obsolete workspace file",
                    Some(error.to_string()),
                )
            })?;
        }
    }

    for path in diff.changed_paths() {
        let entry = file_map.get(path).ok_or_else(|| {
            RuntimeServiceError::infra_runtime(
                "manifest diff referenced an unknown file",
                Some(path.to_string()),
            )
        })?;
        let absolute_path = workspace_root.join(path);
        if let Some(parent) = absolute_path.parent() {
            fs::create_dir_all(parent).await.map_err(|error| {
                RuntimeServiceError::infra_runtime(
                    "failed to create workspace directory",
                    Some(error.to_string()),
                )
            })?;
        }

        let content = storage.fetch_text(&entry.object_key).await?;
        fs::write(&absolute_path, content).await.map_err(|error| {
            RuntimeServiceError::infra_runtime(
                "failed to write synced workspace file",
                Some(error.to_string()),
            )
        })?;
    }

    Ok(())
}

pub async fn cleanup_workspace(workspace_root: &Path) -> Result<(), RuntimeServiceError> {
    if fs::metadata(workspace_root).await.is_err() {
        return Ok(());
    }

    fs::remove_dir_all(workspace_root).await.map_err(|error| {
        RuntimeServiceError::infra_runtime(
            "failed to remove preview workspace",
            Some(error.to_string()),
        )
    })
}
