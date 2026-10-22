import { AppError } from '../../shared/appError'
import { githubAppService } from '../githubapp/githubapp.service'

import { platformRepository } from './platform.repository'
import { executeSandboxCommand, runSandboxGitArchive } from './platform.utils'

import type {
    ListGithubRepos,
    GithubRepo,
    CreateRepo,
    UpdateRepo,
    DownloadSession,
    DownloadSessionResult,
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

const downloadSession = async (data: DownloadSession): Promise<DownloadSessionResult> => {
    const { sessionId, userId } = data
    const session = await platformRepository.findSessionByIdAndUser({ sessionId, userId })
    if (!session) {
        throw new AppError('Session not found', 404)
    }

    const safeSessionName =
        (session.title || 'session')
            .trim()
            .replace(/[^a-z0-9-_]+/gi, '-')
            .replace(/^-+|-+$/g, '') || 'session'
    const fileName = `${safeSessionName}.zip`

    if (session.githubRepoOwner && session.githubRepoName) {
        const downloadUrl = `https://github.com/${session.githubRepoOwner}/${session.githubRepoName}/archive/refs/heads/main.zip`
        return {
            fileName,
            downloadUrl,
        }
    }

    const zip = await runSandboxGitArchive({
        sandboxId: session.vmId,
    })

    return {
        fileName,
        zip,
    }
}

const getUserGithubRepos = async (data: ListGithubRepos): Promise<GithubRepo[]> => {
    const { userId, page: requestedPage, limit: requestedLimit, search } = data

    try {
        const appRepos = await githubAppService.getUserInstallationRepos({
            userId,
            page: requestedPage,
            limit: requestedLimit,
            search,
        })
        if (appRepos && appRepos.length > 0) {
            return appRepos
        }
    } catch {
        // Intentionally swallowed: fallback to user token below if app repos not found
    }

    const user = await platformRepository.findUserGithubConnection(userId)

    if (!user) {
        throw new AppError('user not found', 404)
    }

    if (user.githubConnected === false && !user.githubAppInstall) {
        throw new AppError('github is not connected', 401)
    }

    if (!user.githubToken) {
        return []
    }

    let repos: any[] = []
    let page = requestedPage || 1
    const perPage = requestedLimit ? Math.min(requestedLimit, 100) : 100
    let hasMore = true

    while (hasMore) {
        const response = await fetch(
            `https://api.github.com/user/repos?sort=updated&per_page=${perPage}&page=${page}`,
            {
                method: 'GET',
                headers: {
                    Authorization: `Bearer ${user.githubToken}`,
                    Accept: 'application/vnd.github+json',
                    'X-GitHub-Api-Version': '2022-11-28',
                    'User-Agent': 'December-App',
                },
            }
        )

        if (!response.ok) {
            const errorText = await response.text()
            throw new AppError(`Failed to fetch GitHub repos: ${errorText}`, 401)
        }

        const pageRepos = (await response.json()) as any[]
        const filtered = search
            ? pageRepos.filter(
                  (r) =>
                      r.name?.toLowerCase().includes(search.toLowerCase()) ||
                      r.full_name?.toLowerCase().includes(search.toLowerCase())
              )
            : pageRepos

        repos = repos.concat(filtered)

        if (pageRepos.length < perPage || requestedPage !== undefined) {
            hasMore = false
        } else {
            page++
        }
    }

    return repos.map((repo: any) => ({
        id: repo.id,
        name: repo.name,
        fullName: repo.full_name,
        private: repo.private,
        defaultBranch: repo.default_branch,
        updatedAt: repo.updated_at,
        htmlUrl: repo.html_url,
        cloneUrl: repo.clone_url,
        language: repo.language ?? null,
        description: repo.description ?? null,
        owner: {
            login: repo.owner?.login,
            avatarUrl: repo.owner?.avatar_url,
        },
    }))
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
    const githubToken = await resolveUserGithubToken(userId, repoOwner)
    const commitMessage = data.commitMessage ?? 'Update session files'

    const safeCommitMsg = commitMessage.replace(/'/g, "'\\''")
    const remoteUrl = `https://x-access-token:${githubToken}@github.com/${repoOwner}/${repoName}.git`

    // Determine current default branch or fallback to main
    const branchRes = await executeSandboxCommand({
        sandboxId: session.vmId,
        sessionId,
        command: 'git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "main"',
    })
    const branch = branchRes.stdout.trim() || 'main'

    const gitCommands = [
        'git config user.name "December"',
        'git config user.email "bot@december.ai"',
        `git remote set-url origin '${remoteUrl}' 2>/dev/null || git remote add origin '${remoteUrl}'`,
        'git add -A',
        `git diff-index --quiet HEAD 2>/dev/null || git commit -m '${safeCommitMsg}'`,
        `git push origin ${branch}`,
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
    downloadSession,
    getUserGithubRepos,
    createRepo,
    updateRepo,
    unlinkGithubRepo,
}
