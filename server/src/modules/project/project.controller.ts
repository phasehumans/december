import type { Request, Response } from "express"

const getAllProjects = async (req: Request, res: Response) => {
    const userId = req.userId

}

const getProjectById = async (req: Request, res: Response) => {

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