import * as path from 'path'
import * as dotenv from 'dotenv'

if (!process.env.ENV_LOADED) {
    dotenv.config({ path: path.resolve(process.cwd(), '../../.env') })
    process.env.ENV_LOADED = 'true'
}
