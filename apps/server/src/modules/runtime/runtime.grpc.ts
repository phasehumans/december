import * as grpc from '@grpc/grpc-js'
import * as protoLoader from '@grpc/proto-loader'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const PROTO_PATH = path.resolve(__dirname, '../../../../../../packages/proto/runtime.proto')

const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
    keepCase: true,
    longs: String,
    enums: String,
    defaults: true,
    oneofs: true,
})

const protoDescriptor = grpc.loadPackageDefinition(packageDefinition) as any
const runtimeProto = protoDescriptor.december.runtime

const runtimeGrpcEndpoint = process.env.RUNTIME_GRPC_ENDPOINT || 'localhost:50051'

export const runtimeGrpcClient = new runtimeProto.RuntimeService(
    runtimeGrpcEndpoint,
    grpc.credentials.createInsecure()
)
