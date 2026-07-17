use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::process::Command;
use tokio_vsock::{VsockListener, VsockStream};
use std::process::Stdio;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    // Listen on vsock port 50051 (VMADDR_CID_ANY)
    let mut listener = VsockListener::bind(libc::VMADDR_CID_ANY, 50051)?;
    println!("Listening on vsock port 50051...");

    while let Ok((mut stream, _addr)) = listener.accept().await {
        tokio::spawn(async move {
            if let Err(e) = handle_connection(stream).await {
                eprintln!("Connection error: {}", e);
            }
        });
    }
    
    Ok(())
}

async fn handle_connection(mut stream: VsockStream) -> Result<(), Box<dyn std::error::Error>> {
    // Read the first frame (config)
    let len = stream.read_u32().await?;
    let mut config_buf = vec![0u8; len as usize];
    stream.read_exact(&mut config_buf).await?;

    // Spawn december-agent
    let mut child = Command::new("december-agent")
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()?;

    let mut child_stdin = child.stdin.take().unwrap();
    let mut child_stdout = child.stdout.take().unwrap();
    
    // Send the config as the first frame to the agent's stdin
    child_stdin.write_u32(len).await?;
    child_stdin.write_all(&config_buf).await?;
    child_stdin.flush().await?;

    // We split vsock stream and pipe to/from the agent
    let (mut read_stream, mut write_stream) = tokio::io::split(stream);

    let pipe_stdin = tokio::spawn(async move {
        tokio::io::copy(&mut read_stream, &mut child_stdin).await
    });

    let pipe_stdout = tokio::spawn(async move {
        tokio::io::copy(&mut child_stdout, &mut write_stream).await
    });

    tokio::select! {
        _ = child.wait() => {
            println!("Agent exited");
        }
        _ = pipe_stdin => {}
        _ = pipe_stdout => {}
    }

    Ok(())
}
