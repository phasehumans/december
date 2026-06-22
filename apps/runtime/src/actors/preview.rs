use std::{path::PathBuf, sync::Arc};

use chrono::Utc;
use tokio::{
    sync::{mpsc, watch},
    time::{self, MissedTickBehavior},
};
use tracing::{error, info, warn};

use crate::{
    actors::preview::ActorCommand::{ApplyManifest, RunCompileCheck, Stop},
    app::{
        config::AppConfig,
        state::{PreviewLifecycleState, PreviewStatusSnapshot, backend_status_for},
    },
    domain::{
        error::RuntimeServiceError,
        manifest::{ManifestDiff, ManifestRef, PreviewManifest, ReconcileMode, is_newer_manifest},
    },
    sandboxes::{CompileCheckResult, Sandbox, docker::DockerSandbox},
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
    RunCompileCheck(tokio::sync::oneshot::Sender<Result<CompileCheckResult, RuntimeServiceError>>),
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
    is_new_project: bool,
}

impl PreviewActor {
    pub fn spawn(
        preview_id: String,
        project_id: String,
        config: Arc<AppConfig>,
        storage: ObjectStorage,
        backend: BackendCallbackClient,
        is_new_project: bool,
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
            is_new_project,
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
                        RunCompileCheck(reply_tx) => {
                            let result = self.sandbox.run_compile_check().await;
                            let _ = reply_tx.send(result);
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

                let has_package_json = self.workspace_path.as_ref()
                    .map(|p| p.join("package.json").exists())
                    .unwrap_or(false);

                if !has_package_json {
                    self.current_manifest = Some(manifest.clone());
                    self.healthy_version = Some(manifest.project_version_id.clone());
                    self.transition(PreviewLifecycleState::Healthy, None).await;
                } else {
                    self.transition(PreviewLifecycleState::Installing, None)
                        .await;
                    self.sandbox.install_dependencies().await?;
                    self.transition(PreviewLifecycleState::Starting, None).await;
                    self.sandbox.restart_dev_server().await?;
                    self.current_manifest = Some(manifest.clone());
                    self.await_healthy(&manifest).await?;
                }
            }
            ReconcileMode::Reinstall => {
                self.transition(PreviewLifecycleState::Rebuilding, None)
                    .await;
                self.ensure_sandbox_ready().await?;
                self.sync_manifest(&manifest, &diff).await?;

                let has_package_json = self.workspace_path.as_ref()
                    .map(|p| p.join("package.json").exists())
                    .unwrap_or(false);

                if !has_package_json {
                    self.current_manifest = Some(manifest.clone());
                    self.healthy_version = Some(manifest.project_version_id.clone());
                    self.transition(PreviewLifecycleState::Healthy, None).await;
                } else {
                    self.transition(PreviewLifecycleState::Installing, None)
                        .await;
                    self.sandbox.install_dependencies().await?;
                    self.transition(PreviewLifecycleState::Starting, None).await;
                    self.sandbox.restart_dev_server().await?;
                    self.current_manifest = Some(manifest.clone());
                    self.await_healthy(&manifest).await?;
                }
            }
            ReconcileMode::Restart => {
                self.transition(PreviewLifecycleState::Rebuilding, None)
                    .await;
                self.ensure_sandbox_ready().await?;
                self.sync_manifest(&manifest, &diff).await?;

                let has_package_json = self.workspace_path.as_ref()
                    .map(|p| p.join("package.json").exists())
                    .unwrap_or(false);

                if !has_package_json {
                    self.current_manifest = Some(manifest.clone());
                    self.healthy_version = Some(manifest.project_version_id.clone());
                    self.transition(PreviewLifecycleState::Healthy, None).await;
                } else {
                    self.transition(PreviewLifecycleState::Starting, None).await;
                    self.sandbox.restart_dev_server().await?;
                    self.current_manifest = Some(manifest.clone());
                    self.await_healthy(&manifest).await?;
                }
            }
            ReconcileMode::SyncOnly => {
                self.transition(PreviewLifecycleState::Rebuilding, None)
                    .await;
                self.ensure_sandbox_ready().await?;
                self.sync_manifest(&manifest, &diff).await?;
                self.current_manifest = Some(manifest.clone());

                let has_package_json = self.workspace_path.as_ref()
                    .map(|p| p.join("package.json").exists())
                    .unwrap_or(false);

                if !has_package_json {
                    self.healthy_version = Some(manifest.project_version_id.clone());
                    self.transition(PreviewLifecycleState::Healthy, None).await;
                } else {
                    self.await_healthy(&manifest).await?;
                }
            }
            ReconcileMode::Noop => {
                self.current_manifest = Some(manifest.clone());

                let has_package_json = self.workspace_path.as_ref()
                    .map(|p| p.join("package.json").exists())
                    .unwrap_or(false);

                if !has_package_json || self.healthy_version.as_deref() == Some(manifest.project_version_id.as_str()) {
                    self.healthy_version = Some(manifest.project_version_id.clone());
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

        if self.is_new_project {
            write_scaffold_files(&workspace_path).await?;
            self.is_new_project = false;
        }

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

        let has_package_json = self.workspace_path.as_ref()
            .map(|p| p.join("package.json").exists())
            .unwrap_or(false);

        if !has_package_json {
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

    pub async fn run_compile_check(&self) -> Result<CompileCheckResult, RuntimeServiceError> {
        let (tx, rx) = tokio::sync::oneshot::channel();
        self.command_tx
            .send(RunCompileCheck(tx))
            .await
            .map_err(|error| {
                RuntimeServiceError::infra_runtime(
                    "preview actor is unavailable for compile check",
                    Some(error.to_string()),
                )
            })?;
        rx.await.map_err(|_| {
            RuntimeServiceError::infra_runtime(
                "preview actor compile check channel closed",
                None,
            )
        })?
    }
}

async fn write_scaffold_files(workspace_path: &std::path::Path) -> Result<(), RuntimeServiceError> {
    let index_html = r#"<!doctype html>
<html lang="en">
    <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>December App</title>
    </head>
    <body class="bg-slate-950 text-slate-50">
        <div id="root"></div>
        <script type="module" src="/src/main.tsx"></script>
    </body>
</html>
"#;

    let package_json = r#"{
    "name": "december-workspace",
    "private": true,
    "version": "0.1.0",
    "type": "module",
    "scripts": {
        "dev": "vite --host 0.0.0.0 --port 5173",
        "build": "tsc --noEmit && vite build",
        "preview": "vite preview"
    },
    "dependencies": {
        "react": "^19.0.0",
        "react-dom": "^19.0.0",
        "lucide-react": "^0.450.0"
    },
    "devDependencies": {
        "@types/react": "^19.0.0",
        "@types/react-dom": "^19.0.0",
        "@vitejs/plugin-react": "^4.3.0",
        "@tailwindcss/vite": "^4.0.0",
        "typescript": "^5.6.0",
        "vite": "^6.0.0"
    }
}
"#;

    let tsconfig_json = r#"{
    "compilerOptions": {
        "target": "ES2022",
        "useDefineForClassFields": true,
        "lib": ["DOM", "DOM.Iterable", "ES2022"],
        "module": "ESNext",
        "skipLibCheck": true,
        "moduleResolution": "bundler",
        "allowImportingTsExtensions": true,
        "resolveJsonModule": true,
        "isolatedModules": true,
        "noEmit": true,
        "jsx": "react-jsx",
        "strict": true,
        "noUnusedLocals": false,
        "noUnusedParameters": false,
        "noFallthroughCasesInSwitch": true
    },
    "include": ["src"]
}
"#;

    let vite_config_ts = r#"import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
    plugins: [react(), tailwindcss()],
    server: {
        host: '0.0.0.0',
        port: 5173,
        strictPort: true,
    },
})
"#;

    let main_tsx = r#"import React from 'react'
import ReactDOM from 'react-dom/client'

import App from './App.tsx'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
        <App />
    </React.StrictMode>
)
"#;

    let app_tsx = r#"import React from 'react'

export default function App() {
    return (
        <div style={{ padding: '20px', fontFamily: 'sans-serif' }}>
            <h1>Initializing...</h1>
            <p>Please wait while the AI builds your application.</p>
        </div>
    )
}
"#;

    let index_css = r#"body {
    margin: 0;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
}
"#;

    // Create the directories and write the files
    tokio::fs::create_dir_all(workspace_path.join("src"))
        .await
        .map_err(|e| RuntimeServiceError::infra_runtime("failed to create src dir for scaffold", Some(e.to_string())))?;

    tokio::fs::write(workspace_path.join("index.html"), index_html)
        .await
        .map_err(|e| RuntimeServiceError::infra_runtime("failed to write scaffold index.html", Some(e.to_string())))?;

    tokio::fs::write(workspace_path.join("package.json"), package_json)
        .await
        .map_err(|e| RuntimeServiceError::infra_runtime("failed to write scaffold package.json", Some(e.to_string())))?;

    tokio::fs::write(workspace_path.join("tsconfig.json"), tsconfig_json)
        .await
        .map_err(|e| RuntimeServiceError::infra_runtime("failed to write scaffold tsconfig.json", Some(e.to_string())))?;

    tokio::fs::write(workspace_path.join("vite.config.ts"), vite_config_ts)
        .await
        .map_err(|e| RuntimeServiceError::infra_runtime("failed to write scaffold vite.config.ts", Some(e.to_string())))?;

    tokio::fs::write(workspace_path.join("src/main.tsx"), main_tsx)
        .await
        .map_err(|e| RuntimeServiceError::infra_runtime("failed to write scaffold main.tsx", Some(e.to_string())))?;

    tokio::fs::write(workspace_path.join("src/App.tsx"), app_tsx)
        .await
        .map_err(|e| RuntimeServiceError::infra_runtime("failed to write scaffold App.tsx", Some(e.to_string())))?;

    tokio::fs::write(workspace_path.join("src/index.css"), index_css)
        .await
        .map_err(|e| RuntimeServiceError::infra_runtime("failed to write scaffold index.css", Some(e.to_string())))?;

    Ok(())
}
