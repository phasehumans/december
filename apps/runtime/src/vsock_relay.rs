use tokio::net::UnixStream;
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use bytes::{BytesMut, Buf};
use tracing::{info, error};
use serde::{Deserialize, Serialize};
use std::path::Path;

#[derive(Debug, Serialize, Deserialize)]
pub struct WireAgentEvent {
    pub r#type: String,
    pub data: serde_json::Value,
}

pub struct VsockRelay {
    pub stream: UnixStream,
}

impl VsockRelay {
    pub async fn connect_unix(vm_id: &str, port: u32) -> Result<Self, String> {
        let sock_path = format!("/tmp/fc-{}.vsock", vm_id);
        
        // Wait for socket to exist
        let mut retries = 0;
        while !Path::new(&sock_path).exists() && retries < 20 {
            tokio::time::sleep(tokio::time::Duration::from_millis(100)).await;
            retries += 1;
        }

        let mut stream = UnixStream::connect(&sock_path).await.map_err(|e| e.to_string())?;
        
        // Firecracker VSOCK host-side protocol
        let connect_cmd = format!("CONNECT {}\n", port);
        stream.write_all(connect_cmd.as_bytes()).await.map_err(|e| e.to_string())?;
        stream.flush().await.map_err(|e| e.to_string())?;
        
        // Read "OK\n" or "ERR\n"
        let mut response = [0u8; 3];
        stream.read_exact(&mut response).await.map_err(|e| e.to_string())?;
        if &response[0..2] != b"OK" {
            return Err("Failed to connect via Firecracker vsock".to_string());
        }

        Ok(Self { stream })
    }

    pub async fn send_frame(&mut self, payload: &[u8]) -> Result<(), String> {
        let len = payload.len() as u32;
        self.stream.write_u32(len).await.map_err(|e| e.to_string())?;
        self.stream.write_all(payload).await.map_err(|e| e.to_string())?;
        self.stream.flush().await.map_err(|e| e.to_string())?;
        Ok(())
    }

    pub async fn read_frame(&mut self) -> Result<Vec<u8>, String> {
        let len = self.stream.read_u32().await.map_err(|e| e.to_string())?;
        let mut buf = vec![0u8; len as usize];
        self.stream.read_exact(&mut buf).await.map_err(|e| e.to_string())?;
        Ok(buf)
    }

    pub async fn send_config(&mut self, config_json: &str) -> Result<(), String> {
        self.send_frame(config_json.as_bytes()).await
    }
}
