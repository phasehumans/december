use std::{path::PathBuf, sync::Arc};

use chrono::Utc;
use tokio::{
    sync::{mpsc, watch},
    time::{self, MissedTickBehavior},
};
use tracing::{error, info, warn};

use crate::{
    actors::preview::ActorCommand::{ApplyManifest, Stop},
    app::{
        config::AppConfig,
        state::{PreviewLifecycleState, PreviewStatusSnapshot, backend_status_for},
    },
    domain::{
        error::RuntimeServiceError,
        manifest::{ManifestDiff, ManifestRef, PreviewManifest, ReconcileMode, is_newer_manifest},
    },
    sandboxes::{Sandbox, docker::DockerSandbox},
    services::{
        backend::BackendCallbackClient,
        storage::ObjectStorage,
        workspace::{cleanup_workspace, ensure_workspace, sync_workspace},
    },
};

#[derive(Clone)]
pub struct PreviewActorHandle {
    command_tx: mpsc::Sender<ActorCommand>,
    status_rx: watch::Receiver<PreviewStatusSnapshot>,
}

enum ActorCommand {
    ApplyManifest(ManifestRef),
    Stop,
}

pub struct PreviewActor {
    preview_id: String,
    config: Arc<AppConfig>,
    storage: ObjectStorage,
    backend: BackendCallbackClient,
    sandbox: Arc<dyn Sandbox>,
    workspace_path: Option<PathBuf>,
    current_manifest: Option<PreviewManifest>,
    current_version: Option<String>,
    healthy_version: Option<String>,
    last_manifest_ref: Option<ManifestRef>,
    last_report_signature: Option<String>,
    command_rx: mpsc::Receiver<ActorCommand>,
    status_tx: watch::Sender<PreviewStatusSnapshot>,
}

impl PreviewActor {
    pub fn spawn(
        preview_id: String,
        project_id: String,
        config: Arc<AppConfig>,
        storage: ObjectStorage,
        backend: BackendCallbackClient,
    ) -> Result<PreviewActorHandle, RuntimeServiceError> {
        let display_url = Some(format!(
            "{}/previews/{}/display",
            config.public_base_url, preview_id
        ));
        let initial_status =
            PreviewStatusSnapshot::new(preview_id.clone(), project_id.clone(), display_url);
        let (status_tx, status_rx) = watch::channel(initial_status);
        let (command_tx, command_rx) = mpsc::channel(32);
        let sandbox = Arc::new(DockerSandbox::new(
            preview_id.clone(),
            config.docker.clone(),
        )?);

        let actor = Self {
            preview_id,
            config,
            storage,
            backend,
            sandbox,
            workspace_path: None,
            current_manifest: None,
            current_version: None,
            healthy_version: None,
            last_manifest_ref: None,
            last_report_signature: None,
            command_rx,
            status_tx,
        };

        tokio::spawn(actor.run());

        Ok(PreviewActorHandle {
            command_tx,
            status_rx,
        })
    }

    async fn run(mut self) {
        let mut health_interval = time::interval(self.config.health_poll_interval);
        health_interval.set_missed_tick_behavior(MissedTickBehavior::Skip);

        loop {
            tokio::select! {
                command = self.command_rx.recv() => {
                    let Some(command) = command else {
                        break;
                    };

                    match command {
                        ApplyManifest(manifest_ref) => {
                            if let Err(error) = self.reconcile(manifest_ref).await {
                                error!(preview_id = %self.preview_id, error = %error, "preview reconcile failed");
                                self.fail(error).await;
                            }
                        }
                        Stop => {
                            self.transition(PreviewLifecycleState::Stopped, None).await;
                            let _ = self.sandbox.stop().await;
                            if self.config.cleanup_workspace_on_stop {
                                if let Some(workspace_path) = &self.workspace_path {
                                    let _ = cleanup_workspace(workspace_path).await;
                                }
                            }
                            break;
                        }
                    }
                }
                _ = health_interval.tick() => {
                    if let Err(error) = self.refresh_health().await {
                        warn!(preview_id = %self.preview_id, error = %error, "preview health refresh failed");
                    }
                }
            }
        }
    }
    async fn reconcile(&mut self, manifest_ref: ManifestRef) -> Result<(), RuntimeServiceError> {
        if !is_newer_manifest(self.last_manifest_ref.as_ref(), &manifest_ref) {
            warn!(
                preview_id = %self.preview_id,
                manifest_version = %manifest_ref.manifest_version,
                "ignoring stale manifest notification"
            );
            return Ok(());
        }

        self.last_manifest_ref = Some(manifest_ref.clone());
        let manifest = self
            .storage
            .fetch_manifest(&manifest_ref.manifest_key)
            .await?;
        self.current_version = Some(manifest.project_version_id.clone());

        if !manifest.effective_runnable() {
            self.current_manifest = Some(manifest);
            self.transition(
                PreviewLifecycleState::WaitingForRunnableVersion,
                Some(RuntimeServiceError::temporary_partial_generation(
                    "preview manifest is not runnable yet",
                    Some("waiting for package.json, index.html, and source entrypoint".to_string()),
                )),
            )
            .await;
            return Ok(());
        }

        let previous_manifest = self.current_manifest.as_ref();
        let diff = ManifestDiff::between(previous_manifest, &manifest);

        info!(
            preview_id = %self.preview_id,
            manifest_version = %manifest.manifest_version,
            mode = ?diff.mode,
            "reconciling preview manifest"
        );

        match diff.mode {
            ReconcileMode::Bootstrap => {
                self.transition(PreviewLifecycleState::Bootstrapping, None)
                    .await;
                self.ensure_sandbox_ready().await?;
                self.sync_manifest(&manifest, &diff).await?;
                self.transition(PreviewLifecycleState::Installing, None)
                    .await;
                self.sandbox.install_dependencies().await?;
                self.transition(PreviewLifecycleState::Starting, None).await;
                self.sandbox.restart_dev_server().await?;
                self.current_manifest = Some(manifest.clone());
                self.await_healthy(&manifest).await?;
            }
            ReconcileMode::Reinstall => {
                self.transition(PreviewLifecycleState::Rebuilding, None)
                    .await;
                self.ensure_sandbox_ready().await?;
                self.sync_manifest(&manifest, &diff).await?;
                self.transition(PreviewLifecycleState::Installing, None)
                    .await;
                self.sandbox.install_dependencies().await?;
                self.transition(PreviewLifecycleState::Starting, None).await;
                self.sandbox.restart_dev_server().await?;
                self.current_manifest = Some(manifest.clone());
                self.await_healthy(&manifest).await?;
            }
            ReconcileMode::Restart => {
                self.transition(PreviewLifecycleState::Rebuilding, None)
                    .await;
                self.ensure_sandbox_ready().await?;
                self.sync_manifest(&manifest, &diff).await?;
                self.transition(PreviewLifecycleState::Starting, None).await;
                self.sandbox.restart_dev_server().await?;
                self.current_manifest = Some(manifest.clone());
                self.await_healthy(&manifest).await?;
            }
            ReconcileMode::SyncOnly => {
                self.transition(PreviewLifecycleState::Rebuilding, None)
                    .await;
                self.ensure_sandbox_ready().await?;
                self.sync_manifest(&manifest, &diff).await?;
                self.current_manifest = Some(manifest.clone());
                self.await_healthy(&manifest).await?;
            }
            ReconcileMode::Noop => {
                self.current_manifest = Some(manifest.clone());
                if self.healthy_version.as_deref() == Some(manifest.project_version_id.as_str()) {
                    self.transition(PreviewLifecycleState::Healthy, None).await;
                } else {
                    self.await_healthy(&manifest).await?;
                }
            }
        }

        Ok(())
    }

    async fn ensure_sandbox_ready(&mut self) -> Result<(), RuntimeServiceError> {
        let workspace_path = match &self.workspace_path {
            Some(path) => path.clone(),
            None => {
                let path = ensure_workspace(&self.config.workspace_root, &self.preview_id).await?;
                self.workspace_path = Some(path.clone());
                path
            }
        };

        self.sandbox.ensure_started(&workspace_path).await
    }

    async fn sync_manifest(
        &self,
        manifest: &PreviewManifest,
        diff: &ManifestDiff,
    ) -> Result<(), RuntimeServiceError> {
        let workspace_path = self.workspace_path.as_ref().ok_or_else(|| {
            RuntimeServiceError::infra_runtime("preview workspace is not initialized", None)
        })?;

        sync_workspace(workspace_path, &self.storage, manifest, diff).await
    }

    async fn await_healthy(
        &mut self,
        manifest: &PreviewManifest,
    ) -> Result<(), RuntimeServiceError> {
        let mut last_detail = None;
        for _ in 0..self.config.health_startup_attempts {
            let health = self.sandbox.health_check().await?;
            if health.healthy {
                self.healthy_version = Some(manifest.project_version_id.clone());
                self.transition(PreviewLifecycleState::Healthy, None).await;
                return Ok(());
            }

            last_detail = health
                .detail
                .clone()
                .or_else(|| health.body_excerpt.clone());
            time::sleep(time::Duration::from_secs(1)).await;
        }

        Err(RuntimeServiceError::stable_compile_runtime(
            "preview dev server did not become healthy",
            last_detail,
        ))
    }

    async fn refresh_health(&mut self) -> Result<(), RuntimeServiceError> {
        let snapshot = self.status_tx.borrow().clone();
        if !matches!(
            snapshot.state,
            PreviewLifecycleState::Healthy | PreviewLifecycleState::Rebuilding
        ) {
            return Ok(());
        }

        let health = self.sandbox.health_check().await?;
        if health.healthy {
            if snapshot.state != PreviewLifecycleState::Healthy {
                self.transition(PreviewLifecycleState::Healthy, None).await;
            }
            return Ok(());
        }

        if snapshot.state == PreviewLifecycleState::Healthy {
            self.fail(RuntimeServiceError::stable_compile_runtime(
                "preview health check failed after the sandbox was marked healthy",
                health.detail.or(health.body_excerpt),
            ))
            .await;
        }

        Ok(())
    }

    async fn fail(&mut self, error: RuntimeServiceError) {
        self.transition(PreviewLifecycleState::Failed, Some(error))
            .await;
    }

    async fn transition(
        &mut self,
        state: PreviewLifecycleState,
        error: Option<RuntimeServiceError>,
    ) {
        let mut snapshot = self.status_tx.borrow().clone();
        snapshot.state = state;
        snapshot.backend_status = backend_status_for(state);
        snapshot.current_version = self.current_version.clone();
        snapshot.healthy_version = self.healthy_version.clone();
        snapshot.updated_at = Utc::now();
        snapshot.preview_target_url = self.sandbox.preview_target_url().await;
        snapshot.last_error = error.map(|value| value.structured());

        if self.status_tx.send(snapshot.clone()).is_err() {
            warn!(preview_id = %self.preview_id, "failed to broadcast preview state update");
        }

        self.report_backend_if_changed(&snapshot).await;
    }

    async fn report_backend_if_changed(&mut self, snapshot: &PreviewStatusSnapshot) {
        let signature = format!(
            "{:?}|{:?}|{:?}|{:?}",
            snapshot.backend_status, snapshot.state, snapshot.current_version, snapshot.last_error
        );

        if self.last_report_signature.as_deref() == Some(signature.as_str()) {
            return;
        }

        self.last_report_signature = Some(signature);

        if let Err(error) = self.backend.report_status(snapshot).await {
            warn!(preview_id = %self.preview_id, error = %error, "failed to report preview status to backend");
        }
    }
}

impl PreviewActorHandle {
    pub async fn apply_manifest(&self, manifest: ManifestRef) -> Result<(), RuntimeServiceError> {
        self.command_tx
            .send(ApplyManifest(manifest))
            .await
            .map_err(|error| {
                RuntimeServiceError::infra_runtime(
                    "preview actor is unavailable",
                    Some(error.to_string()),
                )
            })
    }

    pub async fn stop(&self) -> Result<(), RuntimeServiceError> {
        self.command_tx.send(Stop).await.map_err(|error| {
            RuntimeServiceError::infra_runtime(
                "preview actor is unavailable",
                Some(error.to_string()),
            )
        })
    }

    pub fn snapshot(&self) -> PreviewStatusSnapshot {
        self.status_rx.borrow().clone()
    }
}
