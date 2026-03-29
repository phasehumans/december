mod actor;
mod backend;
mod config;
mod error;
mod manifest;
mod registry;
mod sandbox;
mod state;
mod storage;
mod workspace;

use std::sync::Arc;

use axum::{
    Json, Router,
    extract::{Path, State},
    response::{Html, IntoResponse, Redirect},
    routing::{delete, get, post},
};
use serde::{Deserialize, Serialize};
use tracing::{info, warn};
use tracing_subscriber::{EnvFilter, layer::SubscriberExt, util::SubscriberInitExt};

use crate::{
    config::AppConfig,
    error::RuntimeServiceError,
    manifest::ManifestRef,
    registry::ActorRegistry,
    state::PreviewStatusSnapshot,
    storage::ObjectStorage,
};

#[derive(Clone)]
struct AppState {
    registry: ActorRegistry,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct StartPreviewRequest {
    preview_id: String,
    project_id: String,
    initial_manifest: Option<ManifestRef>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ManifestPublishedRequest {
    project_id: String,
    manifest: ManifestRef,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct ApiEnvelope<T> {
    success: bool,
    data: T,
}

#[tokio::main]
async fn main() -> Result<(), RuntimeServiceError> {
    tracing_subscriber::registry()
        .with(
            EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| EnvFilter::new("runtime=info,axum=info")),
        )
        .with(tracing_subscriber::fmt::layer())
        .init();

    let config = Arc::new(AppConfig::from_env()?);
    let storage = ObjectStorage::new(config.s3.clone()).await?;
    let backend = crate::backend::BackendCallbackClient::new(config.backend_callback.clone());
    let registry = ActorRegistry::new(config.clone(), storage, backend);
    let app_state = AppState { registry };

    let app = Router::new()
        .route("/healthz", get(health_check))
        .route("/previews/start", post(start_preview))
        .route("/previews/:id/manifest-published", post(manifest_published))
        .route("/previews/:id/status", get(get_preview_status))
        .route("/previews/:id/display", get(display_preview))
        .route("/previews/:id", delete(delete_preview))
        .with_state(app_state);

    let listener = tokio::net::TcpListener::bind(config.bind_addr)
        .await
        .map_err(|error| {
            RuntimeServiceError::infra_runtime(
                "failed to bind runtime HTTP listener",
                Some(error.to_string()),
            )
        })?;

    info!(addr = %config.bind_addr, "preview runtime listening");
    axum::serve(listener, app).await.map_err(|error| {
        RuntimeServiceError::infra_runtime("runtime HTTP server exited", Some(error.to_string()))
    })
}

async fn health_check() -> impl IntoResponse {
    Json(serde_json::json!({
        "success": true,
        "data": { "ok": true }
    }))
}

async fn start_preview(
    State(state): State<AppState>,
    Json(body): Json<StartPreviewRequest>,
) -> Result<Json<ApiEnvelope<PreviewStatusSnapshot>>, RuntimeServiceError> {
    let snapshot = state
        .registry
        .start_or_update(body.preview_id, body.project_id, body.initial_manifest)
        .await?;

    Ok(Json(ApiEnvelope {
        success: true,
        data: snapshot,
    }))
}

async fn manifest_published(
    State(state): State<AppState>,
    Path(id): Path<String>,
    Json(body): Json<ManifestPublishedRequest>,
) -> Result<Json<ApiEnvelope<PreviewStatusSnapshot>>, RuntimeServiceError> {
    let snapshot = state
        .registry
        .publish_manifest(id, body.project_id, body.manifest)
        .await?;

    Ok(Json(ApiEnvelope {
        success: true,
        data: snapshot,
    }))
}

async fn get_preview_status(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> Result<Json<ApiEnvelope<PreviewStatusSnapshot>>, RuntimeServiceError> {
    let snapshot = state.registry.status(&id).await?;

    Ok(Json(ApiEnvelope {
        success: true,
        data: snapshot,
    }))
}

async fn display_preview(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> Result<impl IntoResponse, RuntimeServiceError> {
    let snapshot = state.registry.status(&id).await?;

    if let Some(target_url) = snapshot.preview_target_url {
        return Ok(Redirect::temporary(&target_url).into_response());
    }

    warn!(preview_id = %id, "preview display requested before target URL was ready");
    Ok(Html(
        r#"<!doctype html><html><body style="font-family: sans-serif; padding: 24px; background: #111; color: #eee;"><h1>Preview is starting</h1><p>The preview session exists but the dev server is not ready yet.</p></body></html>"#,
    )
    .into_response())
}

async fn delete_preview(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> Result<Json<ApiEnvelope<serde_json::Value>>, RuntimeServiceError> {
    state.registry.delete(&id).await?;

    Ok(Json(ApiEnvelope {
        success: true,
        data: serde_json::json!({ "deleted": true }),
    }))
}
