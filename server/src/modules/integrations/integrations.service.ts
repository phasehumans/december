import axios from 'axios'

import { prisma } from '../../config/db'
import { AppError } from '../../shared/appError'
import { getBinaryFile, getTextFile } from '../../shared/project-storage'
import { sendNotificationToUser } from '../notification/notification.service'
import { parseStoredProjectFiles } from '../project/project.utils'

type GithubRepo = {
    id: number
    name: string
    fullName: string
    private: boolean
    defaultBranch: string
    updatedAt: string
    htmlUrl: string
    cloneUrl: string
    language: string | null
    description: string | null
    owner: {
        login: string
        avatarUrl: string
    }
}

import type {
    ListGithubRepos,
    ConnectVercel,
    ConnectSupabase,
    ConnectNotion,
    ConnectGithub,
    CreateRepo,
    UpdateRepo,
} from './integrations.types'

const listGithubRepos = async (data: ListGithubRepos): Promise<GithubRepo[]> => {
    const { userId } = data
    const user = await prisma.user.findUnique({
        where: {
            id: userId,
        },
        select: {
            githubToken: true,
            githubUsername: true,
            githubConnected: true,
        },
    })

    if (!user) {
        throw new Error('user not found')
    }

    if (user.githubConnected === false) {
        throw new Error('github is not connected')
    }

    if (user.githubToken === undefined) {
        throw new Error('github access token not found')
    }

    const response = await fetch('https://api.github.com/user/repos?sort=updated&per_page=100', {
        method: 'GET',
        headers: {
            Authorization: `Bearer ${user.githubToken}`,
            Accept: 'application/vnd.github+json',
            'X-GitHub-Api-Version': '2022-11-28',
        },
    })

    if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`Failed to fetch GitHub repos: ${errorText}`)
    }

    const repos = (await response.json()) as any[]

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

const connectVercel = async (data: ConnectVercel) => {
    const { code, userId, teamId, configurationId } = data

    const existingUser = await prisma.user.findFirst({
        where: {
            id: userId,
            isDeleted: false,
        },
    })

    if (!existingUser) {
        throw new AppError('user not found', 404)
    }

    const tokenResponse = await fetch('https://api.vercel.com/v2/oauth/access_token', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
        },

        body: new URLSearchParams({
            client_id: process.env.VERCEL_CLIENT_ID!,
            client_secret: process.env.VERCEL_CLIENT_SECRET!,
            code,
            redirect_uri: process.env.VERCEL_REDIRECT_URI!,
        }).toString(),
    })

    const rawResponse = await tokenResponse.text()

    if (!tokenResponse.ok) {
        throw new AppError(rawResponse, 400)
    }

    const tokenData = JSON.parse(rawResponse) as { access_token?: string }

    const accessToken = tokenData.access_token

    if (!accessToken) {
        throw new AppError('vercel access token missing', 400)
    }

    const updatedUser = await prisma.user.update({
        where: {
            id: userId,
        },
        data: {
            vercelConnected: true,
            vercelAccessToken: accessToken,
            vercelTeamId: teamId,
            vercelConfigurationId: configurationId,
        },
    })

    try {
        await sendNotificationToUser({
            userId,
            title: 'Vercel Connected',
            message: 'Successfully connected with Vercel integration!',
            type: 'SUCCESS',
        })
    } catch (error) {
        console.error('Failed to send vercel connection notification:', error)
    }

    return updatedUser
}

const connectSupabase = async (data: ConnectSupabase) => {
    const { userId, code } = data
    const params = new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: process.env.SUPABASE_REDIRECT_URI!,
        client_id: process.env.SUPABASE_CLIENT_ID!,
        client_secret: process.env.SUPABASE_CLIENT_SECRET!,
    })

    const response = await axios.post('https://api.supabase.com/v1/oauth/token', params, {
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
        },
    })

    const tokenData = response.data

    console.log('TOKEN DATA:', tokenData)

    const expiresAt = new Date(Date.now() + tokenData.expires_in * 1000)

    const updatedUser = await prisma.user.update({
        where: {
            id: userId,
        },

        data: {
            supabaseConnected: true,
            supabaseAccessToken: tokenData.access_token,
            supabaseRefreshToken: tokenData.refresh_token,
            supabaseTokenExpiresAt: expiresAt,
            supabaseTokenScope: tokenData.scope ?? null,
            supabaseConnectedAt: new Date(),
        },
    })

    try {
        await sendNotificationToUser({
            userId,
            title: 'Supabase Connected',
            message: 'Successfully connected with Supabase integration!',
            type: 'SUCCESS',
        })
    } catch (error) {
        console.error('Failed to send supabase connection notification:', error)
    }

    return updatedUser
}

const connectNotion = async (data: ConnectNotion) => {
    const { userId, code } = data
    const response = await axios.post(
        'https://api.notion.com/v1/oauth/token',
        {
            grant_type: 'authorization_code',
            code,
            redirect_uri: process.env.NOTION_REDIRECT_URI!,
        },
        {
            headers: {
                'Content-Type': 'application/json',
            },

            auth: {
                username: process.env.NOTION_CLIENT_ID!,
                password: process.env.NOTION_CLIENT_SECRET!,
            },
        }
    )

    const notionData = response.data

    const updatedUser = await prisma.user.update({
        where: {
            id: userId,
        },

        data: {
            notionAccessToken: notionData.access_token,
            notionWorkspaceId: notionData.workspace_id,
            notionWorkspaceName: notionData.workspace_name,
        },
    })

    try {
        await sendNotificationToUser({
            userId,
            title: 'Notion Connected',
            message: `Successfully connected with Notion integration (${notionData.workspace_name})!`,
            type: 'SUCCESS',
        })
    } catch (error) {
        console.error('Failed to send notion connection notification:', error)
    }

    return updatedUser
}

const connectGithub = async (data: ConnectGithub) => {
    const { username, accessToken, userId } = data

    try {
        const updatedUser = await prisma.user.update({
            where: {
                id: userId,
            },
            data: {
                githubUsername: username,
                githubToken: accessToken,
                githubConnected: true,
            },
            select: {
                id: true,
                githubConnected: true,
                githubUsername: true,
            },
        })

        try {
            await sendNotificationToUser({
                userId,
                title: 'GitHub Connected',
                message: `Successfully connected with GitHub integration as @${username}!`,
                type: 'SUCCESS',
            })
        } catch (error) {
            console.error('Failed to send github connection notification:', error)
        }

        return updatedUser
    } catch (error: any) {
        if (error.code === 'P2025') {
            throw new AppError('user not found', 404)
        }
        throw error
    }
}

const createRepo = async (data: CreateRepo) => {
    const { userId, projectId } = data
    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
            githubToken: true,
            githubConnected: true,
        },
    })

    if (!user || !user.githubConnected || !user.githubToken) {
        throw new AppError('GitHub account not connected', 400)
    }

    const project = await prisma.project.findFirst({
        where: { id: projectId, userId },
    })

    if (!project) {
        throw new AppError('Project not found', 404)
    }

    const response = await fetch('https://api.github.com/user/repos', {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${user.githubToken}`,
            Accept: 'application/vnd.github+json',
            'X-GitHub-Api-Version': '2022-11-28',
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            name: data.name,
            private: data.private,
            description: data.description ?? `Generated by December: ${project.name}`,
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

    const updatedProject = await prisma.project.update({
        where: { id: projectId },
        data: {
            githubRepoName: repoName,
            githubRepoOwner: repoOwner,
            githubRepoUrl: repoUrl,
        },
    })

    try {
        await updateRepo({ userId, projectId, commitMessage: 'Initial sync from December' })
    } catch (syncError) {
        console.error('Initial sync failed:', syncError)
    }

    return updatedProject
}

const updateRepo = async (data: UpdateRepo) => {
    const { userId, projectId } = data
    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
            githubToken: true,
            githubConnected: true,
        },
    })

    if (!user || !user.githubConnected || !user.githubToken) {
        throw new AppError('GitHub account not connected', 400)
    }

    const project = await prisma.project.findFirst({
        where: { id: projectId, userId },
    })

    if (!project) {
        throw new AppError('Project not found', 404)
    }

    if (!project.githubRepoName || !project.githubRepoOwner) {
        throw new AppError('Project is not linked to any GitHub repository', 400)
    }

    const repoOwner = project.githubRepoOwner
    const repoName = project.githubRepoName
    const githubToken = user.githubToken
    const commitMessage = data.commitMessage ?? 'Update project files'

    const activeVersionId = project.currentVersionId
    if (!activeVersionId) {
        throw new AppError('No active version found for this project', 400)
    }

    const activeVersion = await prisma.projectVersion.findFirst({
        where: { id: activeVersionId, projectId },
    })

    if (!activeVersion) {
        throw new AppError('Active version not found', 404)
    }

    const manifest = parseStoredProjectFiles(activeVersion.manifestJson)
    if (manifest.length === 0) {
        throw new AppError('No files found in active project version to sync', 400)
    }

    const headers = {
        Authorization: `Bearer ${githubToken}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'Content-Type': 'application/json',
    }

    const repoResponse = await fetch(`https://api.github.com/repos/${repoOwner}/${repoName}`, {
        method: 'GET',
        headers,
    })

    if (!repoResponse.ok) {
        const errorText = await repoResponse.text()
        throw new AppError(
            `Failed to fetch GitHub repository details: ${errorText}`,
            repoResponse.status
        )
    }

    const repoDetails = (await repoResponse.json()) as any
    const defaultBranch = repoDetails.default_branch || 'main'

    const refResponse = await fetch(
        `https://api.github.com/repos/${repoOwner}/${repoName}/git/ref/heads/${defaultBranch}`,
        {
            method: 'GET',
            headers,
        }
    )

    if (!refResponse.ok) {
        const errorText = await refResponse.text()
        throw new AppError(
            `Failed to fetch default branch reference: ${errorText}`,
            refResponse.status
        )
    }

    const refData = (await refResponse.json()) as any
    const latestCommitSha = refData.object.sha

    const commitResponse = await fetch(
        `https://api.github.com/repos/${repoOwner}/${repoName}/git/commits/${latestCommitSha}`,
        {
            method: 'GET',
            headers,
        }
    )

    if (!commitResponse.ok) {
        const errorText = await commitResponse.text()
        throw new AppError(
            `Failed to fetch base commit details: ${errorText}`,
            commitResponse.status
        )
    }

    const commitData = (await commitResponse.json()) as any
    const baseTreeSha = commitData.tree.sha

    const treeEntries: any[] = []

    for (const file of manifest) {
        const isBinary =
            file.contentType &&
            !file.contentType.startsWith('text/') &&
            !file.contentType.includes('json') &&
            !file.contentType.includes('javascript') &&
            !file.contentType.includes('typescript') &&
            !file.contentType.includes('xml')

        if (isBinary) {
            const binaryFile = await getBinaryFile(file.key)
            if (binaryFile) {
                const base64Content = Buffer.from(binaryFile.body).toString('base64')
                const blobResponse = await fetch(
                    `https://api.github.com/repos/${repoOwner}/${repoName}/git/blobs`,
                    {
                        method: 'POST',
                        headers,
                        body: JSON.stringify({
                            content: base64Content,
                            encoding: 'base64',
                        }),
                    }
                )

                if (!blobResponse.ok) {
                    const errorText = await blobResponse.text()
                    throw new AppError(
                        `Failed to create binary blob for ${file.path}: ${errorText}`,
                        blobResponse.status
                    )
                }

                const blobData = (await blobResponse.json()) as any
                treeEntries.push({
                    path: file.path,
                    mode: '100644',
                    type: 'blob',
                    sha: blobData.sha,
                })
            }
        } else {
            const textContent = await getTextFile(file.key)
            treeEntries.push({
                path: file.path,
                mode: '100644',
                type: 'blob',
                content: textContent ?? '',
            })
        }
    }

    const treeResponse = await fetch(
        `https://api.github.com/repos/${repoOwner}/${repoName}/git/trees`,
        {
            method: 'POST',
            headers,
            body: JSON.stringify({
                base_tree: baseTreeSha,
                tree: treeEntries,
            }),
        }
    )

    if (!treeResponse.ok) {
        const errorText = await treeResponse.text()
        throw new AppError(`Failed to create new Git tree: ${errorText}`, treeResponse.status)
    }

    const treeData = (await treeResponse.json()) as any
    const newTreeSha = treeData.sha

    const newCommitResponse = await fetch(
        `https://api.github.com/repos/${repoOwner}/${repoName}/git/commits`,
        {
            method: 'POST',
            headers,
            body: JSON.stringify({
                message: commitMessage,
                tree: newTreeSha,
                parents: [latestCommitSha],
            }),
        }
    )

    if (!newCommitResponse.ok) {
        const errorText = await newCommitResponse.text()
        throw new AppError(`Failed to create Git commit: ${errorText}`, newCommitResponse.status)
    }

    const newCommitData = (await newCommitResponse.json()) as any
    const newCommitSha = newCommitData.sha

    const updateRefResponse = await fetch(
        `https://api.github.com/repos/${repoOwner}/${repoName}/git/refs/heads/${defaultBranch}`,
        {
            method: 'PATCH',
            headers,
            body: JSON.stringify({
                sha: newCommitSha,
                force: true,
            }),
        }
    )

    if (!updateRefResponse.ok) {
        const errorText = await updateRefResponse.text()
        throw new AppError(
            `Failed to update default branch reference: ${errorText}`,
            updateRefResponse.status
        )
    }

    const updatedProject = await prisma.project.update({
        where: { id: projectId },
        data: {
            githubLastSyncedAt: new Date(),
        },
    })

    return {
        project: updatedProject,
        commitSha: newCommitSha,
    }
}

export const integrationsService = {
    listGithubRepos,
    connectVercel,
    connectSupabase,
    connectNotion,
    connectGithub,
    createRepo,
    updateRepo,
}
