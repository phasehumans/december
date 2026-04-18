use std::{
    collections::HashMap,
    net::{SocketAddr, TcpListener},
    path::{Path, PathBuf},
    sync::Arc,
};

use async_trait::async_trait;
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
    sandboxes::{HealthCheckResult, Sandbox},
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
                while let Some(message) = logs.try_next().await.map_err(|error| {
                    RuntimeServiceError::infra_runtime(
                        "failed to stream Docker exec output",
                        Some(error.to_string()),
                    )
                })? {
                    output.push_str(&message.to_string());
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
                "if [ -f /workspace/.phasehumans/dev-server.pid ]; then kill $(cat /workspace/.phasehumans/dev-server.pid) >/dev/null 2>&1 || true; rm -f /workspace/.phasehumans/dev-server.pid; fi",
            )
            .await?;
        Ok(())
    }

    async fn ensure_image_available(&self) -> Result<(), RuntimeServiceError> {
        match self.docker.inspect_image(&self.config.image).await {
            Ok(_) => Ok(()),
            Err(BollardError::DockerResponseServerError { status_code: 404, .. }) => {
                self.docker
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
                    })
            }
            Err(error) => Err(RuntimeServiceError::infra_runtime(
                "failed to inspect preview image",
                Some(error.to_string()),
            )),
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

        let host_port = reserve_local_port()?;
        let container_name = self.container_name();
        self.ensure_image_available().await?;
        let workspace = workspace_host_path.canonicalize().map_err(|error| {
            RuntimeServiceError::infra_runtime(
                "failed to resolve workspace path",
                Some(error.to_string()),
            )
        })?;

        let mut port_bindings = HashMap::new();
        port_bindings.insert(
            format!("{}/tcp", self.config.container_port),
            Some(vec![PortBinding {
                host_ip: Some("127.0.0.1".to_string()),
                host_port: Some(host_port.to_string()),
            }]),
        );

        let mut exposed_ports = HashMap::new();
        exposed_ports.insert(
            format!("{}/tcp", self.config.container_port),
            HashMap::new(),
        );

        if self
            .docker
            .inspect_container(
                &container_name,
                None::<bollard::query_parameters::InspectContainerOptions>,
            )
            .await
            .is_ok()
        {
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
                        binds: Some(vec![format!(
                            "{}:{}",
                            workspace.display(),
                            self.config.workdir_in_container
                        )]),
                        port_bindings: Some(port_bindings),
                        auto_remove: Some(true),
                        ..Default::default()
                    }),
                    exposed_ports: Some(exposed_ports),
                    cmd: Some(vec![
                        "sh".to_string(),
                        "-lc".to_string(),
                        "mkdir -p /workspace/.phasehumans && while sleep 3600; do :; done"
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

        self.docker
            .start_container(&container_name, None::<StartContainerOptions<String>>)
            .await
            .map_err(|error| {
                RuntimeServiceError::infra_runtime(
                    "failed to start preview container",
                    Some(error.to_string()),
                )
            })?;

        state.container_name = Some(container_name);
        state.host_port = Some(host_port);
        state.workspace_host_path = Some(workspace);
        Ok(())
    }

    async fn install_dependencies(&self) -> Result<(), RuntimeServiceError> {
        let container_name = {
            let state = self.state.lock().await;
            state.container_name.clone().ok_or_else(|| {
                RuntimeServiceError::infra_runtime("preview container is not started", None)
            })?
        };

        let (exit_code, output) = self
            .run_shell(
                &container_name,
                "cd /workspace && bun install --no-progress",
            )
            .await?;

        if exit_code != 0 {
            return Err(RuntimeServiceError::dependency_install(
                "dependency installation failed",
                Some(trim_output(&output)),
            ));
        }

        Ok(())
    }

    async fn restart_dev_server(&self) -> Result<(), RuntimeServiceError> {
        let container_name = {
            let state = self.state.lock().await;
            state.container_name.clone().ok_or_else(|| {
                RuntimeServiceError::infra_runtime("preview container is not started", None)
            })?
        };

        self.stop_dev_server_process(&container_name).await?;

        let (exit_code, output) = self
            .run_shell(
                &container_name,
                "mkdir -p /workspace/.phasehumans && cd /workspace && nohup bun run dev --host 0.0.0.0 --port 4173 > /workspace/.phasehumans/dev-server.log 2>&1 & echo $! > /workspace/.phasehumans/dev-server.pid",
            )
            .await?;

        if exit_code != 0 {
            return Err(RuntimeServiceError::stable_compile_runtime(
                "failed to start preview dev server",
                Some(trim_output(&output)),
            ));
        }

        Ok(())
    }

    async fn stop(&self) -> Result<(), RuntimeServiceError> {
        let state = self.state.lock().await;
        if let Some(container_name) = &state.container_name {
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
        Ok(())
    }

    async fn health_check(&self) -> Result<HealthCheckResult, RuntimeServiceError> {
        let target_url = self.preview_target_url().await.ok_or_else(|| {
            RuntimeServiceError::infra_runtime("preview target URL is unavailable", None)
        })?;

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

    async fn preview_target_url(&self) -> Option<String> {
        let state = self.state.lock().await;
        state
            .host_port
            .map(|port| format!("http://127.0.0.1:{port}"))
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
