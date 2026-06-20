import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from './generated/client/index.js'

const connectionString = process.env.DATABASE_URL

if (!connectionString) {
    throw Error('Databse URL is not set')
}

const adapter = new PrismaPg({
    connectionString,
})

export const prisma = new PrismaClient({
    adapter,
})

export * from './generated/client/index.js'
