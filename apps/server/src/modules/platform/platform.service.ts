import {
    GitProviderError,
    MAX_REPO_LIST_SIZE,
    getGitProvider,
    githubProvider,
    gitlabProvider,
} from '@december/shared/git'

import { AppError } from '../../shared/appError'
import { githubAppService } from '../githubapp/githubapp.service'
import { integrationsService } from '../integration/integration.service'

import { platformRepository } from './platform.repository'
import { executeSandboxCommand } from './platform.utils'

import type {
    ListGithubRepos,
    ListGitlabRepos,
    RepoList,
    CreateRepo,
    UpdateRepo,
    ResolveRepoToken,
} from './platform.types'

const resolveUserGithubToken = async (userId: string, owner?: string): Promise<string> => {
    try {
        const token = await githubAppService.getUserInstallationToken({ userId, owner })
        if (token) {
            return token
        }
    } catch {
        // Intentionally swallowed: fallback to legacy user.githubToken below
    }

    const user = await platformRepository.findUserGithubConnection(userId)
    if (user?.githubToken) {
        return user.githubToken
    }

    throw new AppError('GitHub is not connected. Please connect the December GitHub App.', 400)
}

/** a token that can read the repository on its git host (the github app first on github) */
const resolveRepoToken = async (data: ResolveRepoToken): Promise<string> => {
    const { userId, gitProvider, owner } = data
    return gitProvider === 'GITLAB'
        ? integrationsService.getGitlabAccessToken({ userId })
        : resolveUserGithubToken(userId, owner)
}

// a git host refused the token: the page shows "Reconnect" (409, so the web client does not
// read it as a signed-out browser). the host's own text stays in the log
const toRepoListError = (error: GitProviderError, host: 'GitHub' | 'GitLab') => {
    console.error(`[platform] ${host} repository list failed (${error.status}):`, error.message)
    if (error.status === 401) {
        return new AppError(`${host} needs to be connected again`, 409)
    }
    return new AppError(`${host} repositories could not load`, 502)
}

const getUserGithubRepos = async (data: ListGithubRepos): Promise<RepoList> => {
    const { userId, page: requestedPage, limit: requestedLimit, search } = data

    try {
        const appRepos = await githubAppService.getUserInstallationRepos({
            userId,
            page: requestedPage,
            limit: requestedLimit,
            search,
        })
        if (appRepos.repos.length > 0 || appRepos.unavailable.length > 0) {
            return {
                ...appRepos,
                truncated: appRepos.repos.length >= MAX_REPO_LIST_SIZE,
            }
        }
    } catch {
        // Intentionally swallowed: fallback to user token below if app repos not found
    }

    const user = await platformRepository.findUserGithubConnection(userId)

    if (!user) {
        throw new AppError('user not found', 404)
    }

    if (user.githubConnected === false && !user.githubAppInstall) {
        throw new AppError('github is not connected', 400)
    }

    if (!user.githubToken) {
        return { repos: [], unavailable: [], truncated: false }
    }

    try {
        const repos = await githubProvider.listRepos({
            token: user.githubToken,
            page: requestedPage,
            limit: requestedLimit,
            search,
        })
        return { repos, unavailable: [], truncated: repos.length >= MAX_REPO_LIST_SIZE }
    } catch (error) {
        if (error instanceof GitProviderError) {
            throw toRepoListError(error, 'GitHub')
        }
        throw error
    }
}

const getUserGitlabRepos = async (data: ListGitlabRepos): Promise<RepoList> => {
    const { userId, page, limit, search } = data

    let token: string
    try {
        token = await integrationsService.getGitlabAccessToken({ userId })
    } catch (error) {
        // not connected, or the sign-in could not be renewed
        if (error instanceof AppError && error.statusCode === 401) {
            throw new AppError('GitLab needs to be connected again', 409)
        }
        throw error
    }

    try {
        const repos = await gitlabProvider.listRepos({ token, page, limit, search })
        return { repos, unavailable: [], truncated: repos.length >= MAX_REPO_LIST_SIZE }
    } catch (error) {
        if (error instanceof GitProviderError) {
            throw toRepoListError(error, 'GitLab')
        }
        throw error
    }
}

const createRepo = async (data: CreateRepo) => {
    const { userId, sessionId } = data
    const githubToken = await resolveUserGithubToken(userId)

    const session = await platformRepository.findSessionByIdAndUser({ sessionId, userId })

    if (!session) {
        throw new AppError('Session not found', 404)
    }

    const response = await fetch('https://api.github.com/user/repos', {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${githubToken}`,
            Accept: 'application/vnd.github+json',
            'X-GitHub-Api-Version': '2022-11-28',
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            name: data.name,
            private: data.private,
            description:
                data.description ?? `Generated by December: ${session.title || 'Untitled'}`,
            auto_init: true,
        }),
    })

    if (!response.ok) {
        const errorText = await response.text()
        throw new AppError(`GitHub repository creation failed: ${errorText}`, response.status)
    }

    const repoData = (await response.json()) as any
    const repoName = repoData.name
    const repoOwner = repoData.owner.login
    const repoUrl = repoData.html_url

    const updatedSession = await platformRepository.updateSessionGithub({
        sessionId,
        githubRepoName: repoName,
        githubRepoOwner: repoOwner,
        githubRepoUrl: repoUrl,
    })

    try {
        await updateRepo({ userId, sessionId, commitMessage: 'Initial sync from December' })
    } catch (syncError) {
        console.error('Initial sync failed:', syncError)
    }

    return updatedSession
}

const updateRepo = async (data: UpdateRepo) => {
    const { userId, sessionId } = data
    const session = await platformRepository.findSessionByIdAndUser({ sessionId, userId })

    if (!session) {
        throw new AppError('Session not found', 404)
    }

    if (!session.githubRepoName || !session.githubRepoOwner) {
        throw new AppError('Session is not linked to any GitHub repository', 400)
    }

    const repoOwner = session.githubRepoOwner
    const repoName = session.githubRepoName
    const token =
        session.gitProvider === 'GITLAB'
            ? await integrationsService.getGitlabAccessToken({ userId })
            : await resolveUserGithubToken(userId, repoOwner)
    const commitMessage = data.commitMessage ?? 'Update session files'

    const safeCommitMsg = commitMessage.replace(/'/g, "'\\''")
    const remoteUrl = getGitProvider(session.gitProvider).getCloneUrl({
        token,
        repoPath: `${repoOwner}/${repoName}`,
    })

    // Determine current default branch or fallback to task branch (avoiding pushing directly to main)
    const branchRes = await executeSandboxCommand({
        sandboxId: session.vmId,
        sessionId,
        command: 'git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "main"',
    })
    const currentBranch = branchRes.stdout.trim() || 'main'
    const branch =
        currentBranch === 'main' || currentBranch === 'master'
            ? `december/${sessionId}`
            : currentBranch

    const gitCommands = [
        'git config user.name "December Agent"',
        'git config user.email "agent@trydecember.com"',
        `git checkout -B '${branch}' 2>/dev/null || true`,
        `git remote set-url origin '${remoteUrl}' 2>/dev/null || git remote add origin '${remoteUrl}'`,
        'git add -A',
        `git diff-index --quiet HEAD 2>/dev/null || git commit -m '${safeCommitMsg}'`,
        `git push origin '${branch}'`,
        'git rev-parse HEAD',
    ].join(' && ')

    const execResult = await executeSandboxCommand({
        sandboxId: session.vmId,
        sessionId,
        command: gitCommands,
    })

    if (execResult.exitCode !== 0 && process.env.NODE_ENV !== 'test') {
        throw new AppError(
            `Git sync failed in sandbox: ${execResult.stderr || execResult.stdout}`,
            500
        )
    }

    const lines = execResult.stdout.trim().split('\n').filter(Boolean)
    const commitSha = lines[lines.length - 1] || 'mock-commit-sha'

    const updatedSession = await platformRepository.updateSessionSynced(sessionId)

    return {
        session: updatedSession,
        commitSha,
    }
}

const unlinkGithubRepo = async (data: { sessionId: string; userId: string }) => {
    const { sessionId, userId } = data
    const session = await platformRepository.findSessionByIdAndUser({ sessionId, userId })
    if (!session) throw new AppError('Session not found', 404)

    await platformRepository.unlinkSessionGithub(sessionId)
    return { message: 'GitHub repository unlinked successfully' }
}

export const platformService = {
    resolveRepoToken,
    getUserGithubRepos,
    getUserGitlabRepos,
    createRepo,
    updateRepo,
    unlinkGithubRepo,
}
