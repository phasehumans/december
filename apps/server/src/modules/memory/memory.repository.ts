import { prisma } from '@december/database'
import { MEMORIES_PER_USER_MAX } from '@december/shared/agent-context'

const findMemories = async (userId: string) => {
    return prisma.userMemory.findMany({
        where: { userId },
        orderBy: { updatedAt: 'desc' },
        take: MEMORIES_PER_USER_MAX,
    })
}

const countMemories = async (userId: string) => {
    return prisma.userMemory.count({ where: { userId } })
}

const findMemory = async (userId: string, id: string) => {
    return prisma.userMemory.findFirst({ where: { id, userId } })
}

const createMemory = async (data: { userId: string; content: string }) => {
    return prisma.userMemory.create({ data: { ...data, source: 'user' } })
}

const updateMemory = async (id: string, content: string) => {
    return prisma.userMemory.update({ where: { id }, data: { content } })
}

const deleteMemory = async (userId: string, id: string) => {
    return prisma.userMemory.deleteMany({ where: { id, userId } })
}

const deleteAllMemories = async (userId: string) => {
    return prisma.userMemory.deleteMany({ where: { userId } })
}

const findMemoryEnabled = async (userId: string) => {
    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { memoryEnabled: true },
    })
    return user?.memoryEnabled ?? false
}

const setMemoryEnabled = async (userId: string, enabled: boolean) => {
    return prisma.user.update({
        where: { id: userId },
        data: { memoryEnabled: enabled },
        select: { memoryEnabled: true },
    })
}

export const memoryRepository = {
    findMemories,
    countMemories,
    findMemory,
    createMemory,
    updateMemory,
    deleteMemory,
    deleteAllMemories,
    findMemoryEnabled,
    setMemoryEnabled,
}
