import './env'
import app from './app'
import { ensureStorageBucket } from './config/s3'

const PORT = process.env.PORT
const ENV = process.env.ENV

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
