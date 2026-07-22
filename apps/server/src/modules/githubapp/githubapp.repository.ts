import { prisma } from '@december/database'

export async function upsertInstallation(installationId: string, userId: string) {
    return prisma.githubAppInstallation.upsert({
        where: { installationId },
        update: { userId },
        create: {
            installationId,
            userId,
        },
    })
}

export async function deleteInstallation(installationId: string) {
    return prisma.githubAppInstallation.delete({
        where: { installationId },
    })
}

export const githubAppRepository = {
    upsertInstallation,
    deleteInstallation,
}
