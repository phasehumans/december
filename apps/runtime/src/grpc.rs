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
