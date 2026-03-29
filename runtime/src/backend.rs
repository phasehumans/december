use std::sync::Arc;

use reqwest::Client;
use serde::Serialize;
use tracing::warn;

use crate::{
    config::BackendCallbackConfig,
    error::RuntimeServiceError,
    state::{PreviewBackendStatus, PreviewStatusSnapshot},
};

#[derive(Clone)]
pub struct BackendCallbackClient {
    client: Client,
    config: Arc<BackendCallbackConfig>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct BackendStatusPayload<'a> {
    preview_id: &'a str,
    project_id: &'a str,
    status: PreviewBackendStatus,
    state: &'a crate::state::PreviewLifecycleState,
    current_version: Option<&'a str>,
    healthy_version: Option<&'a str>,
    preview_url: Option<&'a str>,
    error: Option<&'a crate::error::StructuredError>,
    updated_at: chrono::DateTime<chrono::Utc>,
}

impl BackendCallbackClient {
    pub fn new(config: BackendCallbackConfig) -> Self {
        Self {
            client: Client::new(),
            config: Arc::new(config),
        }
    }

    pub async fn report_status(
        &self,
        snapshot: &PreviewStatusSnapshot,
    ) -> Result<(), RuntimeServiceError> {
        let url = format!(
            "{}/api/v1/runtime/previews/{}/callback",
            self.config.base_url, snapshot.preview_id
        );

        let mut request = self.client.post(url).json(&BackendStatusPayload {
            preview_id: &snapshot.preview_id,
            project_id: &snapshot.project_id,
            status: snapshot.backend_status,
            state: &snapshot.state,
            current_version: snapshot.current_version.as_deref(),
            healthy_version: snapshot.healthy_version.as_deref(),
            preview_url: snapshot.preview_url.as_deref(),
            error: snapshot.last_error.as_ref(),
            updated_at: snapshot.updated_at,
        });

        if let Some(secret) = &self.config.secret {
            request = request.header("x-phasehumans-runtime-secret", secret);
        }

        let response = request.send().await.map_err(|error| {
            RuntimeServiceError::infra_runtime(
                "backend callback request failed",
                Some(error.to_string()),
            )
        })?;

        if !response.status().is_success() {
            let body = response.text().await.unwrap_or_default();
            warn!(
                status = %response.status(),
                body = %body,
                "backend callback returned non-success status"
            );
        }

        Ok(())
    }
}
