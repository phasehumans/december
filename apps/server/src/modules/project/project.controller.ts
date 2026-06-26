import { AppError } from '../../shared/appError'
import { asyncHandler } from '../../shared/asyncHandler'
import { sendSuccess } from '../../shared/response'

import {
    createProjectSchema,
    getProjectByIdSchema,
    renameProjectSchema,
    updateGeneralSettingsSchema,
    shareProjectAsTemplateSchema,
    toggleStarProjectSchema,
    duplicateProjectSchema,
    addCollaboratorSchema,
} from './project.schema'
import { projectService } from './project.service'

import type { Request, Response } from 'express'

const getAllProjects = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.userId as string | undefined

    if (!userId) {
        throw new AppError('unauthorized', 400)
    }

    const result = await projectService.getAllProjects({ userId })
    return sendSuccess(res, 'projects fetched successfully', result)
})

const getProjectById = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.userId as string | undefined
    const projectId = req.params.projectId as string | undefined

    if (!userId) {
        throw new AppError('unauthorized', 400)
    }

    if (!projectId) {
        throw new AppError('project id is required', 400)
    }

    const parseData = getProjectByIdSchema.parse(req.query)
    const { versionId } = parseData

    const result = await projectService.getProjectById({
        userId,
        projectId,
        versionId,
    })
    return sendSuccess(res, 'project fetched successfully', result)
})

const createProject = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.userId as string | undefined

    if (!userId) {
        throw new AppError('unauthorized', 400)
    }

    const parseData = createProjectSchema.parse(req.body)
    const { name, description, prompt } = parseData

    const result = await projectService.createProject({ name, description, prompt, userId })
    return sendSuccess(res, 'project created successfully', result, 201)
})

const renameProject = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.userId as string | undefined
    const projectId = req.params.projectId as string | undefined

    if (!userId) {
        throw new AppError('unauthorized', 400)
    }

    if (!projectId) {
        throw new AppError('project id is required', 400)
    }

    const parseData = renameProjectSchema.parse(req.body)
    const { rename } = parseData

    const result = await projectService.renameProject({
        projectId,
        userId,
        rename,
    })
    return sendSuccess(res, 'project updated successfully', result)
})

const updateGeneralSettings = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.userId as string | undefined
    const projectId = req.params.projectId as string | undefined

    if (!userId) {
        throw new AppError('unauthorized', 400)
    }

    if (!projectId) {
        throw new AppError('project id is required', 400)
    }

    const parseData = updateGeneralSettingsSchema.parse(req.body)
    const { name, description, isStarred, isSharedAsTemplate, projectCategory } = parseData

    const result = await projectService.updateGeneralSettings({
        projectId,
        userId,
        name,
        description,
        isStarred,
        isSharedAsTemplate,
        projectCategory,
    })
    return sendSuccess(res, 'project general settings updated successfully', result)
})

const deleteProject = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.userId as string | undefined
    const projectId = req.params.projectId as string | undefined

    if (!userId) {
        throw new AppError('unauthorized', 400)
    }

    if (!projectId) {
        throw new AppError('project id is required', 400)
    }

    const result = await projectService.deleteProject({ userId, projectId })
    return sendSuccess(res, 'project deleted successfully', result)
})

const duplicateProject = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.userId as string | undefined
    const projectId = req.params.projectId as string | undefined

    if (!userId) {
        throw new AppError('unauthorized', 400)
    }

    if (!projectId) {
        throw new AppError('project id is required', 400)
    }

    const parseData = duplicateProjectSchema.parse(req.body || {})
    const { name } = parseData

    const result = await projectService.duplicateProject({ userId, projectId, name })
    return sendSuccess(res, 'project duplicated', result)
})

const shareProjectAsTemplate = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.userId as string | undefined
    const projectId = req.params.projectId as string | undefined

    if (!userId) {
        throw new AppError('unauthorized', 400)
    }

    if (!projectId) {
        throw new AppError('project id is required', 400)
    }

    const parseData = shareProjectAsTemplateSchema.parse(req.body)
    const { isSharedAsTemplate, projectCategory } = parseData

    const result = await projectService.shareProjectAsTemplate({
        userId,
        projectId,
        isSharedAsTemplate,
        projectCategory,
    })

    const message = isSharedAsTemplate
        ? 'project shared as template'
        : 'project unshared as template'

    return sendSuccess(res, message, result)
})

const toggleStarProject = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.userId as string | undefined
    const projectId = req.params.projectId as string | undefined

    if (!userId) {
        throw new AppError('unauthorized', 400)
    }

    if (!projectId) {
        throw new AppError('project id is required', 400)
    }

    const parseData = toggleStarProjectSchema.parse(req.body)
    const { isStarred } = parseData

    const result = await projectService.toggleStarProject({ userId, projectId, isStarred })
    return sendSuccess(res, 'project isstarred state updated successfully', result)
})

const getCollaborators = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.userId as string | undefined
    const projectId = req.params.projectId as string | undefined

    if (!userId) {
        throw new AppError('unauthorized', 400)
    }

    if (!projectId) {
        throw new AppError('project id is required', 400)
    }

    const result = await projectService.getCollaborators({ userId, projectId })
    return sendSuccess(res, 'collaborators fetched successfully', result)
})

const addCollaborator = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.userId as string | undefined
    const projectId = req.params.projectId as string | undefined

    if (!userId) {
        throw new AppError('unauthorized', 400)
    }

    if (!projectId) {
        throw new AppError('project id is required', 400)
    }

    const parseData = addCollaboratorSchema.parse(req.body)
    const { email } = parseData

    const result = await projectService.addCollaborator({ userId, projectId, email })
    return sendSuccess(res, 'collaborator added successfully', result, 201)
})

const removeCollaborator = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.userId as string | undefined
    const projectId = req.params.projectId as string | undefined
    const email = req.params.email as string | undefined

    if (!userId) {
        throw new AppError('unauthorized', 400)
    }

    if (!projectId) {
        throw new AppError('project id is required', 400)
    }

    if (!email) {
        throw new AppError('email is required', 400)
    }

    const result = await projectService.removeCollaborator({ userId, projectId, email })
    return sendSuccess(res, 'collaborator removed successfully', result)
})

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
    getCollaborators,
    addCollaborator,
    removeCollaborator,
}
