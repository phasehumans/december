import fs from 'fs'
import path from 'path'

import dotenv from 'dotenv'
import { defineConfig } from 'prisma/config'

dotenv.config({
    path: path.resolve(process.cwd(), '../../.env'),
})

let databaseUrl = process.env['DATABASE_URL']

if (databaseUrl && databaseUrl.includes('sslrootcert=')) {
    try {
        const url = new URL(databaseUrl)
        const certParam = url.searchParams.get('sslrootcert')
        if (certParam && !fs.existsSync(certParam)) {
            const candidates = [
                path.resolve(process.cwd(), 'certs/global-bundle.pem'),
                path.resolve(process.cwd(), '../../certs/global-bundle.pem'),
                path.resolve(process.cwd(), '../certs/global-bundle.pem'),
            ]
            const found = candidates.find((p) => fs.existsSync(p))
            if (found) {
                databaseUrl = databaseUrl.replace(certParam, found)
            }
        }
    } catch {
        // Intentionally swallowed: keep original databaseUrl if URL parsing fails
    }
}

export default defineConfig({
    schema: 'prisma/schema.prisma',
    migrations: {
        path: 'prisma/migrations',
    },
    datasource: {
        url: databaseUrl,
    },
})
