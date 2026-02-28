use anyhow::Result;

mod agent;
mod cli;
mod error;
mod memory;

#[tokio::main]
async fn main() -> Result<()> {
    cli::run().await
}

