import { prisma } from '@december/database'

import type { BulkUpsertSecretItem } from './secrets.types'

// repoFullName here is always the stored form: lower case, '' for "all repositories"

// the columns a caller may see. the value is never in them
const summarySelect = {
    id: true,
    name: true,
    note: true,
    repoFullName: true,
    createdAt: true,
    updatedAt: true,
} as const

// a note of '' or null clears the note; no note keeps the one saved
const noteUpdate = (note: string | null | undefined) =>
    note === undefined ? {} : { note: note || null }

export async function upsertSecret(
    userId: string,
    name: string,
    encryptedValue: string,
    note?: string | null,
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
            ...noteUpdate(note),
        },
        create: {
            userId,
            name,
            value: encryptedValue,
            note: note || null,
            repoFullName,
        },
        select: summarySelect,
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
                    ...noteUpdate(item.note),
                },
                create: {
                    userId,
                    name: item.name,
                    value: item.encryptedValue,
                    note: item.note || null,
                    repoFullName: item.repoFullName ?? '',
                },
                select: summarySelect,
            })
        )
    )
}

export async function findSecretsByUser(userId: string) {
    return prisma.secret.findMany({
        where: { userId },
        select: summarySelect,
        // the id breaks a tie, so a page of the list never moves between two reads
        orderBy: [{ updatedAt: 'desc' }, { id: 'asc' }],
    })
}

export async function countSecretsByUser(userId: string) {
    return prisma.secret.count({ where: { userId } })
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

/** the count of rows deleted: 0 when the user has no such secret (or a second delete won) */
export async function deleteSecret(userId: string, name: string, repoFullName = '') {
    const { count } = await prisma.secret.deleteMany({
        where: { userId, name, repoFullName },
    })
    return count
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
    countSecretsByUser,
    findSecretByName,
    deleteSecret,
    findSecretsWithValuesByUser,
    findSessionRepo,
}
