use aws_config::{BehaviorVersion, Region};
use aws_sdk_s3::{Client, config::Credentials};

use crate::{
    app::config::ObjectStorageConfig, domain::error::RuntimeServiceError,
    domain::manifest::PreviewManifest,
};

#[derive(Clone)]
pub struct ObjectStorage {
    client: Client,
    bucket: String,
}

impl ObjectStorage {
    pub async fn new(config: ObjectStorageConfig) -> Result<Self, RuntimeServiceError> {
        let credentials = Credentials::new(
            config.access_key_id.clone(),
            config.secret_access_key.clone(),
            None,
            None,
            "phasehumans-runtime",
        );

        let shared = aws_config::defaults(BehaviorVersion::latest())
            .region(Region::new(config.region.clone()))
            .endpoint_url(config.endpoint.clone())
            .credentials_provider(credentials)
            .load()
            .await;

        let s3_config = aws_sdk_s3::config::Builder::from(&shared)
            .force_path_style(config.force_path_style)
            .build();

        Ok(Self {
            client: Client::from_conf(s3_config),
            bucket: config.bucket,
        })
    }

    pub async fn fetch_manifest(&self, key: &str) -> Result<PreviewManifest, RuntimeServiceError> {
        let body = self.fetch_text(key).await?;
        serde_json::from_str::<PreviewManifest>(&body).map_err(|error| {
            RuntimeServiceError::infra_runtime(
                "failed to parse preview manifest",
                Some(error.to_string()),
            )
        })
    }

    pub async fn fetch_text(&self, key: &str) -> Result<String, RuntimeServiceError> {
        let response = self
            .client
            .get_object()
            .bucket(&self.bucket)
            .key(key)
            .send()
            .await
            .map_err(|error| {
                RuntimeServiceError::infra_runtime(
                    "failed to fetch object from storage",
                    Some(error.to_string()),
                )
            })?;

        let collected = response.body.collect().await.map_err(|error| {
            RuntimeServiceError::infra_runtime(
                "failed to read object storage response body",
                Some(error.to_string()),
            )
        })?;

        String::from_utf8(collected.into_bytes().to_vec()).map_err(|error| {
            RuntimeServiceError::infra_runtime(
                "object storage payload is not valid UTF-8",
                Some(error.to_string()),
            )
        })
    }
}
