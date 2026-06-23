import path from 'path'

import dotenv from 'dotenv'

if (!process.env.ENV_LOADED) {
    dotenv.config({
        path: path.resolve(process.cwd(), '../../.env.test'),
    })
    process.env.ENV_LOADED = 'true'
}
