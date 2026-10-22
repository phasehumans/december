import { prisma } from '@december/database'

async function findUserGithubConnection(id: string) {
    return prisma.user.findUnique({
        where: { id },
        select: {
            githubToken: true,
            githubUsername: true,
            githubConnected: true,
            githubAppInstall: true,
        },
    })
}

async function findSessionByIdAndUser(data: { sessionId: string; userId: string }) {
    const { sessionId, userId } = data
    return prisma.session.findFirst({
        where: {
            id: sessionId,
            userId,
        },
    })
}

async function updateSessionGithub(data: {
    sessionId: string
    githubRepoName: string
    githubRepoOwner: string
    githubRepoUrl: string
}) {
    const { sessionId, githubRepoName, githubRepoOwner, githubRepoUrl } = data
    return prisma.session.update({
        where: { id: sessionId },
        data: {
            githubRepoName,
            githubRepoOwner,
            githubRepoUrl,
        },
    })
}

async function updateSessionSynced(sessionId: string) {
    return prisma.session.update({
        where: { id: sessionId },
        data: {
            githubLastSyncedAt: new Date(),
        },
    })
}

async function unlinkSessionGithub(sessionId: string) {
    return prisma.session.update({
        where: { id: sessionId },
        data: {
            githubRepoName: null,
            githubRepoOwner: null,
            githubRepoUrl: null,
            githubLastSyncedAt: null,
        },
    })
}

export const platformRepository = {
    findUserGithubConnection,
    findSessionByIdAndUser,
    updateSessionGithub,
    updateSessionSynced,
    unlinkSessionGithub,
}
