import { prisma } from '@december/database'
import { getGitProvider, gitlabOAuth, resolveAccessToken } from '@december/shared/git'

import { resolveSecretsEncKey } from './llm-source'

import type { GitProviderName, OAuthApp } from '@december/shared/git'

// The clone url with the token in it, for a repo on the provider's own host. Any other url
// comes back as it is, so a token never goes to a host it does not belong to.
export const withGitToken = (data: {
    repoUrl: string
    token?: string | null
    provider: GitProviderName
}): string => {
    const { repoUrl, token, provider } = data
    if (!token) return repoUrl
    const git = getGitProvider(provider)
    const ref = git.parseRepoUrl(repoUrl)
    return ref ? git.getCloneUrl({ token, repoPath: ref.path }) : repoUrl
}

const gitlabOAuthApp = (): OAuthApp | undefined => {
    const clientId = process.env.GITLAB_CLIENT_ID?.trim()
    const clientSecret = process.env.GITLAB_CLIENT_SECRET?.trim()
    if (!clientId || !clientSecret) return undefined
    const redirectUri =
        process.env.GITLAB_REDIRECT_URI?.trim() ||
        gitlabOAuth.getCallbackUrl(process.env.SERVER_URL || 'http://localhost:4000')
    return { clientId, clientSecret, redirectUri }
}

const connectionSelect = {
    provider: true,
    encryptedAccessToken: true,
    encryptedRefreshToken: true,
    expiresAt: true,
} as const

/**
 * The user's token for the session's git host, or null when there is none (the work then
 * stays on a local branch). GitHub reads User.githubToken as before; GitLab reads the
 * user's GitConnection and refreshes the token when it is about to expire.
 */
export const resolveGitToken = async (data: {
    userId?: string | null
    provider: GitProviderName
}): Promise<string | null> => {
    const { userId, provider } = data
    if (!userId) return null

    if (provider === 'GITHUB') {
        // a database error means no token: the work stays on a local branch, as before
        const user = await prisma.user
            .findUnique({ where: { id: userId }, select: { githubToken: true } })
            .catch(() => null)
        return user?.githubToken ?? null
    }

    const where = { userId_provider: { userId, provider } }
    // a database error means no token: the work stays on a local branch
    const connection = await prisma.gitConnection
        .findUnique({ where, select: connectionSelect })
        .catch(() => null)
    const keyHex = resolveSecretsEncKey()
    if (!connection || !keyHex) return null

    try {
        return await resolveAccessToken({
            connection,
            keyHex,
            oauthApp: gitlabOAuthApp(),
            save: async (update) => {
                await prisma.gitConnection.update({ where, data: update })
            },
            reload: () => prisma.gitConnection.findUnique({ where, select: connectionSelect }),
        })
    } catch (error) {
        // the message never holds a token
        console.warn(
            `[GIT] no ${provider.toLowerCase()} token for user ${userId}:`,
            error instanceof Error ? error.message : String(error)
        )
        return null
    }
}
