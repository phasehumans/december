import type { Request, Response } from 'express'
import { projectService } from './project.service'
import { success } from 'zod'
import { createProjectSchema, upadteProjectSchema } from './project.schema'

const getAllProjects = async (req: Request, res: Response) => {
    const userId = req.userId as string | undefined

    if (!userId) {
        return res.status(400).json({
            success: false,
            message: 'unauthorized',
        })
    }

    try {
        const typedUserId: string = userId
        const result = await projectService.getAllProjects(typedUserId)
        return res.status(200).json({
            success: true,
            message: 'all projects',
            data: result,
        })
    } catch (error: any) {
        return res.status(500).json({
            success: false,
            message: 'error while fetching projects',
            errors: error.message,
        })
    }
}

const getProjectById = async (req: Request, res: Response) => {
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
            message: 'no project id',
        })
    }

    try {
        const result = await projectService.getProjectById(userId, projectId)
        return res.status(200).json({
            success: true,
            message: 'projects',
            data: result,
        })
    } catch (error: any) {
        return res.status(500).json({
            success: false,
            message: 'error while fetching project',
            errors: error.message,
        })
    }
}

const createProject = async (req: Request, res: Response) => {
    const parseData = createProjectSchema.safeParse(req.body)

    if (!parseData.success) {
        return res.status(400).json({
            success: false,
            message: 'invalid inputs',
            errors: parseData.error.flatten(),
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
        const projectInfo = parseData.data
        const result = await projectService.createProject(projectInfo, userId)
        return res.status(201).json({
            success: true,
            message: 'project created successfully',
            data: result,
        })
    } catch (error: any) {
        return res.status(500).json({
            success: false,
            message: 'error while creating project',
            errors: error.message,
        })
    }
}

const updateProject = async (req: Request, res: Response) => {
    const parseData = upadteProjectSchema.safeParse(req.body)

    if (!parseData.success) {
        return res.status(400).json({
            success: false,
            message: 'invalid inputs',
            errors: parseData.error.flatten(),
        })
    }

    const userId = req.userId as string | undefined
    const projectId = req.params.projectId as string | undefined

    if (!projectId) {
        return res.status(400).json({
            success: false,
            message: 'projectId is required',
        })
    }

    if (!userId) {
        return res.status(400).json({
            success: false,
            message: 'unauthorized',
        })
    }

    try {
        const updateProjectInfo = parseData.data
        const result = await projectService.updateProject(updateProjectInfo, projectId, userId)
        return res.status(200).json({
            success: true,
            message: 'project details updated',
            data: result,
        })
    } catch (error: any) {
        return res.status(500).json({
            success: false,
            message: 'error while update project',
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
            message: 'projectId not found',
        })
    }

    try {
        const result = await projectService.deleteProject(userId, projectId)
        return res.status(200).json({
            success: true,
            message: 'project deleted successfully',
            data: result,
        })
    } catch (error: any) {
        return res.status(500).json({
            success: false,
            message: 'error while deleting project',
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
}
