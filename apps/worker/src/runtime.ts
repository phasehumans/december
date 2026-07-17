import * as grpc from '@grpc/grpc-js'
import * as protoLoader from '@grpc/proto-loader'
import path from 'path'

const PROTO_PATH = path.resolve(__dirname, '../../../packages/proto/runtime.proto')

const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
    keepCase: true,
    longs: String,
    enums: String,
    defaults: true,
    oneofs: true,
})

const runtimeProto = grpc.loadPackageDefinition(packageDefinition).december as any
const runtimeService = runtimeProto.runtime.RuntimeService

// Assumes the Rust VMM daemon runs on localhost:50051 on the host machine
const client = new runtimeService('localhost:50051', grpc.credentials.createInsecure())

export async function createVM(vmId: string, workspaceZipUrl?: string): Promise<boolean> {
    return new Promise((resolve, reject) => {
        client.CreateVM(
            { vm_id: vmId, workspace_zip_url: workspaceZipUrl || '' },
            (err: any, response: any) => {
                if (err) return reject(err)
                if (!response.success) return reject(new Error(response.error_message))
                resolve(true)
            }
        )
    })
}

export async function destroyVM(vmId: string): Promise<boolean> {
    return new Promise((resolve, reject) => {
        client.DestroyVM({ vm_id: vmId }, (err: any, response: any) => {
            if (err) return reject(err)
            resolve(response.success)
        })
    })
}

export function startAgentSession(
    sessionId: string,
    workspaceDir: string,
    systemPrompt: string,
    token: string,
    apiHostUrl: string
): any {
    const config = {
        vm_id: sessionId,
        workspace_directory: workspaceDir,
        prompts: [systemPrompt],
        provider_settings: JSON.stringify({ id: 'openai' }),
        temp_jwt_token: token,
        api_host_url: apiHostUrl,
    }
    const call = client.StartAgentSession(config)
    return call
}

export function executeCommand(
    vmId: string,
    command: string,
    onData: (chunk: string) => void
): Promise<number> {
    return new Promise((resolve, reject) => {
        const call = client.ExecuteCommand({ vm_id: vmId, command })

        call.on('data', (response: any) => {
            if (response.chunk) {
                onData(response.chunk)
            }
            if (response.exit_code !== undefined && response.exit_code !== 0 && !response.chunk) {
                resolve(response.exit_code)
            }
        })

        call.on('end', () => {
            resolve(0) // Default success exit code if stream ends normally
        })

        call.on('error', (err: any) => {
            reject(err)
        })
    })
}
