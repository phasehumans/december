use std::sync::Arc;

use axum::{
    Json, Router,
    extract::{Path, State},
    http::HeaderMap,
    response::{Html, IntoResponse, Redirect},
    routing::{delete, get, post},
};
use serde::{Deserialize, Serialize};
use tracing::warn;

use crate::{
    actors::registry::ActorRegistry,
    app::{config::AppConfig, state::PreviewStatusSnapshot},
    domain::{error::RuntimeServiceError, manifest::ManifestRef},
};

#[derive(Clone)]
pub struct AppState {
    pub registry: ActorRegistry,
    pub config: Arc<AppConfig>,
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

pub fn build_router(app_state: AppState) -> Router {
    Router::new()
        .route("/healthz", get(health_check))
        .route("/previews/start", post(start_preview))
        .route("/previews/:id/manifest-published", post(manifest_published))
        .route("/previews/:id/status", get(get_preview_status))
        .route("/previews/:id/display", get(display_preview))
        .route("/previews/:id", delete(delete_preview))
        .with_state(app_state)
}

async fn health_check() -> impl IntoResponse {
    Json(serde_json::json!({
        "success": true,
        "data": { "ok": true }
    }))
}

async fn start_preview(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(body): Json<StartPreviewRequest>,
) -> Result<Json<ApiEnvelope<PreviewStatusSnapshot>>, RuntimeServiceError> {
    ensure_internal_auth(&state.config, &headers)?;

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
    headers: HeaderMap,
    Path(id): Path<String>,
    Json(body): Json<ManifestPublishedRequest>,
) -> Result<Json<ApiEnvelope<PreviewStatusSnapshot>>, RuntimeServiceError> {
    ensure_internal_auth(&state.config, &headers)?;

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
    headers: HeaderMap,
    Path(id): Path<String>,
) -> Result<Json<ApiEnvelope<PreviewStatusSnapshot>>, RuntimeServiceError> {
    ensure_internal_auth(&state.config, &headers)?;

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
    headers: HeaderMap,
    Path(id): Path<String>,
) -> Result<Json<ApiEnvelope<serde_json::Value>>, RuntimeServiceError> {
    ensure_internal_auth(&state.config, &headers)?;
    state.registry.delete(&id).await?;

    Ok(Json(ApiEnvelope {
        success: true,
        data: serde_json::json!({ "deleted": true }),
    }))
}

fn ensure_internal_auth(
    config: &AppConfig,
    headers: &HeaderMap,
) -> Result<(), RuntimeServiceError> {
    let Some(expected_secret) = &config.shared_secret else {
        return Ok(());
    };

    let provided_secret = headers
        .get("x-phasehumans-runtime-secret")
        .and_then(|value| value.to_str().ok());

    if provided_secret == Some(expected_secret.as_str()) {
        return Ok(());
    }

    Err(RuntimeServiceError::Unauthorized(
        "missing or invalid runtime shared secret".to_string(),
    ))
}
