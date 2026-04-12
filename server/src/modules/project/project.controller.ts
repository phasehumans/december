import type { Request, Response } from 'express'

import { projectService } from './project.service'
import {
    createProjectSchema,
    projectVersionQuerySchema,
    updateProjectSchema,
} from './project.schema'

const getErrorStatus = (message: string) =>
    message.toLowerCase().includes('not found') ? 404 : 500

const getAllProjects = async (req: Request, res: Response) => {
    const userId = req.userId as string | undefined

    if (!userId) {
        return res.status(400).json({
            success: false,
            message: 'unauthorized',
        })
    }

    try {
        const result = await projectService.getAllProjects(userId)
        return res.status(200).json({
            success: true,
            message: 'projects fetched successfully',
            data: result,
        })
    } catch (error: any) {
        return res.status(500).json({
            success: false,
            errors: error.message,
        })
    }
}

const getProjectById = async (req: Request, res: Response) => {
    const userId = req.userId as string | undefined
    const projectId = req.params.projectId as string | undefined
    const parseQuery = projectVersionQuerySchema.safeParse(req.query)

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

    if (!parseQuery.success) {
        return res.status(400).json({
            success: false,
            message: 'validation failed',
            errors: parseQuery.error.flatten().fieldErrors,
        })
    }

    try {
        const result = await projectService.getProjectById({
            userId,
            projectId,
            versionId: parseQuery.data.versionId,
        })
        return res.status(200).json({
            success: true,
            message: 'project fetched successfully',
            data: result,
        })
    } catch (error: any) {
        return res.status(getErrorStatus(error.message)).json({
            success: false,
            errors: error.message,
        })
    }
}

const createProject = async (req: Request, res: Response) => {
    const parseData = createProjectSchema.safeParse(req.body)

    if (!parseData.success) {
        return res.status(400).json({
            success: false,
            message: 'validation failed',
            errors: parseData.error.flatten().fieldErrors,
        })
    }

    const userId = req.userId as string | undefined

    if (!userId) {
        return res.status(400).json({
            success: false,
            message: 'unauthorized',
        })
    }

    try {
        const { name, description, prompt } = parseData.data
        const result = await projectService.createProject({ name, description, prompt, userId })
        return res.status(201).json({
            success: true,
            message: 'project created',
            data: result,
        })
    } catch (error: any) {
        return res.status(500).json({
            success: false,
            errors: error.message,
        })
    }
}

const updateProject = async (req: Request, res: Response) => {
    const parseData = updateProjectSchema.safeParse(req.body)

    if (!parseData.success) {
        return res.status(400).json({
            success: false,
            message: 'validation failed',
            errors: parseData.error.flatten().fieldErrors,
        })
    }

    const userId = req.userId as string | undefined
    const projectId = req.params.projectId as string | undefined

    if (!projectId) {
        return res.status(400).json({
            success: false,
            message: 'project id is required',
        })
    }

    if (!userId) {
        return res.status(400).json({
            success: false,
            message: 'unauthorized',
        })
    }

    try {
        const { rename, isStarred } = parseData.data
        const result = await projectService.updateProject({ projectId, userId, rename, isStarred })
        return res.status(200).json({
            success: true,
            message: 'project updated',
            data: result,
        })
    } catch (error: any) {
        return res.status(500).json({
            success: false,
            errors: error.message,
        })
    }
}

const deleteProject = async (req: Request, res: Response) => {
    const userId = req.userId as string | undefined
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
        const result = await projectService.deleteProject({ userId, projectId })
        return res.status(200).json({
            success: true,
            message: 'project deleted',
            data: result,
        })
    } catch (error: any) {
        return res.status(getErrorStatus(error.message)).json({
            success: false,
            errors: error.message,
        })
    }
}

const duplicateProject = async (req: Request, res: Response) => {
    const userId = req.userId as string | undefined
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
        const result = await projectService.duplicateProject({ userId, projectId })
        return res.status(200).json({
            success: true,
            message: 'project duplicated',
            data: result,
        })
    } catch (error: any) {
        return res.status(getErrorStatus(error.message)).json({
            success: false,
            errors: error.message,
        })
    }
}

const downloadProjectVersion = async (req: Request, res: Response) => {
    const userId = req.userId as string | undefined
    const projectId = req.params.projectId as string | undefined
    const parseQuery = projectVersionQuerySchema.safeParse(req.query)

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

    if (!parseQuery.success) {
        return res.status(400).json({
            success: false,
            message: 'validation failed',
            errors: parseQuery.error.flatten().fieldErrors,
        })
    }

    try {
        const result = await projectService.downloadProjectVersion({
            userId,
            projectId,
            versionId: parseQuery.data.versionId,
        })

        res.setHeader('Content-Type', 'application/zip')
        res.setHeader('Content-Disposition', `attachment; filename="${result.fileName}"`)
        return res.status(200).send(Buffer.from(result.zip))
    } catch (error: any) {
        return res.status(getErrorStatus(error.message)).json({
            success: false,
            errors: error.message,
        })
    }
}

const shareProjectAsTemplate = async (req: Request, res: Response) => {
    const userId = req.userId as string | undefined
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
        const result = await projectService.shareProjectAsTemplate({ userId, projectId })
        return res.status(200).json({
            success: true,
            message: 'project shared as template',
            data: result,
        })
    } catch (error: any) {
        return res.status(getErrorStatus(error.message)).json({
            success: false,
            errors: error.message,
        })
    }
}

export const projectController = {
    getAllProjects,
    getProjectById,
    createProject,
    updateProject,
    deleteProject,
    duplicateProject,
    downloadProjectVersion,
    shareProjectAsTemplate,
}
