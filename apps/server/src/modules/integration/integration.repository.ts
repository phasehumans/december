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

async function findUserByGithubId(githubId: string) {
    return prisma.user.findUnique({
        where: { githubId },
        select: { id: true },
    })
}

async function updateUserGithub(data: {
    id: string
    username: string
    accessToken: string
    githubId?: string
}) {
    const { id, username, accessToken, githubId } = data
    return prisma.user.update({
        where: { id },
        data: {
            ...(githubId ? { githubId } : {}),
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
    findUserByGithubId,
    findUserById,
    findUserFirst,
    updateUserGithub,
}
