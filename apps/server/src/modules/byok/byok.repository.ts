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

// the only read that returns the encrypted key; used to check a saved key again
const findCredentialWithKey = async (userId: string, provider: string) => {
    return prisma.providerCredential.findUnique({
        where: { userId_provider: { userId, provider } },
        select: { ...summarySelect, encryptedKey: true },
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

/**
 * Saves the result of "check again". The row changes only while it still holds the key that
 * was checked: a key saved or removed during the check is not overwritten with the models of
 * the old key. Returns false when the row changed.
 */
const updateVerification = async (data: UpdateVerificationData) => {
    const { userId, provider, encryptedKey, models, defaultModel, verifiedAt } = data
    const result = await prisma.providerCredential.updateMany({
        where: { userId, provider, encryptedKey },
        data: { models, defaultModel, verifiedAt },
    })
    return result.count > 0
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
