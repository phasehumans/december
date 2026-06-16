import axios from 'axios'

import { prisma } from '@december/database'
import { AppError } from '../../shared/appError'

import type {
    CreateVercelProject,
    GetDeploymentByCommit,
    GetLatestDeployment,
    GetDeploymentStatus,
    StreamBuildLogs,
} from '@december/shared'

interface VercelCredentials {
    accessToken: string
    teamId: string | null
}

async function getVercelCredentials(userId: string): Promise<VercelCredentials> {
    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
            vercelAccessToken: true,
            vercelTeamId: true,
            vercelConnected: true,
        },
    })

    if (!user || !user.vercelConnected || !user.vercelAccessToken) {
        throw new AppError('Vercel account not connected', 400)
    }

    return {
        accessToken: user.vercelAccessToken,
        teamId: user.vercelTeamId,
    }
}

function buildVercelUrl(path: string, credentials: VercelCredentials): string {
    const url = new URL(`https://api.vercel.com${path}`)
    if (credentials.teamId) {
        url.searchParams.set('teamId', credentials.teamId)
    }
    return url.toString()
}

/**
 * Creates a project on Vercel and links it to a GitHub repository.
 */
async function createProject(data: CreateVercelProject) {
    const { userId, name, repoOwner, repoName } = data
    const creds = await getVercelCredentials(userId)
    const url = buildVercelUrl('/v9/projects', creds)

    try {
        const response = await axios.post(
            url,
            {
                name,
                framework: 'vite',
                gitRepository: {
                    type: 'github',
                    repo: `${repoOwner}/${repoName}`,
                },
            },
            {
                headers: {
                    Authorization: `Bearer ${creds.accessToken}`,
                    'Content-Type': 'application/json',
                },
            }
        )
        return {
            id: response.data.id,
            name: response.data.name,
        }
    } catch (error: any) {
        const rawResponse = error.response?.data
        console.error(
            'Vercel project creation failed. Raw response:',
            JSON.stringify(rawResponse, null, 2)
        )
        const errorData = rawResponse?.error
        const message = errorData?.message || 'Failed to create Vercel project'
        const code = errorData?.code || 'unknown_code'
        const fullDetails = `Vercel Error: ${message} (Code: ${code}, Status: ${error.response?.status}, Raw: ${JSON.stringify(rawResponse)})`
        throw new AppError(fullDetails, error.response?.status || 500)
    }
}

/**
 * Queries Vercel deployments to find the one associated with a specific git commit SHA.
 * Retries with backoff since Vercel webhooks take a brief moment to trigger after a push.
 */
async function getDeploymentByCommit(data: GetDeploymentByCommit) {
    const { userId, vercelProjectId, commitSha } = data
    const creds = await getVercelCredentials(userId)
    const baseUrl = buildVercelUrl('/v6/deployments', creds)
    const url = new URL(baseUrl)
    url.searchParams.set('projectId', vercelProjectId)
    url.searchParams.set('meta-githubCommitSha', commitSha)

    // Retry loop (max 5 attempts, every 2s) to wait for Vercel webhook registration
    for (let attempt = 1; attempt <= 5; attempt++) {
        try {
            const response = await axios.get(url.toString(), {
                headers: {
                    Authorization: `Bearer ${creds.accessToken}`,
                },
            })

            const deployments = response.data.deployments
            if (deployments && deployments.length > 0) {
                return {
                    id: deployments[0].uid,
                    url: deployments[0].url,
                    readyState: deployments[0].state,
                }
            }
        } catch (error) {
            console.error(`Attempt ${attempt} to find Vercel deployment failed:`, error)
        }

        // Wait 2 seconds before retrying
        await new Promise((resolve) => setTimeout(resolve, 2000))
    }

    throw new AppError('Vercel deployment not found for this commit. Please try again.', 404)
}

/**
 * Retrieves the status of a specific Vercel deployment.
 */
async function getDeploymentStatus(data: GetDeploymentStatus) {
    const { userId, deploymentId } = data
    const creds = await getVercelCredentials(userId)
    const url = buildVercelUrl(`/v13/deployments/${deploymentId}`, creds)

    try {
        const response = await axios.get(url, {
            headers: {
                Authorization: `Bearer ${creds.accessToken}`,
            },
        })
        return {
            id: response.data.id,
            url: response.data.url,
            readyState: response.data.readyState,
        }
    } catch (error: any) {
        throw new AppError(
            'Failed to fetch Vercel deployment status',
            error.response?.status || 500
        )
    }
}

/**
 * Pipes build events stream from Vercel's real-time events API directly to Express response.
 */
async function streamBuildLogs(data: StreamBuildLogs) {
    const { userId, deploymentId, res } = data
    const creds = await getVercelCredentials(userId)
    const url = buildVercelUrl(`/v2/deployments/${deploymentId}/events`, creds)

    res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
    })

    try {
        const response = await fetch(url, {
            headers: {
                Authorization: `Bearer ${creds.accessToken}`,
            },
        })

        if (!response.body) {
            res.write('data: {"type":"error","payload":{"text":"No build logs stream found"}}\n\n')
            res.end()
            return
        }

        const reader = response.body.getReader()
        const decoder = new TextDecoder()

        while (true) {
            const { done, value } = await reader.read()
            if (done) break
            const chunk = decoder.decode(value, { stream: true })
            res.write(chunk)
        }
    } catch (err: any) {
        console.error('Error streaming build logs:', err)
        res.write(
            `data: {"type":"error","payload":{"text":"${err.message || 'Error streaming build logs'}"}}\n\n`
        )
    } finally {
        res.end()
    }
}

/**
 * Retrieves the latest deployment created for a specific Vercel project.
 * Retries since Vercel might take a moment to register the GitHub commit webhook.
 */
async function getLatestDeployment(data: GetLatestDeployment) {
    const { userId, vercelProjectId } = data
    const creds = await getVercelCredentials(userId)
    const baseUrl = buildVercelUrl('/v6/deployments', creds)
    const url = new URL(baseUrl)
    url.searchParams.set('projectId', vercelProjectId)
    url.searchParams.set('limit', '1')

    for (let attempt = 1; attempt <= 5; attempt++) {
        try {
            const response = await axios.get(url.toString(), {
                headers: {
                    Authorization: `Bearer ${creds.accessToken}`,
                },
            })

            const deployments = response.data.deployments
            if (deployments && deployments.length > 0) {
                return {
                    id: deployments[0].uid,
                    url: deployments[0].url,
                    readyState: deployments[0].state,
                }
            }
        } catch (error) {
            console.error(`Attempt ${attempt} to find latest Vercel deployment failed:`, error)
        }

        // Wait 2 seconds before retrying
        await new Promise((resolve) => setTimeout(resolve, 2000))
    }

    throw new AppError('No deployment found on Vercel for this project. Please try again.', 404)
}

export const vercelService = {
    createProject,
    getDeploymentByCommit,
    getLatestDeployment,
    getDeploymentStatus,
    streamBuildLogs,
}
