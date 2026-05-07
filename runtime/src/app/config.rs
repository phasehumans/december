use std::{env, net::SocketAddr, path::PathBuf, time::Duration};

use crate::domain::error::RuntimeServiceError;

#[derive(Clone, Debug)]
pub struct AppConfig {
    pub bind_addr: SocketAddr,
    pub public_base_url: String,
    pub workspace_root: PathBuf,
    pub shared_secret: Option<String>,
    pub health_poll_interval: Duration,
    pub health_startup_attempts: u32,
    pub cleanup_workspace_on_stop: bool,
    pub s3: ObjectStorageConfig,
    pub backend_callback: BackendCallbackConfig,
    pub docker: DockerConfig,
}

#[derive(Clone, Debug)]
pub struct ObjectStorageConfig {
    pub bucket: String,
    pub endpoint: String,
    pub region: String,
    pub access_key_id: String,
    pub secret_access_key: String,
    pub force_path_style: bool,
}

#[derive(Clone, Debug)]
pub struct BackendCallbackConfig {
    pub base_url: String,
    pub secret: Option<String>,
}

#[derive(Clone, Debug)]
pub struct DockerConfig {
    pub image: String,
    pub container_prefix: String,
    pub workdir_in_container: String,
    pub container_port: u16,
}

impl AppConfig {
    pub fn from_env() -> Result<Self, RuntimeServiceError> {
        let bind_addr = env::var("RUNTIME_BIND_ADDR")
            .unwrap_or_else(|_| "0.0.0.0:5050".to_string())
            .parse::<SocketAddr>()
            .map_err(|error| {
                RuntimeServiceError::infra_runtime(
                    "invalid runtime bind address",
                    Some(error.to_string()),
                )
            })?;

        let public_base_url = env::var("RUNTIME_PUBLIC_BASE_URL")
            .unwrap_or_else(|_| format!("http://localhost:{}", bind_addr.port()));

        let workspace_root = env::var("RUNTIME_WORKSPACE_ROOT")
            .map(PathBuf::from)
            .unwrap_or_else(|_| PathBuf::from("./data/workspaces"));

        let shared_secret = env::var("RUNTIME_SHARED_SECRET").ok();
        let health_poll_interval = Duration::from_millis(
            env::var("RUNTIME_HEALTH_POLL_INTERVAL_MS")
                .ok()
                .and_then(|value| value.parse::<u64>().ok())
                .unwrap_or(5_000),
        );
        let health_startup_attempts = env::var("RUNTIME_HEALTH_STARTUP_ATTEMPTS")
            .ok()
            .and_then(|value| value.parse::<u32>().ok())
            .unwrap_or(30);
        let cleanup_workspace_on_stop = env::var("RUNTIME_CLEANUP_WORKSPACE_ON_STOP")
            .map(|value| value.eq_ignore_ascii_case("true"))
            .unwrap_or(false);

        let s3 = ObjectStorageConfig {
            bucket: env::var("S3_BUCKET").unwrap_or_else(|_| "december".to_string()),
            endpoint: env::var("S3_ENDPOINT")
                .unwrap_or_else(|_| "http://127.0.0.1:9000".to_string()),
            region: env::var("S3_REGION").unwrap_or_else(|_| "us-east-1".to_string()),
            access_key_id: env::var("S3_ACCESS_KEY")
                .unwrap_or_else(|_| "decemberadmin".to_string()),
            secret_access_key: env::var("S3_SECRET_KEY")
                .unwrap_or_else(|_| "minio@2004".to_string()),
            force_path_style: env::var("S3_FORCE_PATH_STYLE")
                .map(|value| value.eq_ignore_ascii_case("true"))
                .unwrap_or(true),
        };

        let backend_callback = BackendCallbackConfig {
            base_url: env::var("BACKEND_CALLBACK_BASE_URL")
                .unwrap_or_else(|_| "http://127.0.0.1:4000".to_string()),
            secret: shared_secret.clone(),
        };

        let docker = DockerConfig {
            image: env::var("PREVIEW_DOCKER_IMAGE").unwrap_or_else(|_| "oven/bun:1".to_string()),
            container_prefix: env::var("PREVIEW_DOCKER_CONTAINER_PREFIX")
                .unwrap_or_else(|_| "december-preview".to_string()),
            workdir_in_container: "/workspace".to_string(),
            container_port: 4173,
        };

        Ok(Self {
            bind_addr,
            public_base_url: public_base_url.trim_end_matches('/').to_string(),
            workspace_root,
            shared_secret,
            health_poll_interval,
            health_startup_attempts,
            cleanup_workspace_on_stop,
            s3,
            backend_callback,
            docker,
        })
    }
}
