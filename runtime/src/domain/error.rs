use axum::{
    Json,
    http::StatusCode,
    response::{IntoResponse, Response},
};
use serde::Serialize;
use thiserror::Error;

#[derive(Debug, Clone, Copy, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum PreviewErrorClass {
    TemporaryPartialGeneration,
    StableCompileRuntime,
    DependencyInstall,
    InfraRuntime,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StructuredError {
    pub class: PreviewErrorClass,
    pub code: &'static str,
    pub message: String,
    pub detail: Option<String>,
    pub retryable: bool,
}

#[derive(Debug, Error, Clone)]
pub enum RuntimeServiceError {
    #[error("{message}")]
    TemporaryPartialGeneration {
        message: String,
        detail: Option<String>,
    },
    #[error("{message}")]
    StableCompileRuntime {
        message: String,
        detail: Option<String>,
    },
    #[error("{message}")]
    DependencyInstall {
        message: String,
        detail: Option<String>,
    },
    #[error("{message}")]
    InfraRuntime {
        message: String,
        detail: Option<String>,
    },
    #[error("{0}")]
    NotFound(String),
    #[error("{0}")]
    Unauthorized(String),
}

impl RuntimeServiceError {
    pub fn temporary_partial_generation(
        message: impl Into<String>,
        detail: Option<String>,
    ) -> Self {
        Self::TemporaryPartialGeneration {
            message: message.into(),
            detail,
        }
    }

    pub fn stable_compile_runtime(message: impl Into<String>, detail: Option<String>) -> Self {
        Self::StableCompileRuntime {
            message: message.into(),
            detail,
        }
    }

    pub fn dependency_install(message: impl Into<String>, detail: Option<String>) -> Self {
        Self::DependencyInstall {
            message: message.into(),
            detail,
        }
    }

    pub fn infra_runtime(message: impl Into<String>, detail: Option<String>) -> Self {
        Self::InfraRuntime {
            message: message.into(),
            detail,
        }
    }

    pub fn structured(&self) -> StructuredError {
        match self {
            Self::TemporaryPartialGeneration { message, detail } => StructuredError {
                class: PreviewErrorClass::TemporaryPartialGeneration,
                code: "temporary_partial_generation",
                message: message.clone(),
                detail: detail.clone(),
                retryable: true,
            },
            Self::StableCompileRuntime { message, detail } => StructuredError {
                class: PreviewErrorClass::StableCompileRuntime,
                code: "stable_compile_runtime",
                message: message.clone(),
                detail: detail.clone(),
                retryable: false,
            },
            Self::DependencyInstall { message, detail } => StructuredError {
                class: PreviewErrorClass::DependencyInstall,
                code: "dependency_install",
                message: message.clone(),
                detail: detail.clone(),
                retryable: false,
            },
            Self::InfraRuntime { message, detail } => StructuredError {
                class: PreviewErrorClass::InfraRuntime,
                code: "infra_runtime",
                message: message.clone(),
                detail: detail.clone(),
                retryable: true,
            },
            Self::NotFound(message) => StructuredError {
                class: PreviewErrorClass::InfraRuntime,
                code: "not_found",
                message: message.clone(),
                detail: None,
                retryable: false,
            },
            Self::Unauthorized(message) => StructuredError {
                class: PreviewErrorClass::InfraRuntime,
                code: "unauthorized",
                message: message.clone(),
                detail: None,
                retryable: false,
            },
        }
    }
}

impl IntoResponse for RuntimeServiceError {
    fn into_response(self) -> Response {
        let status = match self {
            Self::NotFound(_) => StatusCode::NOT_FOUND,
            Self::Unauthorized(_) => StatusCode::UNAUTHORIZED,
            Self::TemporaryPartialGeneration { .. } => StatusCode::UNPROCESSABLE_ENTITY,
            Self::StableCompileRuntime { .. }
            | Self::DependencyInstall { .. }
            | Self::InfraRuntime { .. } => StatusCode::INTERNAL_SERVER_ERROR,
        };

        (
            status,
            Json(serde_json::json!({
                "success": false,
                "error": self.structured(),
            })),
        )
            .into_response()
    }
}
