use clap::{Parser, Subcommand};

#[derive(Parser, Debug)]
#[command(name = "december", version, about = "Coding agent inside your terminal")]
pub struct Args {
    #[command(subcommand)]
    pub command: Option<Command>,
}

#[derive(Subcommand, Debug, Clone)]
pub enum Command {
    /// Run one prompt and exit.
    Run {
        #[arg(required = true)]
        prompt: Vec<String>,
    },
    /// Start an interactive coding-agent chat.
    Chat,
}
