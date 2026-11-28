import { prisma } from '@december/database'

import type { Prisma } from '@december/database'

const ORDER = [{ position: 'asc' as const }, { createdAt: 'asc' as const }]

const findHooks = (userId: string) =>
    prisma.userHook.findMany({ where: { userId }, orderBy: ORDER })

const findHook = (userId: string, id: string) =>
    prisma.userHook.findFirst({ where: { id, userId } })

const countHooks = (userId: string) => prisma.userHook.count({ where: { userId } })

const lastPosition = async (userId: string) => {
    const last = await prisma.userHook.findFirst({
        where: { userId },
        orderBy: { position: 'desc' },
        select: { position: true },
    })
    return last?.position ?? -1
}

const createHook = (data: Prisma.UserHookUncheckedCreateInput) => prisma.userHook.create({ data })

const updateHook = (id: string, data: Prisma.UserHookUpdateInput) =>
    prisma.userHook.update({ where: { id }, data })

const deleteHook = (userId: string, id: string) =>
    prisma.userHook.deleteMany({ where: { id, userId } })

/** puts the whole list in place of the saved one, in one transaction */
const replaceHooks = (userId: string, rows: Omit<Prisma.UserHookCreateManyInput, 'userId'>[]) =>
    prisma.$transaction(async (tx) => {
        await tx.userHook.deleteMany({ where: { userId } })
        if (rows.length > 0) {
            await tx.userHook.createMany({ data: rows.map((row) => ({ ...row, userId })) })
        }
        return tx.userHook.findMany({ where: { userId }, orderBy: ORDER })
    })

export const hookRepository = {
    findHooks,
    findHook,
    countHooks,
    lastPosition,
    createHook,
    updateHook,
    deleteHook,
    replaceHooks,
}
