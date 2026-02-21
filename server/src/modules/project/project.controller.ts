import type { Request, Response } from "express"
import { projectService } from "./project.service"
import { success } from "zod"

const getAllProjects = async (req: Request, res: Response) => {
    const userId = req.userId as string | undefined

    if(!userId) {
        return res.status(400).json({
            success: false,
            message: "unauthorized"
        })
    }

    try {
        const typedUserId: string = userId
        const result = await projectService.getAllProjects(typedUserId)
        return res.status(200).json({
            success: true,
            message: "all projects",
            data: result
        })
    } catch (error: any) {
        return res.status(500).json({
            success: false,
            message: "error while fetching projects",
            errors: error.message
        })
    }
}

const getProjectById = async (req: Request, res: Response) => {
    const userId = req.userId as string | undefined
    const projectId = req.params.projectId as string | undefined

    if(!userId) {
        return res.status(400).json({
            success: false,
            message: "unauthorized"
        })
    }

    if(!projectId) {
        return res.status(400).json({
            success: false,
            message: "no project id"
        })
    }

    try {
        const result = await projectService.getProjectById(userId, projectId)
        return res.status(200).json({
            success: true,
            message: "projects",
            data: result
        })
    } catch (error: any) {
        return res.status(500).json({
            success: false,
            message: "error while fetching project",
            errors: error.message
        })
    }
}

const createProject = async (req: Request, res: Response) => {

}

const updateProject = async (req: Request, res: Response) => {

}

const deleteProject = async (req: Request, res: Response) => {

}

export const projectController = {
    getAllProjects,
    getProjectById, 
    createProject,
    updateProject,
    deleteProject
}