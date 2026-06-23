import { AppError } from '../../shared/appError'
import { asyncHandler } from '../../shared/asyncHandler'
import { sendSuccess } from '../../shared/response'

import { platformRepository } from './platform.repository'
import {
    downloadProjectVersionSchema,
    createGithubRepoSchema,
    syncGithubRepoSchema,
} from './platform.schema'
import { platformService } from './platform.service'
import { vercelService } from './vercel.service'

import type { Request, Response } from 'express'

const deployDecemberProject = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.userId as string | undefined
    const projectId = req.params.projectId as string | undefined

    if (!userId) {
        throw new AppError('unauthorized', 401)
    }

    if (!projectId) {
        throw new AppError('project id is required', 400)
    }

    const result = await platformService.deployDecemberProject({ projectId, userId })
    return sendSuccess(res, result.message, result)
})

const downloadProjectVersion = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.userId as string | undefined
    const projectId = req.params.projectId as string | undefined

    if (!userId) {
        throw new AppError('unauthorized', 401)
    }

    if (!projectId) {
        throw new AppError('project id is required', 400)
    }

    const parseData = downloadProjectVersionSchema.parse(req.query)
    const { versionId } = parseData

    const result = await platformService.downloadProjectVersion({
        userId,
        projectId,
        versionId,
    })

    res.setHeader('Content-Type', 'application/zip')
    res.setHeader('Content-Disposition', `attachment; filename="${result.fileName}"`)
    return res.status(200).send(Buffer.from(result.zip))
})

const deployVercelProject = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.userId as string | undefined
    const projectId = req.params.projectId as string | undefined

    if (!userId) {
        throw new AppError('unauthorized', 401)
    }

    if (!projectId) {
        throw new AppError('project id is required', 400)
    }

    const project = await platformRepository.findProjectById({ projectId })

    if (!project || project.userId !== userId) {
        throw new AppError('project not found', 404)
    }

    if (!project.githubRepoOwner || !project.githubRepoName) {
        throw new AppError('project is not linked to any github repository', 400)
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

        await platformRepository.updateProjectVercelLink({
            projectId,
            vercelProjectId,
            vercelProjectName,
        })
    }

    const { commitSha } = await platformService.updateRepo({
        userId,
        projectId,
        commitMessage: 'Auto-deploy triggered from December settings',
    })

    const deployment = await vercelService.getDeploymentByCommit({
        userId,
        vercelProjectId: vercelProjectId!,
        commitSha,
    })

    await platformRepository.updateProjectVercelDeployment({
        projectId,
        url: deployment.url,
    })

    return sendSuccess(res, 'auto-deployment triggered on vercel successfully', {
        deploymentId: deployment.id,
        url: deployment.url,
        readyState: deployment.readyState,
    })
})

const getVercelDeploymentStatus = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.userId as string | undefined
    const deploymentId = req.params.deploymentId as string | undefined

    if (!userId) {
        throw new AppError('unauthorized', 401)
    }

    if (!deploymentId) {
        throw new AppError('deployment id is required', 400)
    }

    const result = await vercelService.getDeploymentStatus({ userId, deploymentId })
    return sendSuccess(res, 'deployment status fetched successfully', result)
})

const streamVercelBuildLogs = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.userId as string | undefined
    const deploymentId = req.params.deploymentId as string | undefined

    if (!userId) {
        throw new AppError('unauthorized', 401)
    }

    if (!deploymentId) {
        throw new AppError('deployment id is required', 400)
    }

    await vercelService.streamBuildLogs({ userId, deploymentId, res })
})

const getUserGithubRepos = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.userId as string | undefined

    if (!userId) {
        throw new AppError('unauthorized', 401)
    }

    const result = await platformService.getUserGithubRepos({ userId })
    return sendSuccess(res, 'repos fetched successfully', result)
})

const createRepo = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.userId as string | undefined
    const projectId = req.params.projectId as string | undefined

    if (!userId) {
        throw new AppError('unauthorized', 401)
    }

    if (!projectId) {
        throw new AppError('project id is required', 400)
    }

    const parsedBody = createGithubRepoSchema.parse(req.body)
    const result = await platformService.createRepo({
        userId,
        projectId,
        ...parsedBody,
    })

    return sendSuccess(res, 'repository created and linked successfully', result)
})

const updateRepo = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.userId as string | undefined
    const projectId = req.params.projectId as string | undefined

    if (!userId) {
        throw new AppError('unauthorized', 401)
    }

    if (!projectId) {
        throw new AppError('project id is required', 400)
    }

    const parsedBody = syncGithubRepoSchema.parse(req.body)
    const result = await platformService.updateRepo({
        userId,
        projectId,
        ...parsedBody,
    })

    return sendSuccess(res, 'repository synced successfully', result)
})

export const platformController = {
    deployDecemberProject,
    downloadProjectVersion,
    deployVercelProject,
    getVercelDeploymentStatus,
    streamVercelBuildLogs,
    getUserGithubRepos,
    createRepo,
    updateRepo,
}
