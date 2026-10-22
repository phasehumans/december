import { prisma } from '@december/database'

async function findUserById(id: string) {
    return prisma.user.findUnique({
        where: { id },
    })
}

async function findUserFirst(id: string) {
    return prisma.user.findFirst({
        where: { id },
    })
}

async function updateUserGithub(data: { id: string; username: string; accessToken: string }) {
    const { id, username, accessToken } = data
    return prisma.user.update({
        where: { id },
        data: {
            githubUsername: username,
            githubToken: accessToken,
            githubConnected: true,
            githubCardDone: true,
        },
        select: {
            id: true,
            githubConnected: true,
            githubAppInstall: true,
            githubUsername: true,
        },
    })
}

export const integrationRepository = {
    findUserById,
    findUserFirst,
    updateUserGithub,
}
