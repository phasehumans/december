mod actors;
mod app;
mod domain;
mod http;
mod sandboxes;
mod services;

use std::sync::Arc;

use tracing::info;
use tracing_subscriber::{EnvFilter, layer::SubscriberExt, util::SubscriberInitExt};

use crate::{
    actors::registry::ActorRegistry,
    app::config::AppConfig,
    domain::error::RuntimeServiceError,
    http::{AppState, build_router},
    services::{backend::BackendCallbackClient, storage::ObjectStorage},
};

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
    let backend = BackendCallbackClient::new(config.backend_callback.clone());
    let registry = ActorRegistry::new(config.clone(), storage, backend);
    let app_state = AppState {
        registry,
        config: config.clone(),
    };
    let app = build_router(app_state);

    let listener = tokio::net::TcpListener::bind(config.bind_addr)
        .await
        .map_err(|error| {
            RuntimeServiceError::infra_runtime(
                "failed to bind runtime HTTP listener",
                Some(error.to_string()),
            )
        })?;

    info!(addr = %config.bind_addr, "preview runtime listening");
    axum::serve(listener, app)
        .with_graceful_shutdown(shutdown_signal())
        .await
        .map_err(|error| {
            RuntimeServiceError::infra_runtime(
                "runtime HTTP server exited",
                Some(error.to_string()),
            )
        })
}

async fn shutdown_signal() {
    let ctrl_c = async {
        let _ = tokio::signal::ctrl_c().await;
    };

    #[cfg(unix)]
    let terminate = async {
        let mut signal = tokio::signal::unix::signal(tokio::signal::unix::SignalKind::terminate())
            .expect("install SIGTERM handler");
        signal.recv().await;
    };

    #[cfg(not(unix))]
    let terminate = std::future::pending::<()>();

    tokio::select! {
        _ = ctrl_c => {},
        _ = terminate => {},
    }
}
