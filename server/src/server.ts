import dotenv from 'dotenv'
dotenv.config()

import app from './app'
import { ensureStorageBucket } from './config/s3'

const PORT = process.env.PORT || 4000
const ENV = process.env.BUN_ENV

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
