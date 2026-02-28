use anyhow::Result;
use clap::Parser;
use tokio::io::{self, AsyncBufReadExt, AsyncWriteExt, BufReader};

mod args;
use args::{Args, Command};

use crate::agent::CodingAgent;

pub async fn run() -> Result<()> {
    let args = Args::parse();
    let mut agent = CodingAgent::new();
    let command = args.command.unwrap_or(Command::Chat);

    match command {
        Command::Run { prompt } => {
            let prompt = prompt.join(" ");
            let response = agent.respond(&prompt).await?;
            println!("{response}");
        }
        Command::Chat => run_chat(&mut agent).await?,
    }

    Ok(())
}

async fn run_chat(agent: &mut CodingAgent) -> Result<()> {
    println!("December interactive mode");
    println!("Commands: /help, /history, /exit");

    let stdin = BufReader::new(io::stdin());
    let mut lines = stdin.lines();
    let mut stdout = io::stdout();

    loop {
        stdout.write_all(b"\n> ").await?;
        stdout.flush().await?;

        let Some(line) = lines.next_line().await? else {
            break;
        };

        let input = line.trim();
        if input.is_empty() {
            continue;
        }

        match input {
            "/exit" | "/quit" => break,
            "/help" => {
                println!("Enter a coding task in plain language.");
                println!("/history shows the latest transcript.");
                println!("/exit quits.");
                continue;
            }
            "/history" => {
                let transcript = agent.history(10);
                if transcript.is_empty() {
                    println!("No conversation yet.");
                } else {
                    println!("{transcript}");
                }
                continue;
            }
            _ => {}
        }

        match agent.respond(input).await {
            Ok(reply) => println!("{reply}"),
            Err(err) => eprintln!("error: {err}"),
        }
    }

    Ok(())
}
