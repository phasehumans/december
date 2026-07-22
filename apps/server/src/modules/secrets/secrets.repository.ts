import { prisma } from '@december/database'

export async function upsertSecret(userId: string, name: string, encryptedValue: string) {
    return prisma.secret.upsert({
        where: {
            userId_name: {
                userId,
                name,
            },
        },
        update: {
            value: encryptedValue,
        },
        create: {
            userId,
            name,
            value: encryptedValue,
        },
    })
}

export async function findSecretsByUser(userId: string) {
    return prisma.secret.findMany({
        where: { userId },
        select: { id: true, name: true, createdAt: true, updatedAt: true },
    })
}

export async function deleteSecret(userId: string, name: string) {
    return prisma.secret.delete({
        where: {
            userId_name: {
                userId,
                name,
            },
        },
    })
}

export const secretsRepository = {
    upsertSecret,
    findSecretsByUser,
    deleteSecret,
}
