use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

use crate::domain::error::StructuredError;

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "PascalCase")]
pub enum PreviewLifecycleState {
    WaitingForRunnableVersion,
    Bootstrapping,
    Installing,
    Starting,
    Healthy,
    Rebuilding,
    Failed,
    Stopped,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum PreviewBackendStatus {
    Ready,
    Rebuilding,
    Failed,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PreviewStatusSnapshot {
    pub preview_id: String,
    pub project_id: String,
    pub state: PreviewLifecycleState,
    pub backend_status: PreviewBackendStatus,
    pub current_version: Option<String>,
    pub healthy_version: Option<String>,
    pub preview_url: Option<String>,
    pub last_error: Option<StructuredError>,
    pub updated_at: DateTime<Utc>,
    #[serde(skip_serializing)]
    pub preview_target_url: Option<String>,
}

impl PreviewStatusSnapshot {
    pub fn new(preview_id: String, project_id: String, preview_url: Option<String>) -> Self {
        Self {
            preview_id,
            project_id,
            state: PreviewLifecycleState::WaitingForRunnableVersion,
            backend_status: PreviewBackendStatus::Rebuilding,
            current_version: None,
            healthy_version: None,
            preview_url,
            last_error: None,
            updated_at: Utc::now(),
            preview_target_url: None,
        }
    }
}

pub fn backend_status_for(state: PreviewLifecycleState) -> PreviewBackendStatus {
    match state {
        PreviewLifecycleState::Healthy => PreviewBackendStatus::Ready,
        PreviewLifecycleState::Failed => PreviewBackendStatus::Failed,
        PreviewLifecycleState::WaitingForRunnableVersion
        | PreviewLifecycleState::Bootstrapping
        | PreviewLifecycleState::Installing
        | PreviewLifecycleState::Starting
        | PreviewLifecycleState::Rebuilding
        | PreviewLifecycleState::Stopped => PreviewBackendStatus::Rebuilding,
    }
}
