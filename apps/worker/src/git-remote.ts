import { prisma } from '@december/database'
import {
    createGithubAppJwt,
    createInstallationToken,
    toPullRequestSettings,
} from '@december/shared'
import {
    GitProviderError,
    getGitProvider,
    gitlabOAuth,
    resolveAccessToken,
} from '@december/shared/git'

import { notifyReconnect } from './inbox-notify'
import { resolveSecretsEncKey } from './llm-source'
import {
    branchToSave,
    githubRunGit,
    needsUserIdentity,
    pickCommitAuthor,
    pickTaskBranch,
    toUserIdentity,
} from './pr-opening'

import type { CommitIdentity } from './pr-opening'
import type { PullRequestSettingsValues } from '@december/shared'
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
        // the sign-in ran out and could not be renewed: tell the user once (N5)
        if (error instanceof GitProviderError) {
            await notifyReconnect({ userId, provider }).catch((noticeError: unknown) => {
                console.warn('[GIT] reconnect notice failed:', noticeError)
            })
        }
        return null
    }
}

/**
 * The user as a commit author (#637): the name and email the git host gives for the token.
 * When the host does not answer, the saved account (id and user name) gives the no-reply
 * address. null when the account is not known: the commit is December's alone.
 */
export const resolveGitUser = async (data: {
    userId?: string | null
    provider: GitProviderName
    token?: string | null
}): Promise<CommitIdentity | null> => {
    const { userId, provider, token } = data

    if (token) {
        // a network error or a refused token gives null: the saved account below is used
        const hostUser = await getGitProvider(provider).getUser({ token })
        const fromHost = hostUser ? toUserIdentity({ provider, ...hostUser }) : null
        if (fromHost) return fromHost
    }

    if (!userId) return null
    if (provider === 'GITHUB') {
        // a database error means the account is not known
        const user = await prisma.user
            .findUnique({ where: { id: userId }, select: { githubId: true, githubUsername: true } })
            .catch(() => null)
        return toUserIdentity({ provider, id: user?.githubId, login: user?.githubUsername })
    }
    const connection = await prisma.gitConnection
        .findUnique({
            where: { userId_provider: { userId, provider } },
            select: { externalId: true, username: true },
        })
        .catch(() => null)
    return toUserIdentity({ provider, id: connection?.externalId, login: connection?.username })
}

/**
 * A token of the December GitHub App for one repository, or null when the app is not
 * installed on it (or the worker has no app key). Opens the pull request as December.
 */
export const resolveAppRepoToken = async (repoPath: string): Promise<string | null> => {
    const appId = process.env.GITHUB_APP_ID?.trim()
    const privateKey = process.env.GITHUB_APP_PRIVATE_KEY?.trim()
    if (!appId || !privateKey) return null
    try {
        const res = await fetch(`https://api.github.com/repos/${repoPath}/installation`, {
            headers: {
                Authorization: `Bearer ${createGithubAppJwt({ appId, privateKey })}`,
                Accept: 'application/vnd.github+json',
                'X-GitHub-Api-Version': '2022-11-28',
                'User-Agent': 'December-App',
            },
        })
        // 404: the app is not installed on this repository
        if (!res.ok) return null
        const installationId = ((await res.json()) as any)?.id
        if (!installationId) return null
        const { token } = await createInstallationToken({
            appId,
            privateKey,
            installationId: String(installationId),
        })
        return token
    } catch (error) {
        console.warn(
            `[GIT] no december app token for ${repoPath}:`,
            error instanceof Error ? error.message : String(error)
        )
        return null
    }
}

/** the saved pull request settings of a user; every default when there is no row */
export const loadPullRequestSettings = async (
    userId?: string | null
): Promise<PullRequestSettingsValues> => {
    if (!userId) return toPullRequestSettings(null)
    // a database error means the defaults
    const row = await prisma.pullRequestSettings.findUnique({ where: { userId } }).catch(() => null)
    return toPullRequestSettings(row)
}

/**
 * The branch and the commit author of a new sandbox (#637). The branch is saved on the
 * session the first time, so the session keeps it when the user changes the prefix. A
 * session the GitHub App started has its own branch and author (github-run.ts).
 */
export const resolveSessionGit = async (data: {
    sessionId: string
    userId?: string | null
    provider: GitProviderName
    isGithubRun?: boolean
}): Promise<{ taskBranch: string; author: CommitIdentity }> => {
    const { sessionId, userId, provider, isGithubRun } = data
    if (isGithubRun) return githubRunGit(sessionId)

    const settings = await loadPullRequestSettings(userId)
    // a database error means nothing is saved
    const saved = await prisma.session
        .findUnique({ where: { id: sessionId }, select: { prBranch: true } })
        .catch(() => null)
    const taskBranch = pickTaskBranch({
        sessionId,
        branchPrefix: settings.branchPrefix,
        savedBranch: saved?.prBranch,
    })
    // saved once; a saved name git refuses is replaced (review E2)
    const toSave = saved ? branchToSave({ savedBranch: saved.prBranch, taskBranch }) : null
    if (toSave) {
        await prisma.session
            .update({ where: { id: sessionId }, data: { prBranch: toSave } })
            .catch((error: unknown) => {
                console.warn(`[GIT] could not save the branch of session ${sessionId}:`, error)
            })
    }

    const user = needsUserIdentity(settings.commitAuthor)
        ? await resolveGitUser({
              userId,
              provider,
              token: await resolveGitToken({ userId, provider }),
          })
        : null
    return {
        taskBranch,
        author: pickCommitAuthor({ commitAuthor: settings.commitAuthor, user }).author,
    }
}
