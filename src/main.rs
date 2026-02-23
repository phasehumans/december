use anyhow::Result;

mod cli;
mod agent;
mod memory;
mod error;

#[tokio::main]
async fn main() -> Result<()> {
    cli::run().await?;
    Ok(())
}