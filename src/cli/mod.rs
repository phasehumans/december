use anyhow::Result;
use clap::Parser;

mod args;
use args::Args;

pub async fn run() -> Result<()> {
    let args = Args::parse();

    if let Some(prompt) = args.prompt {
        println!("Prompt received: {}", prompt);
    }

    Ok(())
}