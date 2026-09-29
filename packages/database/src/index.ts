import fs from 'fs'
import path from 'path'

import { PrismaPg } from '@prisma/adapter-pg'

import { PrismaClient } from './generated/client/index.js'

let connectionString = process.env.DATABASE_URL || process.env.TEST_DATABASE_URL

if (!connectionString) {
    throw Error('Database URL is not set (neither DATABASE_URL nor TEST_DATABASE_URL)')
}

if (connectionString.includes('sslrootcert=')) {
    try {
        const url = new URL(connectionString)
        const certParam = url.searchParams.get('sslrootcert')
        if (certParam && !fs.existsSync(certParam)) {
            const candidates = [
                path.resolve(process.cwd(), 'certs/global-bundle.pem'),
                path.resolve(process.cwd(), '../../certs/global-bundle.pem'),
                path.resolve(process.cwd(), '../certs/global-bundle.pem'),
            ]
            const found = candidates.find((p) => fs.existsSync(p))
            if (found) {
                connectionString = connectionString.replace(certParam, found)
            }
        }
    } catch {
        // Intentionally swallowed: keep original connectionString if URL parsing fails
    }
}

const adapter = new PrismaPg({
    connectionString,
})

export const prisma = new PrismaClient({
    adapter,
})

export * from './generated/client/index.js'
