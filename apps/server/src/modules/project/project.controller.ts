import { AppError } from '../../shared/appError'

import {
    createProjectSchema,
    getProjectByIdSchema,
    renameProjectSchema,
    updateGeneralSettingsSchema,
    shareProjectAsTemplateSchema,
    toggleStarProjectSchema,
    duplicateProjectSchema,
} from './project.schema'
import { projectService } from './project.service'

import type { Request, Response } from 'express'

const getAllProjects = async (req: Request, res: Response) => {
    const userId = req.user?.userId as string | undefined

    if (!userId) {
        return res.status(400).json({
            success: false,
            message: 'unauthorized',
        })
    }

    try {
        const result = await projectService.getAllProjects({ userId })
        return res.status(200).json({
            success: true,
            message: 'projects fetched successfully',
            data: result,
        })
    } catch (error) {
        if (error instanceof AppError) {
            return res.status(error.statusCode).json({
                success: false,
                message: 'failed to fetch projects',
                errors: error.message,
            })
        }

        return res.status(500).json({
            success: false,
            message: 'failed to fetch projects',
            errors: error instanceof Error ? error.message : 'unknown error',
        })
    }
}

const getProjectById = async (req: Request, res: Response) => {
    const userId = req.user?.userId as string | undefined
    const projectId = req.params.projectId as string | undefined
    const parseData = getProjectByIdSchema.safeParse(req.query)

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
        const result = await projectService.getProjectById({
            userId,
            projectId,
            versionId,
        })
        return res.status(200).json({
            success: true,
            message: 'project fetched successfully',
            data: result,
        })
    } catch (error) {
        if (error instanceof AppError) {
            return res.status(error.statusCode).json({
                success: false,
                message: 'failed to fetch project',
                errors: error.message,
            })
        }

        return res.status(500).json({
            success: false,
            message: 'failed to fetch project',
            errors: error instanceof Error ? error.message : 'unknown error',
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

    const userId = req.user?.userId as string | undefined

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
            message: 'project created successfully',
            data: result,
        })
    } catch (error) {
        if (error instanceof AppError) {
            return res.status(error.statusCode).json({
                success: false,
                message: 'failed to create project',
                errors: error.message,
            })
        }

        return res.status(500).json({
            success: false,
            message: 'failed to create project',
            errors: error instanceof Error ? error.message : 'unknown error',
        })
    }
}

const renameProject = async (req: Request, res: Response) => {
    const parseData = renameProjectSchema.safeParse(req.body)

    if (!parseData.success) {
        return res.status(400).json({
            success: false,
            message: 'validation failed',
            errors: parseData.error.flatten().fieldErrors,
        })
    }

    const userId = req.user?.userId as string | undefined
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
        const { rename } = parseData.data
        const result = await projectService.renameProject({
            projectId,
            userId,
            rename,
        })
        return res.status(200).json({
            success: true,
            message: 'project updated successfully',
            data: result,
        })
    } catch (error) {
        if (error instanceof AppError) {
            return res.status(error.statusCode).json({
                success: false,
                message: 'failed to rename project',
                errors: error.message,
            })
        }

        return res.status(500).json({
            success: false,
            message: 'failed to rename project',
            errors: error instanceof Error ? error.message : 'unknown error',
        })
    }
}

const updateGeneralSettings = async (req: Request, res: Response) => {
    const parseData = updateGeneralSettingsSchema.safeParse(req.body)

    if (!parseData.success) {
        return res.status(400).json({
            success: false,
            message: 'validation failed',
            errors: parseData.error.flatten().fieldErrors,
        })
    }

    const userId = req.user?.userId as string | undefined
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
        const { name, description, isStarred, isSharedAsTemplate, projectCategory } = parseData.data
        const result = await projectService.updateGeneralSettings({
            projectId,
            userId,
            name,
            description,
            isStarred,
            isSharedAsTemplate,
            projectCategory,
        })
        return res.status(200).json({
            success: true,
            message: 'project general settings updated successfully',
            data: result,
        })
    } catch (error) {
        if (error instanceof AppError) {
            return res.status(error.statusCode).json({
                success: false,
                message: 'failed to update general settings',
                errors: error.message,
            })
        }

        return res.status(500).json({
            success: false,
            message: 'failed to update general settings',
            errors: error instanceof Error ? error.message : 'unknown error',
        })
    }
}

const deleteProject = async (req: Request, res: Response) => {
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
        const result = await projectService.deleteProject({ userId, projectId })
        return res.status(200).json({
            success: true,
            message: 'project deleted successfully',
            data: result,
        })
    } catch (error) {
        if (error instanceof AppError) {
            return res.status(error.statusCode).json({
                success: false,
                message: 'failed to delete project',
                errors: error.message,
            })
        }

        return res.status(500).json({
            success: false,
            message: 'failed to delete project',
            errors: error instanceof Error ? error.message : 'unknown error',
        })
    }
}

const duplicateProject = async (req: Request, res: Response) => {
    const parseData = duplicateProjectSchema.safeParse(req.body || {})

    if (!parseData.success) {
        return res.status(400).json({
            success: false,
            message: 'validation failed',
            errors: parseData.error.flatten().fieldErrors,
        })
    }

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
        const { name } = parseData.data
        const result = await projectService.duplicateProject({ userId, projectId, name })
        return res.status(200).json({
            success: true,
            message: 'project duplicated',
            data: result,
        })
    } catch (error) {
        if (error instanceof AppError) {
            return res.status(error.statusCode).json({
                success: false,
                message: 'failed to duplicate project',
                errors: error.message,
            })
        }

        return res.status(500).json({
            success: false,
            message: 'failed to duplicate project',
            errors: error instanceof Error ? error.message : 'unknown error',
        })
    }
}

const shareProjectAsTemplate = async (req: Request, res: Response) => {
    const userId = req.user?.userId as string | undefined
    const projectId = req.params.projectId as string | undefined
    const parseData = shareProjectAsTemplateSchema.safeParse(req.body)

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

    const { isSharedAsTemplate, projectCategory } = parseData.data

    try {
        const result = await projectService.shareProjectAsTemplate({
            userId,
            projectId,
            isSharedAsTemplate,
            projectCategory,
        })
        return res.status(200).json({
            success: true,
            message: isSharedAsTemplate
                ? 'project shared as template'
                : 'project unshared as template',
            data: result,
        })
    } catch (error) {
        if (error instanceof AppError) {
            return res.status(error.statusCode).json({
                success: false,
                message: 'failed to share project as template',
                errors: error.message,
            })
        }

        return res.status(500).json({
            success: false,
            message: 'failed to share project as template',
            errors: error instanceof Error ? error.message : 'unknown error',
        })
    }
}

const toggleStarProject = async (req: Request, res: Response) => {
    const userId = req.user?.userId as string | undefined
    const projectId = req.params.projectId as string | undefined
    const parseData = toggleStarProjectSchema.safeParse(req.body)

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

    const { isStarred } = parseData.data

    try {
        const result = await projectService.toggleStarProject({ userId, projectId, isStarred })
        return res.status(200).json({
            success: true,
            message: 'project isStarred state updated successfully',
            data: result,
        })
    } catch (error) {
        if (error instanceof AppError) {
            return res.status(error.statusCode).json({
                success: false,
                message: 'failed to update isStarred state',
                errors: error.message,
            })
        }

        return res.status(500).json({
            success: false,
            message: 'failed to update isStarred state',
            errors: error instanceof Error ? error.message : 'unknown error',
        })
    }
}

export const projectController = {
    getAllProjects,
    getProjectById,
    createProject,
    renameProject,
    updateGeneralSettings,
    deleteProject,
    duplicateProject,
    shareProjectAsTemplate,
    toggleStarProject,
}
