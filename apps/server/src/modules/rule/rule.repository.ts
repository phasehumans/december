import { prisma } from '@december/database'

import type { Prisma } from '@december/database'

const findRules = async (userId: string) => {
    return prisma.userRule.findMany({ where: { userId }, orderBy: { name: 'asc' } })
}

const findRule = async (userId: string, name: string) => {
    return prisma.userRule.findUnique({ where: { userId_name: { userId, name } } })
}

const createRule = async (data: Prisma.UserRuleUncheckedCreateInput) => {
    return prisma.userRule.create({ data })
}

const updateRule = async (id: string, data: Prisma.UserRuleUpdateInput) => {
    return prisma.userRule.update({ where: { id }, data })
}

const deleteRule = async (userId: string, name: string) => {
    return prisma.userRule.deleteMany({ where: { userId, name } })
}

export const ruleRepository = {
    findRules,
    findRule,
    createRule,
    updateRule,
    deleteRule,
}
