import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '@prisma/client'

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

export * from '@prisma/client'
