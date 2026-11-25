import { prisma } from '@december/database'

import type { BulkUpsertSecretItem } from './secrets.types'

// repoFullName here is always the stored form: lower case, '' for "all repositories"

export async function upsertSecret(
    userId: string,
    name: string,
    encryptedValue: string,
    note?: string,
    repoFullName = ''
) {
    return prisma.secret.upsert({
        where: {
            userId_name_repoFullName: {
                userId,
                name,
                repoFullName,
            },
        },
        update: {
            value: encryptedValue,
            ...(note !== undefined && { note }),
        },
        create: {
            userId,
            name,
            value: encryptedValue,
            note,
            repoFullName,
        },
    })
}

export async function bulkUpsertSecrets(userId: string, secrets: BulkUpsertSecretItem[]) {
    return prisma.$transaction(
        secrets.map((item) =>
            prisma.secret.upsert({
                where: {
                    userId_name_repoFullName: {
                        userId,
                        name: item.name,
                        repoFullName: item.repoFullName ?? '',
                    },
                },
                update: {
                    value: item.encryptedValue,
                    ...(item.note !== undefined && { note: item.note }),
                },
                create: {
                    userId,
                    name: item.name,
                    value: item.encryptedValue,
                    note: item.note,
                    repoFullName: item.repoFullName ?? '',
                },
            })
        )
    )
}

export async function findSecretsByUser(userId: string) {
    return prisma.secret.findMany({
        where: { userId },
        select: {
            id: true,
            name: true,
            note: true,
            repoFullName: true,
            createdAt: true,
            updatedAt: true,
        },
        orderBy: { updatedAt: 'desc' },
    })
}

export async function findSecretByName(userId: string, name: string, repoFullName = '') {
    return prisma.secret.findUnique({
        where: {
            userId_name_repoFullName: {
                userId,
                name,
                repoFullName,
            },
        },
    })
}

export async function deleteSecret(userId: string, name: string, repoFullName = '') {
    return prisma.secret.delete({
        where: {
            userId_name_repoFullName: {
                userId,
                name,
                repoFullName,
            },
        },
    })
}

/** the "all repositories" rows of a user, plus the rows of one repository when given */
export async function findSecretsWithValuesByUser(userId: string, repoFullName = '') {
    return prisma.secret.findMany({
        where: { userId, repoFullName: { in: repoFullName ? ['', repoFullName] : [''] } },
        orderBy: [{ name: 'asc' }, { repoFullName: 'asc' }],
    })
}

/** the repository columns of a session, only when the session belongs to the user */
export async function findSessionRepo(userId: string, sessionId: string) {
    return prisma.session.findFirst({
        where: { id: sessionId, userId },
        select: {
            githubRepoOwner: true,
            githubRepoName: true,
            repoUrl: true,
            githubRepoUrl: true,
        },
    })
}

export const secretsRepository = {
    upsertSecret,
    bulkUpsertSecrets,
    findSecretsByUser,
    findSecretByName,
    deleteSecret,
    findSecretsWithValuesByUser,
    findSessionRepo,
}
