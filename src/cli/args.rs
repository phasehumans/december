use clap::Parser;

#[derive(Parser, Debug)]
#[command(name = "december")]
#[command(about = "Deterministic coding agent")]
pub struct Args {
    #[arg(short, long)]
    pub prompt: Option<String>,
}