import { prisma } from '../../config/db'
import { AppError } from '../../shared/appError'

import { createGithubRepoSchema, syncGithubRepoSchema } from './integrations.schema'
import { integrationsService } from './integrations.service'
import { vercelService } from './vercel.service'

import type { Request, Response } from 'express'

const getUserGithubRepos = async (req: Request, res: Response) => {
    const userId = req.user?.userId as string | undefined

    if (!userId) {
        return res.status(400).json({
            success: false,
            message: 'unauthorized',
        })
    }

    try {
        const result = await integrationsService.listGithubRepos({ userId })
        return res.status(200).json({
            success: true,
            message: 'repos fetched successfully',
            data: result,
        })
    } catch (error) {
        if (error instanceof AppError) {
            return res.status(error.statusCode).json({
                success: false,
                message: 'failed to get user repos',
                errors: error.message,
            })
        }

        return res.status(500).json({
            success: false,
            message: 'failed to get user repos',
            errors: error instanceof Error ? error.message : 'unknown error',
        })
    }
}

const connectVercel = async (req: Request, res: Response) => {
    const code = req.query.code as string
    const teamId = req.query.teamId as string
    const configurationId = req.query.configurationId as string
    const state = req.query.state as string

    let userId = state
    let redirectPath = '/profile/integrations'
    if (state && state.includes(':')) {
        const parts = state.split(':')
        userId = parts[0] as string
        redirectPath = parts.slice(1).join(':')
    }

    try {
        if (!code) {
            throw new AppError('no code provided', 400)
        }

        if (!userId) {
            throw new AppError('no user id provided', 400)
        }

        await integrationsService.connectVercel({
            code,
            userId,
            teamId,
            configurationId,
        })

        return res.redirect(`http://localhost:3000${redirectPath}`)
    } catch (error) {
        if (error instanceof AppError) {
            return res.status(error.statusCode).json({
                success: false,
                message: 'failed to connect vercel',
                errors: error.message,
            })
        }

        return res.status(500).json({
            success: false,
            message: 'failed to connect vercel',
            errors: error instanceof Error ? error.message : 'unknown error',
        })
    }
}

const connectSupabase = async (req: Request, res: Response) => {
    try {
        const code = req.query.code as string
        const userId = req.query.state as string

        if (!code) {
            throw new AppError('no code provided', 400)
        }

        if (!userId) {
            throw new AppError('no user id provided', 400)
        }

        await integrationsService.connectSupabase({
            userId,
            code,
        })

        return res.redirect('http://localhost:3000/profile/integrations')
    } catch (error) {
        if (error instanceof AppError) {
            return res.status(error.statusCode).json({
                success: false,
                message: 'failed to connect supabase',
                errors: error.message,
            })
        }

        return res.status(500).json({
            success: false,
            message: 'failed to connect supabase',
            errors: error instanceof Error ? error.message : 'unknown error',
        })
    }
}

const connectNotion = async (req: Request, res: Response) => {
    try {
        const code = req.query.code as string
        const userId = req.query.state as string

        if (!code) {
            throw new AppError('no code provided', 400)
        }

        if (!userId) {
            throw new AppError('no user id provided', 400)
        }

        await integrationsService.connectNotion({
            userId,
            code,
        })

        return res.redirect('http://localhost:3000/profile/integrations')
    } catch (error) {
        if (error instanceof AppError) {
            return res.status(error.statusCode).json({
                success: false,
                message: 'failed to connect notion',
                errors: error.message,
            })
        }

        return res.status(500).json({
            success: false,
            message: 'failed to connect notion',
            errors: error instanceof Error ? error.message : 'unknown error',
        })
    }
}

const connectGithub = async (req: Request, res: Response) => {
    const code = req.query.code as string
    const state = req.query.state as string

    if (!code) {
        return res.status(400).json({
            success: false,
            message: 'no code provided',
        })
    }

    let userId = state
    let redirectPath = '/profile/integrations'
    if (state && state.includes(':')) {
        const parts = state.split(':')
        userId = parts[0] as string
        redirectPath = parts.slice(1).join(':')
    }

    type GithubTokenResponse = {
        access_token: string
        token_type: string
        scope: string
    }

    try {
        const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
            method: 'POST',
            headers: {
                Accept: 'application/json',
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                client_id: process.env.GITHUB_CLIENT_ID,
                client_secret: process.env.GITHUB_CLIENT_SECRET,
                code,
            }),
        })

        const tokenData = (await tokenResponse.json()) as GithubTokenResponse
        const accessToken = tokenData.access_token

        const userRes = await fetch('https://api.github.com/user', {
            headers: {
                Authorization: `Bearer ${accessToken}`,
            },
        })

        const githubUser: any = await userRes.json()
        const username = githubUser.login

        await integrationsService.connectGithub({ userId, accessToken, username })
        return res.redirect(`http://localhost:3000${redirectPath}`)
    } catch (error) {
        if (error instanceof AppError) {
            return res.status(error.statusCode).json({
                success: false,
                message: 'failed to connect with github',
                errors: error.message,
            })
        }

        return res.status(500).json({
            success: false,
            message: 'failed to connect with github',
            errors: error instanceof Error ? error.message : 'unknown error',
        })
    }
}

const createRepo = async (req: Request, res: Response) => {
    const userId = req.user?.userId as string | undefined
    const projectId = req.params.projectId as string | undefined
    const parseData = createGithubRepoSchema.safeParse(req.body)

    if (!userId) {
        return res.status(400).json({
            success: false,
            message: 'unauthorized',
        })
    }

    if (!projectId) {
        return res.status(400).json({
            success: false,
            message: 'project id is required',
        })
    }

    if (!parseData.success) {
        return res.status(400).json({
            success: false,
            message: 'validation failed',
            errors: parseData.error.flatten().fieldErrors,
        })
    }

    try {
        const result = await integrationsService.createRepo({
            userId,
            projectId,
            ...parseData.data,
        })
        return res.status(200).json({
            success: true,
            message: 'repository created and linked successfully',
            data: result,
        })
    } catch (error) {
        if (error instanceof AppError) {
            return res.status(error.statusCode).json({
                success: false,
                message: 'failed to create repository',
                errors: error.message,
            })
        }

        return res.status(500).json({
            success: false,
            message: 'failed to create repository',
            errors: error instanceof Error ? error.message : 'unknown error',
        })
    }
}

const updateRepo = async (req: Request, res: Response) => {
    const userId = req.user?.userId as string | undefined
    const projectId = req.params.projectId as string | undefined
    const parseData = syncGithubRepoSchema.safeParse(req.body)

    if (!userId) {
        return res.status(400).json({
            success: false,
            message: 'unauthorized',
        })
    }

    if (!projectId) {
        return res.status(400).json({
            success: false,
            message: 'project id is required',
        })
    }

    if (!parseData.success) {
        return res.status(400).json({
            success: false,
            message: 'validation failed',
            errors: parseData.error.flatten().fieldErrors,
        })
    }

    try {
        const result = await integrationsService.updateRepo({
            userId,
            projectId,
            ...parseData.data,
        })
        return res.status(200).json({
            success: true,
            message: 'repository synced successfully',
            data: result,
        })
    } catch (error) {
        if (error instanceof AppError) {
            return res.status(error.statusCode).json({
                success: false,
                message: 'failed to sync repository',
                errors: error.message,
            })
        }

        return res.status(500).json({
            success: false,
            message: 'failed to sync repository',
            errors: error instanceof Error ? error.message : 'unknown error',
        })
    }
}
const deployVercelProject = async (req: Request, res: Response) => {
    const userId = req.user?.userId as string | undefined
    const projectId = req.params.projectId as string | undefined

    if (!userId || !projectId) {
        return res.status(400).json({
            success: false,
            message: 'User ID and Project ID are required',
        })
    }

    try {
        const project = await prisma.project.findUnique({
            where: { id: projectId },
        })

        if (!project || project.userId !== userId) {
            throw new AppError('Project not found', 404)
        }

        if (!project.githubRepoOwner || !project.githubRepoName) {
            throw new AppError('Project is not linked to any GitHub repository', 400)
        }

        let vercelProjectId = project.vercelProjectId
        let vercelProjectName = project.vercelProjectName

        if (!vercelProjectId) {
            const sanitizedName = project.name
                .toLowerCase()
                .replace(/[^a-z0-9-]/g, '-')
                .replace(/-+/g, '-')
                .replace(/^-|-$/g, '')

            const vercelProject = await vercelService.createProject({
                userId,
                name: sanitizedName,
                repoOwner: project.githubRepoOwner,
                repoName: project.githubRepoName,
            })
            vercelProjectId = vercelProject.id
            vercelProjectName = vercelProject.name

            await prisma.project.update({
                where: { id: projectId },
                data: {
                    vercelProjectId,
                    vercelProjectName,
                },
            })
        }

        const { commitSha } = await integrationsService.updateRepo({
            userId,
            projectId,
            commitMessage: 'Auto-deploy triggered from December settings',
        })

        const deployment = await vercelService.getDeploymentByCommit({
            userId,
            vercelProjectId: vercelProjectId!,
            commitSha,
        })

        await prisma.project.update({
            where: { id: projectId },
            data: {
                vercelDeploymentUrl: deployment.url,
                vercelLastDeployedAt: new Date(),
            },
        })

        return res.status(200).json({
            success: true,
            message: 'Auto-deployment triggered on Vercel successfully',
            data: {
                deploymentId: deployment.id,
                url: deployment.url,
                readyState: deployment.readyState,
            },
        })
    } catch (error) {
        if (error instanceof AppError) {
            return res.status(error.statusCode).json({
                success: false,
                message: 'failed to deploy to vercel',
                errors: error.message,
            })
        }

        return res.status(500).json({
            success: false,
            message: 'failed to deploy to vercel',
            errors: error instanceof Error ? error.message : 'unknown error',
        })
    }
}

const getVercelDeploymentStatus = async (req: Request, res: Response) => {
    const userId = req.user?.userId as string | undefined
    const deploymentId = req.params.deploymentId as string | undefined

    if (!userId || !deploymentId) {
        return res.status(400).json({
            success: false,
            message: 'User ID and Deployment ID are required',
        })
    }

    try {
        const result = await vercelService.getDeploymentStatus({ userId, deploymentId })
        return res.status(200).json({
            success: true,
            message: 'Deployment status fetched successfully',
            data: result,
        })
    } catch (error) {
        if (error instanceof AppError) {
            return res.status(error.statusCode).json({
                success: false,
                message: 'failed to fetch deployment status',
                errors: error.message,
            })
        }

        return res.status(500).json({
            success: false,
            message: 'failed to fetch deployment status',
            errors: error instanceof Error ? error.message : 'unknown error',
        })
    }
}

const streamVercelBuildLogs = async (req: Request, res: Response) => {
    const userId = req.user?.userId as string | undefined
    const deploymentId = req.params.deploymentId as string | undefined

    if (!userId || !deploymentId) {
        return res.status(400).json({
            success: false,
            message: 'User ID and Deployment ID are required',
        })
    }

    try {
        await vercelService.streamBuildLogs({ userId, deploymentId, res })
    } catch (error) {
        console.error('Failed to stream build logs:', error)
        if (!res.headersSent) {
            return res.status(500).json({
                success: false,
                message: 'failed to stream build logs',
                errors: error instanceof Error ? error.message : 'unknown error',
            })
        }
    }
}

export const integrationsController = {
    getUserGithubRepos,
    connectVercel,
    connectSupabase,
    connectNotion,
    connectGithub,
    createRepo,
    updateRepo,
    deployVercelProject,
    getVercelDeploymentStatus,
    streamVercelBuildLogs,
}
