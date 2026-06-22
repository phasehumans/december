import app from './app'
import { ensureStorageBucket } from './config/s3'
import { env } from './env'

const PORT = env.PORT
const ENV = env.ENV

await ensureStorageBucket()

app.listen(
    {
        port: PORT,
        hostname: '0.0.0.0',
    },
    () => {
        console.log(`server is listening on PORT ${PORT} in ${ENV} MODE`)
    }
)
