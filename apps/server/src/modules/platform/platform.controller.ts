import { prisma } from '@december/database'
import { downloadProjectVersionSchema } from '@december/shared'

import { AppError } from '../../shared/appError'
import { integrationsService } from '../integration/integration.service'

import { platformService } from './platform.service'
import { vercelService } from './vercel.service'

import type { Request, Response } from 'express'

const deployDecemberProject = async (req: Request, res: Response) => {
    const userId = req.user?.userId as string | undefined
    const projectId = req.params.projectId as string | undefined

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

    try {
        const result = await platformService.deployDecemberProject({ projectId, userId })
        return res.status(200).json({
            success: true,
            message: result.message,
            data: result,
        })
    } catch (error) {
        if (error instanceof AppError) {
            return res.status(error.statusCode).json({
                success: false,
                message: 'failed to deploy project to December',
                errors: error.message,
            })
        }

        return res.status(500).json({
            success: false,
            message: 'failed to deploy project to December',
            errors: error instanceof Error ? error.message : 'unknown error',
        })
    }
}

const downloadProjectVersion = async (req: Request, res: Response) => {
    const userId = req.user?.userId as string | undefined
    const projectId = req.params.projectId as string | undefined
    const parseData = downloadProjectVersionSchema.safeParse(req.query)

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

    const { versionId } = parseData.data

    try {
        const result = await platformService.downloadProjectVersion({
            userId,
            projectId,
            versionId,
        })
        res.setHeader('Content-Type', 'application/zip')
        res.setHeader('Content-Disposition', `attachment; filename="${result.fileName}"`)
        return res.status(200).send(Buffer.from(result.zip))
    } catch (error) {
        if (error instanceof AppError) {
            return res.status(error.statusCode).json({
                success: false,
                message: 'failed to download project',
                errors: error.message,
            })
        }

        return res.status(500).json({
            success: false,
            message: 'failed to download project',
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

export const platformController = {
    deployDecemberProject,
    downloadProjectVersion,
    deployVercelProject,
    getVercelDeploymentStatus,
    streamVercelBuildLogs,
}
