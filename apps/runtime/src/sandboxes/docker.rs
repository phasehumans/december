use std::{
    collections::HashMap,
    net::{SocketAddr, TcpListener},
    path::{Path, PathBuf},
    sync::Arc,
};

use async_trait::async_trait;
use tracing::{info, warn, error};
use bollard::{
    Docker,
    container::{
        Config as ContainerConfig, CreateContainerOptions, RemoveContainerOptions,
        StartContainerOptions, StopContainerOptions,
    },
    errors::Error as BollardError,
    exec::{CreateExecOptions, StartExecResults},
    models::{HostConfig, PortBinding},
};
use futures_util::TryStreamExt;
use reqwest::Client;
use tokio::sync::Mutex;

use crate::{
    app::config::DockerConfig,
    domain::error::RuntimeServiceError,
    sandboxes::{CompileCheckResult, HealthCheckResult, Sandbox},
};

#[derive(Clone)]
pub struct DockerSandbox {
    docker: Docker,
    config: Arc<DockerConfig>,
    preview_id: String,
    http_client: Client,
    state: Arc<Mutex<DockerSandboxState>>,
}

#[derive(Debug, Default)]
struct DockerSandboxState {
    container_name: Option<String>,
    host_port: Option<u16>,
    workspace_host_path: Option<PathBuf>,
    port_mappings: HashMap<u16, u16>,
}

impl DockerSandbox {
    pub fn new(preview_id: String, config: DockerConfig) -> Result<Self, RuntimeServiceError> {
        let docker = Docker::connect_with_local_defaults().map_err(|error| {
            RuntimeServiceError::infra_runtime(
                "failed to connect to Docker daemon",
                Some(error.to_string()),
            )
        })?;

        Ok(Self {
            docker,
            config: Arc::new(config),
            preview_id,
            http_client: Client::new(),
            state: Arc::new(Mutex::new(DockerSandboxState::default())),
        })
    }

    fn container_name(&self) -> String {
        let sanitized = self
            .preview_id
            .chars()
            .map(|char| {
                if char.is_ascii_alphanumeric() {
                    char
                } else {
                    '-'
                }
            })
            .collect::<String>();
        format!("{}-{}", self.config.container_prefix, sanitized)
    }

    async fn run_shell(
        &self,
        container_name: &str,
        script: &str,
    ) -> Result<(i64, String), RuntimeServiceError> {
        let exec = self
            .docker
            .create_exec(
                container_name,
                CreateExecOptions {
                    attach_stdout: Some(true),
                    attach_stderr: Some(true),
                    working_dir: Some(self.config.workdir_in_container.clone()),
                    cmd: Some(vec![
                        "sh".to_string(),
                        "-lc".to_string(),
                        script.to_string(),
                    ]),
                    ..Default::default()
                },
            )
            .await
            .map_err(|error| {
                RuntimeServiceError::infra_runtime(
                    "failed to create Docker exec",
                    Some(error.to_string()),
                )
            })?;

        let mut output = String::new();
        match self
            .docker
            .start_exec(&exec.id, None)
            .await
            .map_err(|error| {
                RuntimeServiceError::infra_runtime(
                    "failed to start Docker exec",
                    Some(error.to_string()),
                )
            })? {
            StartExecResults::Attached { output: logs, .. } => {
                futures_util::pin_mut!(logs);
                while let Some(log_output) = logs.try_next().await.map_err(|error| {
                    RuntimeServiceError::infra_runtime(
                        "failed to stream Docker exec output",
                        Some(error.to_string()),
                    )
                })? {
                    let text = log_output.to_string();
                    output.push_str(&text);
                    for line in text.lines() {
                        let trimmed = line.trim();
                        if !trimmed.is_empty() {
                            info!(
                                container_name = %container_name,
                                "[exec] {}",
                                trimmed
                            );
                        }
                    }
                }
            }
            StartExecResults::Detached => {}
        }

        let inspection = self.docker.inspect_exec(&exec.id).await.map_err(|error| {
            RuntimeServiceError::infra_runtime(
                "failed to inspect Docker exec result",
                Some(error.to_string()),
            )
        })?;

        Ok((inspection.exit_code.unwrap_or_default(), output))
    }

    async fn stop_dev_server_process(
        &self,
        container_name: &str,
    ) -> Result<(), RuntimeServiceError> {
        let _ = self
            .run_shell(
                container_name,
                "if [ -f /workspace/.december/dev-server.pid ]; then kill $(cat /workspace/.december/dev-server.pid) >/dev/null 2>&1 || true; rm -f /workspace/.december/dev-server.pid; fi",
            )
            .await?;
        Ok(())
    }

    async fn ensure_image_available(&self) -> Result<(), RuntimeServiceError> {
        info!(preview_id = %self.preview_id, image = %self.config.image, "checking if container image is available locally");
        match self.docker.inspect_image(&self.config.image).await {
            Ok(_) => {
                info!(preview_id = %self.preview_id, image = %self.config.image, "container image is available locally");
                Ok(())
            }
            Err(BollardError::DockerResponseServerError {
                status_code: 404, ..
            }) => {
                info!(preview_id = %self.preview_id, image = %self.config.image, "image not found locally, pulling from docker registry...");
                let result = self
                    .docker
                    .create_image(
                        Some(
                            bollard::query_parameters::CreateImageOptionsBuilder::default()
                                .from_image(&self.config.image)
                                .build(),
                        ),
                        None,
                        None,
                    )
                    .try_collect::<Vec<_>>()
                    .await
                    .map(|_| ())
                    .map_err(|error| {
                        RuntimeServiceError::infra_runtime(
                            "failed to pull preview image",
                            Some(error.to_string()),
                        )
                    });
                if result.is_ok() {
                    info!(preview_id = %self.preview_id, image = %self.config.image, "image successfully pulled");
                }
                result
            }
            Err(error) => Err(RuntimeServiceError::infra_runtime(
                "failed to inspect preview image",
                Some(error.to_string()),
            )),
        }
    }

    async fn check_port_health(&self, host_port: u16) -> Result<HealthCheckResult, RuntimeServiceError> {
        let target_url = format!("http://127.0.0.1:{host_port}");
        info!(preview_id = %self.preview_id, url = %target_url, "running sandbox port health check");
        let response = match self.http_client.get(format!("{target_url}/")).send().await {
            Ok(response) => response,
            Err(error) => {
                return Ok(HealthCheckResult {
                    healthy: false,
                    detail: Some(error.to_string()),
                    body_excerpt: None,
                });
            }
        };

        let status = response.status();
        let body = response.text().await.unwrap_or_default();
        let excerpt = trim_output(&body);
        let compile_error = contains_compile_error(&body);

        Ok(HealthCheckResult {
            healthy: status.is_success() && !compile_error,
            detail: if compile_error {
                Some("detected Vite compile/runtime error page".to_string())
            } else if !status.is_success() {
                Some(format!("preview health check returned {status}"))
            } else {
                None
            },
            body_excerpt: if excerpt.is_empty() {
                None
            } else {
                Some(excerpt)
            },
        })
    }

    async fn determine_dev_command(&self, workspace_host_path: Option<&Path>) -> String {
        let container_port = self.config.container_port;
        let default_cmd = format!(
            "env PORT={port} HOST=0.0.0.0 HOSTNAME=0.0.0.0 bun run dev --host 0.0.0.0 --port {port}",
            port = container_port
        );

        let workspace_path = match workspace_host_path {
            Some(path) => path,
            None => return default_cmd,
        };

        let package_json_path = workspace_path.join("package.json");
        if !package_json_path.exists() {
            return default_cmd;
        }

        let content = match std::fs::read_to_string(&package_json_path) {
            Ok(c) => c,
            Err(_) => return default_cmd,
        };

        let json: serde_json::Value = match serde_json::from_str(&content) {
            Ok(j) => j,
            Err(_) => return default_cmd,
        };

        let has_dep = |name: &str| -> bool {
            if let Some(deps) = json.get("dependencies").and_then(|d| d.as_object()) {
                if deps.contains_key(name) {
                    return true;
                }
            }
            if let Some(dev_deps) = json.get("devDependencies").and_then(|d| d.as_object()) {
                if dev_deps.contains_key(name) {
                    return true;
                }
            }
            false
        };

        let dev_script = json
            .get("scripts")
            .and_then(|s| s.get("dev"))
            .and_then(|d| d.as_str())
            .unwrap_or("");

        if has_dep("vite") || dev_script.contains("vite") {
            format!(
                "env PORT={port} HOST=0.0.0.0 bun run dev -- --host 0.0.0.0 --port {port}",
                port = container_port
            )
        } else if has_dep("next") || dev_script.contains("next") {
            format!("env PORT={port} HOSTNAME=0.0.0.0 bun run dev", port = container_port)
        } else if has_dep("react-scripts") || dev_script.contains("react-scripts") {
            format!("env PORT={port} HOST=0.0.0.0 bun run dev", port = container_port)
        } else if has_dep("astro") || dev_script.contains("astro") {
            format!(
                "env PORT={port} HOST=0.0.0.0 bun run dev -- --host 0.0.0.0 --port {port}",
                port = container_port
            )
        } else {
            default_cmd
        }
    }
}
#[async_trait]
impl Sandbox for DockerSandbox {
    async fn ensure_started(&self, workspace_host_path: &Path) -> Result<(), RuntimeServiceError> {
        let mut state = self.state.lock().await;
        if state.container_name.is_some() {
            return Ok(());
        }

        let candidate_ports = vec![
            self.config.container_port, // 4173
            4500,
            5173,
            3000,
            3001,
            5000,
            8080,
            8000,
        ];

        let mut port_mappings = HashMap::new();
        let mut port_bindings = HashMap::new();
        let mut exposed_ports = HashMap::new();

        for &c_port in &candidate_ports {
            if port_mappings.contains_key(&c_port) {
                continue;
            }
            let h_port = reserve_local_port()?;
            port_mappings.insert(c_port, h_port);

            port_bindings.insert(
                format!("{}/tcp", c_port),
                Some(vec![PortBinding {
                    host_ip: Some("0.0.0.0".to_string()),
                    host_port: Some(h_port.to_string()),
                }]),
            );

            exposed_ports.insert(
                format!("{}/tcp", c_port),
                HashMap::new(),
            );
        }

        let default_host_port = *port_mappings.get(&self.config.container_port).unwrap_or(&0);
        let container_name = self.container_name();
        info!(
            preview_id = %self.preview_id,
            name = %container_name,
            port_mappings = ?port_mappings,
            "ensuring preview sandbox is started with port mappings"
        );
        log_to_workspace(workspace_host_path, &format!("Container spinup initiated for preview_id: {}", self.preview_id)).await;
        log_to_workspace(workspace_host_path, &format!("Container name: {}", container_name)).await;
        log_to_workspace(workspace_host_path, &format!("Using image: {}", self.config.image)).await;
        log_to_workspace(workspace_host_path, &format!("Port mappings: {:?}", port_mappings)).await;

        self.ensure_image_available().await?;
        let workspace = workspace_host_path.canonicalize().map_err(|error| {
            RuntimeServiceError::infra_runtime(
                "failed to resolve workspace path",
                Some(error.to_string()),
            )
        })?;
        info!(preview_id = %self.preview_id, workspace = %workspace.display(), "using canonicalized workspace path");

        if self
            .docker
            .inspect_container(
                &container_name,
                None::<bollard::query_parameters::InspectContainerOptions>,
            )
            .await
            .is_ok()
        {
            info!(preview_id = %self.preview_id, name = %container_name, "removing existing preview container with same name");
            log_to_workspace(&workspace, "Removing existing preview container with same name...").await;
            let _ = self
                .docker
                .remove_container(
                    &container_name,
                    Some(RemoveContainerOptions {
                        force: true,
                        ..Default::default()
                    }),
                )
                .await;
        }

        info!(preview_id = %self.preview_id, name = %container_name, "creating new preview container");
        log_to_workspace(&workspace, "Creating new preview container...").await;
        self.docker
            .create_container(
                Some(CreateContainerOptions {
                    name: &container_name,
                    platform: None,
                }),
                ContainerConfig {
                    image: Some(self.config.image.clone()),
                    tty: Some(true),
                    working_dir: Some(self.config.workdir_in_container.clone()),
                    host_config: Some(HostConfig {
                        binds: Some(vec![
                            format!(
                                "{}:{}",
                                workspace.display(),
                                self.config.workdir_in_container
                            ),
                            "december-bun-cache:/root/.bun/install/cache".to_string(),
                        ]),
                        port_bindings: Some(port_bindings),
                        auto_remove: Some(true),
                        ..Default::default()
                    }),
                    exposed_ports: Some(exposed_ports),
                    volumes: Some({
                        let mut vols = HashMap::new();
                        vols.insert("/workspace/node_modules".to_string(), HashMap::new());
                        vols
                    }),
                    cmd: Some(vec![
                        "sh".to_string(),
                        "-lc".to_string(),
                        "mkdir -p /workspace/.december && while sleep 3600; do :; done"
                            .to_string(),
                    ]),
                    ..Default::default()
                },
            )
            .await
            .map_err(|error| {
                RuntimeServiceError::infra_runtime(
                    "failed to create preview container",
                    Some(error.to_string()),
                )
            })?;

        info!(preview_id = %self.preview_id, name = %container_name, "starting preview container");
        log_to_workspace(&workspace, "Starting preview container...").await;
        self.docker
            .start_container(&container_name, None::<StartContainerOptions<String>>)
            .await
            .map_err(|error| {
                RuntimeServiceError::infra_runtime(
                    "failed to start preview container",
                    Some(error.to_string()),
                )
            })?;

        info!(preview_id = %self.preview_id, name = %container_name, "preview container started successfully");
        log_to_workspace(&workspace, "Preview container started successfully.").await;
        state.container_name = Some(container_name);
        state.host_port = Some(default_host_port);
        state.port_mappings = port_mappings;
        state.workspace_host_path = Some(workspace);
        Ok(())
    }

    async fn install_dependencies(&self) -> Result<(), RuntimeServiceError> {
        let (container_name, workspace_host_path) = {
            let state = self.state.lock().await;
            (
                state.container_name.clone().ok_or_else(|| {
                    RuntimeServiceError::infra_runtime("preview container is not started", None)
                })?,
                state.workspace_host_path.clone(),
            )
        };

        if let Some(ref path) = workspace_host_path {
            log_to_workspace(path, "Starting dependency installation (bun install)...").await;
        }

        info!(preview_id = %self.preview_id, name = %container_name, "running bun install inside preview container...");
        let (exit_code, output) = self
            .run_shell(
                &container_name,
                "cd /workspace && bun install --no-progress --backend=copyfile --prefer-offline",
            )
            .await?;

        if let Some(ref path) = workspace_host_path {
            log_to_workspace(
                path,
                &format!(
                    "Dependency installation completed with exit code: {}\n--- Output ---\n{}\n--------------",
                    exit_code, output
                ),
            ).await;
        }

        if exit_code != 0 {
            error!(preview_id = %self.preview_id, name = %container_name, exit_code, "bun install failed inside container");
            return Err(RuntimeServiceError::dependency_install(
                "dependency installation failed",
                Some(trim_output(&output)),
            ));
        }

        info!(preview_id = %self.preview_id, name = %container_name, "bun install completed successfully inside container");
        Ok(())
    }

    async fn restart_dev_server(&self) -> Result<(), RuntimeServiceError> {
        let (container_name, workspace_host_path) = {
            let state = self.state.lock().await;
            (
                state.container_name.clone().ok_or_else(|| {
                    RuntimeServiceError::infra_runtime("preview container is not started", None)
                })?,
                state.workspace_host_path.clone(),
            )
        };

        if let Some(ref path) = workspace_host_path {
            log_to_workspace(path, "Restarting dev server...").await;
        }

        info!(preview_id = %self.preview_id, name = %container_name, "stopping existing dev server inside container...");
        self.stop_dev_server_process(&container_name).await?;

        let dev_cmd = self.determine_dev_command(workspace_host_path.as_deref()).await;
        if let Some(ref path) = workspace_host_path {
            log_to_workspace(path, &format!("Determined dev server command: {}", dev_cmd)).await;
        }

        info!(
            preview_id = %self.preview_id,
            name = %container_name,
            cmd = %dev_cmd,
            "starting dev server inside container..."
        );

        let shell_script = format!(
            "mkdir -p /workspace/.december && cd /workspace && nohup {} > /workspace/.december/dev-server.log 2>&1 & echo $! > /workspace/.december/dev-server.pid",
            dev_cmd
        );

        let (exit_code, output) = self.run_shell(&container_name, &shell_script).await?;

        if let Some(ref path) = workspace_host_path {
            log_to_workspace(
                path,
                &format!(
                    "Dev server start command completed with exit code: {}\n--- Output ---\n{}\n--------------",
                    exit_code, output
                ),
            ).await;
        }

        if exit_code != 0 {
            error!(preview_id = %self.preview_id, name = %container_name, exit_code, "failed to start preview dev server inside container");
            return Err(RuntimeServiceError::stable_compile_runtime(
                "failed to start preview dev server",
                Some(trim_output(&output)),
            ));
        }

        info!(preview_id = %self.preview_id, name = %container_name, "dev server start command run successfully");
        Ok(())
    }

    async fn stop(&self) -> Result<(), RuntimeServiceError> {
        let (container_name, workspace_host_path) = {
            let state = self.state.lock().await;
            (state.container_name.clone(), state.workspace_host_path.clone())
        };

        if let Some(ref path) = workspace_host_path {
            log_to_workspace(path, "Stopping and removing container...").await;
        }

        if let Some(container_name) = &container_name {
            let _ = self
                .docker
                .stop_container(container_name, Some(StopContainerOptions { t: 5 }))
                .await;
            let _ = self
                .docker
                .remove_container(
                    container_name,
                    Some(RemoveContainerOptions {
                        force: true,
                        ..Default::default()
                    }),
                )
                .await;
        }

        if let Some(ref path) = workspace_host_path {
            log_to_workspace(path, "Container stopped and removed successfully.").await;
        }

        Ok(())
    }

    async fn health_check(&self) -> Result<HealthCheckResult, RuntimeServiceError> {
        let (current_host_port, port_mappings) = {
            let state = self.state.lock().await;
            (state.host_port, state.port_mappings.clone())
        };

        if let Some(host_port) = current_host_port {
            let res = self.check_port_health(host_port).await?;
            if res.healthy {
                return Ok(res);
            }
        }

        // Try other ports
        let mut last_res = None;
        for (&container_port, &host_port) in &port_mappings {
            if Some(host_port) == current_host_port {
                continue;
            }
            let res = self.check_port_health(host_port).await?;
            if res.healthy {
                info!(
                    preview_id = %self.preview_id,
                    port = container_port,
                    host_port = host_port,
                    "found healthy container dev server port"
                );
                let mut state = self.state.lock().await;
                state.host_port = Some(host_port);
                return Ok(res);
            }
            last_res = Some(res);
        }

        if let Some(res) = last_res {
            Ok(res)
        } else {
            Ok(HealthCheckResult {
                healthy: false,
                detail: Some("no mapped ports were checked or found healthy".to_string()),
                body_excerpt: None,
            })
        }
    }

    async fn preview_target_url(&self) -> Option<String> {
        let state = self.state.lock().await;
        state
            .host_port
            .map(|port| format!("http://127.0.0.1:{port}"))
    }

    async fn run_compile_check(&self) -> Result<CompileCheckResult, RuntimeServiceError> {
        let (container_name, workspace_host_path) = {
            let state = self.state.lock().await;
            (
                state.container_name.clone().ok_or_else(|| {
                    RuntimeServiceError::infra_runtime("preview container is not started", None)
                })?,
                state.workspace_host_path.clone(),
            )
        };

        if let Some(ref path) = workspace_host_path {
            log_to_workspace(path, "Running compile checks (tsc and build)...").await;
        }

        info!(preview_id = %self.preview_id, name = %container_name, "running compilation checks inside container...");

        // 1. Run typescript compiler check
        let (tsc_exit, tsc_output) = self
            .run_shell(&container_name, "bunx tsc --noEmit")
            .await?;

        // 2. Run bundler build check
        let (build_exit, build_output) = self
            .run_shell(&container_name, "bun run build")
            .await?;

        // 3. Check if dev server is healthy
        let health = self.health_check().await?;

        let compile_success = tsc_exit == 0 && build_exit == 0 && health.healthy;

        if let Some(ref path) = workspace_host_path {
            log_to_workspace(
                path,
                &format!(
                    "Compile check result: success={}\n--- TypeScript compiler check (exit={}) ---\n{}\n--- Bundler build check (exit={}) ---\n{}",
                    compile_success, tsc_exit, tsc_output, build_exit, build_output
                ),
            ).await;
        }

        if compile_success {
            return Ok(CompileCheckResult {
                success: true,
                errors: None,
            });
        }

        let mut errors = String::new();
        if tsc_exit != 0 {
            errors.push_str(&format!("--- TypeScript Type Errors ---\n{}\n", tsc_output));
        }
        if build_exit != 0 {
            errors.push_str(&format!("--- Vite Build Errors ---\n{}\n", build_output));
        }
        if !health.healthy {
            // Read dev server logs if dev server is not healthy
            let (_log_exit, log_output) = self
                .run_shell(&container_name, "cat /workspace/.december/dev-server.log")
                .await
                .unwrap_or((1, "Failed to read dev server logs".to_string()));
            errors.push_str(&format!("--- Dev Server Logs ---\n{}\n", log_output));
        }

        Ok(CompileCheckResult {
            success: false,
            errors: Some(errors),
        })
    }
}

fn contains_compile_error(body: &str) -> bool {
    let normalized = body.to_lowercase();
    normalized.contains("vite error")
        || normalized.contains("failed to resolve import")
        || normalized.contains("internal server error")
}

fn reserve_local_port() -> Result<u16, RuntimeServiceError> {
    let listener = TcpListener::bind(SocketAddr::from(([127, 0, 0, 1], 0))).map_err(|error| {
        RuntimeServiceError::infra_runtime(
            "failed to reserve local preview port",
            Some(error.to_string()),
        )
    })?;

    let port = listener.local_addr().map_err(|error| {
        RuntimeServiceError::infra_runtime(
            "failed to read local preview port",
            Some(error.to_string()),
        )
    })?;

    Ok(port.port())
}

fn trim_output(output: &str) -> String {
    let compact = output.trim();
    if compact.len() <= 1200 {
        return compact.to_string();
    }

    compact[..1200].to_string()
}

async fn log_to_workspace(workspace_path: &Path, message: &str) {
    let now = chrono::Utc::now().to_rfc3339();
    let formatted = format!("[{}] {}\n", now, message);

    // Write/append to logs.txt
    let logs_path = workspace_path.join("logs.txt");
    if let Ok(mut file) = tokio::fs::OpenOptions::new()
        .create(true)
        .append(true)
        .open(&logs_path)
        .await
    {
        use tokio::io::AsyncWriteExt;
        let _ = file.write_all(formatted.as_bytes()).await;
    }

    // Write/append to log.txt
    let log_path = workspace_path.join("log.txt");
    if let Ok(mut file) = tokio::fs::OpenOptions::new()
        .create(true)
        .append(true)
        .open(&log_path)
        .await
    {
        use tokio::io::AsyncWriteExt;
        let _ = file.write_all(formatted.as_bytes()).await;
    }
}
