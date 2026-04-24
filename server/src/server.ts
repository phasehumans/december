import dotenv from 'dotenv'
dotenv.config()

import app from './app'

const PORT = process.env.PORT || 4000
const ENV = process.env.BUN_ENV

app.listen(
    {
        port: PORT,
        hostname: '0.0.0.0',
    },
    () => {
        console.log(`server is listening on PORT ${PORT} in ${ENV} MODE`)
    }
)
