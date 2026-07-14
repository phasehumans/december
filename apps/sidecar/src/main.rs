use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio_vsock::VsockListener;
use std::process::Stdio;
use tokio::process::Command;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    println!("Starting sidecar vsock daemon...");
    
    // Listen on vsock CID: VMADDR_CID_ANY, Port: 50051
    let mut listener = VsockListener::bind(libc::VMADDR_CID_ANY, 50051)?;
    println!("Sidecar listening on vsock port 50051");

    loop {
        let (mut socket, addr) = listener.accept().await?;
        println!("Accepted connection from: {:?}", addr);
        
        tokio::spawn(async move {
            let mut buf = [0; 8192];
            
            // Read incoming agent execution payload
            match socket.read(&mut buf).await {
                Ok(n) if n == 0 => return,
                Ok(n) => {
                    let payload = String::from_utf8_lossy(&buf[0..n]).to_string();
                    println!("Executing payload...");
                    
                    let mut child = Command::new("bash")
                        .arg("-c")
                        .arg(payload)
                        .stdout(Stdio::piped())
                        .stderr(Stdio::piped())
                        .spawn()
                        .expect("failed to spawn bash");

                    let mut stdout = child.stdout.take().expect("failed to get stdout");
                    let mut stdout_buf = [0; 4096];
                    
                    // Stream output back via socket
                    while let Ok(len) = stdout.read(&mut stdout_buf).await {
                        if len == 0 { break; }
                        let _ = socket.write_all(&stdout_buf[0..len]).await;
                    }
                }
                Err(e) => {
                    eprintln!("failed to read from vsock; err = {:?}", e);
                }
            }
        });
    }
}
