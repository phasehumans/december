import { prisma } from '../../src/config/db'

export async function cleanDb() {
    await prisma.user.deleteMany()
}

export async function disconnectDb() {
    await prisma.$disconnect()
}

//   bunx dotenv -e .env.test -- bunx prisma migrate deploy >> migration for test_db
