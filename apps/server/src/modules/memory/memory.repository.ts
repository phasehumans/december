import { prisma } from '@december/database'

export const memoryRepository = {
    async upsertSessionMemory(data: { sessionId: string; key: string; value: string }) {
        const { sessionId, key, value } = data
        return prisma.sessionMemory.upsert({
            where: {
                sessionId_key: {
                    sessionId,
                    key,
                },
            },
            update: {
                value,
            },
            create: {
                sessionId,
                key,
                value,
            },
        })
    },

    async findSessionMemories(sessionId: string) {
        return prisma.sessionMemory.findMany({
            where: { sessionId },
            select: { key: true, value: true },
            orderBy: { key: 'asc' },
        })
    },
}
