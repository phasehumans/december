pub mod docker;

use std::path::Path;

use async_trait::async_trait;

use crate::domain::error::RuntimeServiceError;

#[derive(Debug, Clone)]
pub struct HealthCheckResult {
    pub healthy: bool,
    pub detail: Option<String>,
    pub body_excerpt: Option<String>,
}

#[async_trait]
pub trait Sandbox: Send + Sync {
    async fn ensure_started(&self, workspace_host_path: &Path) -> Result<(), RuntimeServiceError>;
    async fn install_dependencies(&self) -> Result<(), RuntimeServiceError>;
    async fn restart_dev_server(&self) -> Result<(), RuntimeServiceError>;
    async fn stop(&self) -> Result<(), RuntimeServiceError>;
    async fn health_check(&self) -> Result<HealthCheckResult, RuntimeServiceError>;
    async fn preview_target_url(&self) -> Option<String>;
}
