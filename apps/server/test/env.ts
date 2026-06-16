// import { config } from 'dotenv'
// config({ path: './server/.env.test' })

import dotenv from 'dotenv'
import path from 'path'

dotenv.config({
    path: path.resolve(process.cwd(), '../../.env.test'),
})
