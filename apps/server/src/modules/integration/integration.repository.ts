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
        },
        select: {
            id: true,
            githubConnected: true,
            githubAppInstall: true,
            githubUsername: true,
        },
    })
}

const gitlabWhere = (userId: string) => ({
    userId_provider: { userId, provider: 'GITLAB' as const },
})

// the columns the token resolver needs; never selected for a response
const tokenSelect = {
    provider: true,
    encryptedAccessToken: true,
    encryptedRefreshToken: true,
    expiresAt: true,
} as const

async function findGitlabConnection(userId: string) {
    return prisma.gitConnection.findUnique({
        where: gitlabWhere(userId),
        select: { username: true },
    })
}

async function findGitlabConnectionTokens(userId: string) {
    return prisma.gitConnection.findUnique({ where: gitlabWhere(userId), select: tokenSelect })
}

async function findGitlabOwner(externalId: string) {
    return prisma.gitConnection.findUnique({
        where: { provider_externalId: { provider: 'GITLAB', externalId } },
        select: { userId: true },
    })
}

async function upsertGitlabConnection(data: {
    userId: string
    externalId: string
    username: string
    encryptedAccessToken: string
    encryptedRefreshToken: string | null
    expiresAt: Date | null
}) {
    const { userId, ...fields } = data
    return prisma.gitConnection.upsert({
        where: gitlabWhere(userId),
        update: fields,
        create: { userId, provider: 'GITLAB', ...fields },
        select: { username: true },
    })
}

async function updateGitlabTokens(
    userId: string,
    data: {
        encryptedAccessToken: string
        encryptedRefreshToken: string | null
        expiresAt: Date | null
    }
) {
    await prisma.gitConnection.update({ where: gitlabWhere(userId), data })
}

async function deleteGitlabConnection(userId: string) {
    await prisma.gitConnection.deleteMany({ where: { userId, provider: 'GITLAB' } })
}

export const integrationRepository = {
    findGitlabConnection,
    findGitlabConnectionTokens,
    findGitlabOwner,
    upsertGitlabConnection,
    updateGitlabTokens,
    deleteGitlabConnection,
    findUserByGithubId,
    findUserById,
    findUserFirst,
    updateUserGithub,
}
