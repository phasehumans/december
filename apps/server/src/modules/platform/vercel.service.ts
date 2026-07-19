import axios from 'axios'

import { AppError } from '../../shared/appError'

import { platformRepository } from './platform.repository'

import type {
    CreateVercelProject,
    GetDeploymentByCommit,
    GetLatestDeployment,
    GetDeploymentStatus,
    StreamBuildLogs,
    CancelDeployment,
} from './platform.types'

interface VercelCredentials {
    accessToken: string
    teamId: string | null
}

async function getVercelCredentials(data: { userId: string }): Promise<VercelCredentials> {
    const { userId } = data
    const user = await platformRepository.getVercelCredentials({ userId })

    if (!user || !user.vercelConnected || !user.vercelAccessToken) {
        throw new AppError('vercel account not connected', 400)
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
 * creates a project on vercel and links it to a github repository.
 */
async function createProject(data: CreateVercelProject) {
    const { userId, name, repoOwner, repoName } = data
    const creds = await getVercelCredentials({ userId })
    const url = buildVercelUrl('/v9/projects', creds)

    const payload: any = {
        name,
        framework: 'vite',
    }

    if (repoOwner && repoName) {
        payload.gitRepository = {
            type: 'github',
            repo: `${repoOwner}/${repoName}`,
        }
    }

    try {
        const response = await axios.post(url, payload, {
            headers: {
                Authorization: `Bearer ${creds.accessToken}`,
                'Content-Type': 'application/json',
            },
        })
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
 * queries vercel deployments to find the one associated with a specific git commit sha.
 * retries with backoff since vercel webhooks take a brief moment to trigger after a push.
 */
async function getDeploymentByCommit(data: GetDeploymentByCommit) {
    const { userId, vercelProjectId, commitSha } = data
    const creds = await getVercelCredentials({ userId })
    const baseUrl = buildVercelUrl('/v6/deployments', creds)
    const url = new URL(baseUrl)
    url.searchParams.set('projectId', vercelProjectId)
    url.searchParams.set('meta-githubCommitSha', commitSha)

    // retry loop (max 30 attempts, every 2s) to wait for vercel webhook registration
    for (let attempt = 1; attempt <= 30; attempt++) {
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

        // wait 2 seconds before retrying
        await new Promise((resolve) => setTimeout(resolve, 2000))
    }

    throw new AppError('Vercel deployment not found for this commit. Please try again.', 404)
}

/**
 * retrieves the status of a specific vercel deployment.
 */
async function getDeploymentStatus(data: GetDeploymentStatus) {
    const { userId, deploymentId } = data
    const creds = await getVercelCredentials({ userId })
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
        const status = error.response?.status || 500
        const message =
            error.response?.data?.error?.message || 'Failed to fetch Vercel deployment status'
        throw new AppError(message, status)
    }
}

/**
 * pipes build events stream from vercel's real-time events api directly to express response.
 */
async function streamBuildLogs(data: StreamBuildLogs) {
    const { userId, deploymentId, res } = data
    const creds = await getVercelCredentials({ userId })
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
 * retrieves the latest deployment created for a specific vercel project.
 * retries since vercel might take a moment to register the github commit webhook.
 */
async function getLatestDeployment(data: GetLatestDeployment) {
    const { userId, vercelProjectId } = data
    const creds = await getVercelCredentials({ userId })
    const baseUrl = buildVercelUrl('/v6/deployments', creds)
    const url = new URL(baseUrl)
    url.searchParams.set('projectId', vercelProjectId)
    url.searchParams.set('limit', '1')

    for (let attempt = 1; attempt <= 30; attempt++) {
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

        // wait 2 seconds before retrying
        await new Promise((resolve) => setTimeout(resolve, 2000))
    }

    throw new AppError('No deployment found on Vercel for this project. Please try again.', 404)
}

async function cancelDeployment(data: CancelDeployment) {
    const { userId, deploymentId } = data
    const creds = await getVercelCredentials({ userId })
    const url = buildVercelUrl(`/v12/deployments/${deploymentId}/cancel`, creds)

    try {
        const response = await axios.patch(
            url,
            {},
            {
                headers: {
                    Authorization: `Bearer ${creds.accessToken}`,
                },
            }
        )
        return response.data
    } catch (error: any) {
        const status = error.response?.status || 500
        const message = error.response?.data?.error?.message || 'Failed to cancel Vercel deployment'
        throw new AppError(message, status)
    }
}

async function addEnvVars(data: {
    userId: string
    vercelProjectId: string
    envVars: { key: string; value: string; type: string; target: string[] }[]
}) {
    const { userId, vercelProjectId, envVars } = data
    const creds = await getVercelCredentials({ userId })
    const url = buildVercelUrl(`/v10/projects/${vercelProjectId}/env`, creds)

    try {
        const response = await axios.post(url, envVars, {
            headers: {
                Authorization: `Bearer ${creds.accessToken}`,
            },
        })
        return response.data
    } catch (error: any) {
        const status = error.response?.status || 500
        const message = error.response?.data?.error?.message || 'Failed to sync env vars to Vercel'
        throw new AppError(message, status)
    }
}

async function createDirectDeployment(data: {
    userId: string
    vercelProjectId: string
    name: string
    files: { file: string; data: string; encoding?: string }[]
}) {
    const { userId, vercelProjectId, name, files } = data
    const creds = await getVercelCredentials({ userId })
    const url = buildVercelUrl(`/v13/deployments`, creds)

    try {
        const response = await axios.post(
            url,
            {
                name,
                projectSettings: {
                    framework: 'vite',
                },
                files,
            },
            {
                headers: {
                    Authorization: `Bearer ${creds.accessToken}`,
                },
            }
        )
        return response.data
    } catch (error: any) {
        const status = error.response?.status || 500
        const message = error.response?.data?.error?.message || 'Failed to create direct deployment'
        throw new AppError(message, status)
    }
}

export const vercelService = {
    createProject,
    getDeploymentByCommit,
    getLatestDeployment,
    getDeploymentStatus,
    streamBuildLogs,
    cancelDeployment,
    addEnvVars,
    createDirectDeployment,
}
