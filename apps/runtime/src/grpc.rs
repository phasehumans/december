use tonic::{transport::Server, Request, Response, Status};

pub mod runtime {
    tonic::include_proto!("december.runtime");
}

use runtime::runtime_service_server::{RuntimeService, RuntimeServiceServer};
use runtime::{CreateVmRequest, CreateVmResponse, DestroyVmRequest, DestroyVmResponse, ExecuteCommandRequest, CommandOutput};
use tokio_stream::wrappers::ReceiverStream;
use tokio::sync::mpsc;

#[derive(Debug, Default)]
pub struct MyRuntimeService {}

#[tonic::async_trait]
impl RuntimeService for MyRuntimeService {
    async fn create_vm(
        &self,
        request: Request<CreateVmRequest>,
    ) -> Result<Response<CreateVmResponse>, Status> {
        let req = request.into_inner();
        println!("Got a request to create VM: {:?}", req);
        
        let fc = crate::sandboxes::firecracker::FirecrackerSandbox::new(
            req.vm_id.clone(),
            std::path::PathBuf::from("/home/chaitanya/code/december/ubuntu-rootfs.ext4"),
            std::path::PathBuf::from("/home/chaitanya/code/december/vmlinux.bin")
        );

        let snapshot_path = fc.create_snapshot().await.map_err(|e| Status::internal(e))?;
        let tap_name = fc.setup_network().await.map_err(|e| Status::internal(e))?;
        
        if !req.workspace_zip_url.is_empty() {
            fc.restore_workspace(&snapshot_path, &req.workspace_zip_url).await.map_err(|e| Status::internal(e))?;
        }

        fc.start(&snapshot_path, &tap_name).await.map_err(|e| Status::internal(e))?;
        
        let reply = CreateVmResponse {
            success: true,
            error_message: String::new(),
        };

        Ok(Response::new(reply))
    }

    async fn destroy_vm(
        &self,
        request: Request<DestroyVmRequest>,
    ) -> Result<Response<DestroyVmResponse>, Status> {
        let req = request.into_inner();
        println!("Got a request to destroy VM: {:?}", req);

        let fc = crate::sandboxes::firecracker::FirecrackerSandbox::new(
            req.vm_id,
            std::path::PathBuf::from("/home/chaitanya/code/december/ubuntu-rootfs.ext4"),
            std::path::PathBuf::from("/home/chaitanya/code/december/vmlinux.bin")
        );

        fc.destroy().await.map_err(|e| Status::internal(e))?;

        let reply = DestroyVmResponse {
            success: true,
        };

        Ok(Response::new(reply))
    }

    type ExecuteCommandStream = ReceiverStream<Result<CommandOutput, Status>>;

    async fn execute_command(
        &self,
        request: Request<ExecuteCommandRequest>,
    ) -> Result<Response<Self::ExecuteCommandStream>, Status> {
        let req = request.into_inner();
        println!("Got a request to execute command on VM {}: {}", req.vm_id, req.command);

        let (tx, rx) = mpsc::channel(4);
        
        let fc = crate::sandboxes::firecracker::FirecrackerSandbox::new(
            req.vm_id,
            std::path::PathBuf::from("/home/chaitanya/code/december/ubuntu-rootfs.ext4"),
            std::path::PathBuf::from("/home/chaitanya/code/december/vmlinux.bin")
        );
        let cmd = req.command;

        tokio::spawn(async move {
            let output = fc.execute_command(&cmd).await.unwrap_or_else(|e| format!("Error: {}", e));
            
            let chunk = CommandOutput {
                chunk: output,
                exit_code: 0,
            };
            let _ = tx.send(Ok(chunk)).await;
        });

        Ok(Response::new(ReceiverStream::new(rx)))
    }

    type StartAgentSessionStream = ReceiverStream<Result<runtime::SidecarEvent, Status>>;

    async fn start_agent_session(
        &self,
        request: Request<runtime::SessionConfig>,
    ) -> Result<Response<Self::StartAgentSessionStream>, Status> {
        let req = request.into_inner();
        let vm_id = req.vm_id.clone();
        println!("Starting agent session for VM {}", vm_id);
        
        let (tx, rx) = mpsc::channel(100);
        
        // Connect to VSOCK Unix socket
        tokio::spawn(async move {
            match crate::vsock_relay::VsockRelay::connect_unix(&vm_id, 50051).await {
                Ok(mut relay) => {
                    // Send config frame
                    let config_json = serde_json::json!({
                        "session_id": req.vm_id,
                        "workspace_directory": req.workspace_directory,
                        "provider_settings": { "id": "openai" },
                        "prompts": { "system": req.prompts.get(0).cloned().unwrap_or_default() }
                    }).to_string();
                    
                    if let Err(e) = relay.send_config(&config_json).await {
                        println!("Failed to send config: {}", e);
                        return;
                    }
                    
                    // Loop and read frames, send to tx
                    loop {
                        match relay.read_frame().await {
                            Ok(payload) => {
                                match serde_json::from_slice::<crate::vsock_relay::WireAgentEvent>(&payload) {
                                    Ok(event) => {
                                        let prost_event = runtime::SidecarEvent {
                                            r#type: event.r#type,
                                            data: event.data.to_string(),
                                        };
                                        let _ = tx.send(Ok(prost_event)).await;
                                    }
                                    Err(e) => {
                                        println!("Failed to parse WireAgentEvent: {}", e);
                                    }
                                }
                            }
                            Err(e) => {
                                println!("Vsock read error: {}", e);
                                break;
                            }
                        }
                    }
                }
                Err(e) => {
                    println!("Failed to connect to VSOCK: {}", e);
                }
            }
        });
        
        Ok(Response::new(ReceiverStream::new(rx)))
    }

    async fn send_control(
        &self,
        _request: Request<runtime::ControlMessage>,
    ) -> Result<Response<runtime::ControlAck>, Status> {
        Err(Status::unimplemented("Not implemented"))
    }

    async fn interrupt_session(
        &self,
        _request: Request<runtime::InterruptRequest>,
    ) -> Result<Response<runtime::InterruptResponse>, Status> {
        Err(Status::unimplemented("Not implemented"))
    }
}

pub async fn start_grpc_server(addr: std::net::SocketAddr) -> Result<(), Box<dyn std::error::Error>> {
    let service = MyRuntimeService::default();

    println!("Runtime gRPC server listening on {}", addr);

    Server::builder()
        .add_service(RuntimeServiceServer::new(service))
        .serve(addr)
        .await?;

    Ok(())
}
