import { prisma } from '@december/database'

import type { UpdateVerificationData, UpsertCredentialData } from './byok.types'

// never selects encryptedKey
const summarySelect = {
    provider: true,
    keyHint: true,
    models: true,
    defaultModel: true,
    verifiedAt: true,
    lastUsedAt: true,
} as const

const findCredentialsByUser = async (userId: string) => {
    return prisma.providerCredential.findMany({
        where: { userId },
        select: summarySelect,
        orderBy: { createdAt: 'asc' },
    })
}

const findCredentialSummary = async (userId: string, provider: string) => {
    return prisma.providerCredential.findUnique({
        where: { userId_provider: { userId, provider } },
        select: summarySelect,
    })
}

const findCredentialWithKey = async (userId: string, provider: string) => {
    return prisma.providerCredential.findUnique({
        where: { userId_provider: { userId, provider } },
    })
}

const upsertCredential = async (data: UpsertCredentialData) => {
    const { userId, provider, encryptedKey, keyHint, models, defaultModel, verifiedAt } = data
    return prisma.providerCredential.upsert({
        where: { userId_provider: { userId, provider } },
        update: { encryptedKey, keyHint, models, defaultModel, verifiedAt },
        create: { userId, provider, encryptedKey, keyHint, models, defaultModel, verifiedAt },
        select: summarySelect,
    })
}

const updateVerification = async (data: UpdateVerificationData) => {
    const { userId, provider, models, defaultModel, verifiedAt } = data
    return prisma.providerCredential.update({
        where: { userId_provider: { userId, provider } },
        data: { models, defaultModel, verifiedAt },
        select: summarySelect,
    })
}

const deleteCredential = async (userId: string, provider: string) => {
    const result = await prisma.providerCredential.deleteMany({ where: { userId, provider } })
    return result.count
}

export const byokRepository = {
    findCredentialsByUser,
    findCredentialSummary,
    findCredentialWithKey,
    upsertCredential,
    updateVerification,
    deleteCredential,
}
