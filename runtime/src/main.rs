mod actors;
mod app;
mod domain;
mod http;
mod sandboxes;
mod services;

use std::{
    env, fs,
    path::PathBuf,
    sync::Arc,
};

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
    load_runtime_env();

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

fn load_runtime_env() {
    for path in candidate_env_paths() {
        let Ok(contents) = fs::read_to_string(&path) else {
            continue;
        };

        for (key, value) in parse_env_assignments(&contents) {
            if env::var_os(&key).is_none() {
                unsafe {
                    env::set_var(key, value);
                }
            }
        }

        break;
    }
}

fn candidate_env_paths() -> Vec<PathBuf> {
    let mut paths = Vec::new();

    if let Ok(current_dir) = env::current_dir() {
        paths.push(current_dir.join(".env"));

        if let Some(parent) = current_dir.parent() {
            paths.push(parent.join(".env"));
        }
    }

    paths
}

fn parse_env_assignments(contents: &str) -> Vec<(String, String)> {
    contents
        .lines()
        .filter_map(|line| {
            let trimmed = line.trim();
            if trimmed.is_empty() || trimmed.starts_with('#') {
                return None;
            }

            let (raw_key, raw_value) = trimmed.split_once('=')?;
            let key = raw_key.trim();
            if key.is_empty() {
                return None;
            }

            Some((key.to_string(), normalize_env_value(raw_value)))
        })
        .collect()
}

fn normalize_env_value(raw_value: &str) -> String {
    let value = raw_value.trim();

    if value.len() >= 2 {
        let first = value.as_bytes()[0];
        let last = value.as_bytes()[value.len() - 1];
        if (first == b'"' && last == b'"') || (first == b'\'' && last == b'\'') {
            return value[1..value.len() - 1].to_string();
        }
    }

    value.to_string()
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
