import { createServer } from 'http'

import app from './app'
import { ensureStorageBucket } from './config/s3'
import { env } from './env'
import { initSocket } from './socket'

const PORT = env.PORT
const ENV = env.ENV

await ensureStorageBucket()

const httpServer = createServer(app)
initSocket(httpServer)

httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`server is listening on PORT ${PORT} in ${ENV} MODE`)
})
