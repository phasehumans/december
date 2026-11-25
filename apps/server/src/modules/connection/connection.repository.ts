import { prisma } from '@december/database'

import type { Prisma } from '@december/database'

export async function findSkills(userId: string) {
    return prisma.userSkill.findMany({ where: { userId }, orderBy: { name: 'asc' } })
}

export async function findSkill(userId: string, name: string) {
    return prisma.userSkill.findUnique({ where: { userId_name: { userId, name } } })
}

export async function upsertSkill(
    userId: string,
    currentName: string,
    data: Omit<Prisma.UserSkillUncheckedCreateInput, 'userId'>
) {
    const existing = await findSkill(userId, currentName)
    if (existing) {
        return prisma.userSkill.update({ where: { id: existing.id }, data })
    }
    return prisma.userSkill.create({ data: { ...data, userId } })
}

export async function updateSkill(id: string, data: Prisma.UserSkillUpdateInput) {
    return prisma.userSkill.update({ where: { id }, data })
}

export async function deleteSkill(userId: string, name: string) {
    return prisma.userSkill.deleteMany({ where: { userId, name } })
}

export async function findMcpServers(userId: string) {
    return prisma.userMcpServer.findMany({ where: { userId }, orderBy: { name: 'asc' } })
}

export async function findMcpServer(userId: string, name: string) {
    return prisma.userMcpServer.findUnique({ where: { userId_name: { userId, name } } })
}

export async function createMcpServer(data: Prisma.UserMcpServerUncheckedCreateInput) {
    return prisma.userMcpServer.create({ data })
}

export async function updateMcpServer(id: string, data: Prisma.UserMcpServerUpdateInput) {
    return prisma.userMcpServer.update({ where: { id }, data })
}

export async function deleteMcpServer(userId: string, name: string) {
    return prisma.userMcpServer.deleteMany({ where: { userId, name } })
}

export const connectionRepository = {
    findSkills,
    findSkill,
    upsertSkill,
    updateSkill,
    deleteSkill,
    findMcpServers,
    findMcpServer,
    createMcpServer,
    updateMcpServer,
    deleteMcpServer,
}
