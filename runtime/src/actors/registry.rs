use std::{collections::HashMap, sync::Arc};

use tokio::sync::RwLock;

use crate::{
    actors::preview::{PreviewActor, PreviewActorHandle},
    app::{config::AppConfig, state::PreviewStatusSnapshot},
    domain::{error::RuntimeServiceError, manifest::ManifestRef},
    services::{backend::BackendCallbackClient, storage::ObjectStorage},
};

#[derive(Clone)]
pub struct ActorRegistry {
    inner: Arc<RwLock<HashMap<String, PreviewActorHandle>>>,
    config: Arc<AppConfig>,
    storage: ObjectStorage,
    backend: BackendCallbackClient,
}

impl ActorRegistry {
    pub fn new(
        config: Arc<AppConfig>,
        storage: ObjectStorage,
        backend: BackendCallbackClient,
    ) -> Self {
        Self {
            inner: Arc::new(RwLock::new(HashMap::new())),
            config,
            storage,
            backend,
        }
    }

    pub async fn start_or_update(
        &self,
        preview_id: String,
        project_id: String,
        initial_manifest: Option<ManifestRef>,
    ) -> Result<PreviewStatusSnapshot, RuntimeServiceError> {
        let handle = self.ensure_actor(preview_id, project_id).await?;

        if let Some(manifest) = initial_manifest {
            handle.apply_manifest(manifest).await?;
        }

        Ok(handle.snapshot())
    }

    pub async fn publish_manifest(
        &self,
        preview_id: String,
        project_id: String,
        manifest: ManifestRef,
    ) -> Result<PreviewStatusSnapshot, RuntimeServiceError> {
        let handle = self.ensure_actor(preview_id, project_id).await?;
        handle.apply_manifest(manifest).await?;
        Ok(handle.snapshot())
    }

    pub async fn status(
        &self,
        preview_id: &str,
    ) -> Result<PreviewStatusSnapshot, RuntimeServiceError> {
        let guard = self.inner.read().await;
        let handle = guard
            .get(preview_id)
            .ok_or_else(|| RuntimeServiceError::NotFound("preview not found".to_string()))?;

        Ok(handle.snapshot())
    }

    pub async fn delete(&self, preview_id: &str) -> Result<(), RuntimeServiceError> {
        let handle = {
            let mut guard = self.inner.write().await;
            guard.remove(preview_id)
        }
        .ok_or_else(|| RuntimeServiceError::NotFound("preview not found".to_string()))?;

        handle.stop().await
    }

    async fn ensure_actor(
        &self,
        preview_id: String,
        project_id: String,
    ) -> Result<PreviewActorHandle, RuntimeServiceError> {
        {
            let guard = self.inner.read().await;
            if let Some(handle) = guard.get(&preview_id) {
                return Ok(handle.clone());
            }
        }

        let mut guard = self.inner.write().await;
        if let Some(handle) = guard.get(&preview_id) {
            return Ok(handle.clone());
        }

        let handle = PreviewActor::spawn(
            preview_id.clone(),
            project_id,
            self.config.clone(),
            self.storage.clone(),
            self.backend.clone(),
        )?;
        guard.insert(preview_id, handle.clone());
        Ok(handle)
    }
}
