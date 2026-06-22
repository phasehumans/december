import { prisma } from '@december/database'

export const memoryRepository = {
    async upsertProjectMemory(data: { projectId: string; key: string; value: string }) {
        const { projectId, key, value } = data
        return prisma.projectMemory.upsert({
            where: {
                projectId_key: {
                    projectId,
                    key,
                },
            },
            update: {
                value,
            },
            create: {
                projectId,
                key,
                value,
            },
        })
    },

    async findUserDesignPreference(userId: string) {
        return prisma.user.findUnique({
            where: { id: userId },
            select: { design: true },
        })
    },

    async findProjectMemories(projectId: string) {
        return prisma.projectMemory.findMany({
            where: { projectId },
            select: { key: true, value: true },
            orderBy: { key: 'asc' },
        })
    },
}
