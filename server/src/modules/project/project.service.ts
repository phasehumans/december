import { prisma } from "../../utils/db"

const getAllProjects = async (userId: string) => {
    const projects = await prisma.project.findMany({
        where: {
            userId: userId
        }
    })

    if(!projects){
        throw new Error("projects doesnot exist")
    }

    return {
        projects
    }

}

const getProjectById = async (userId: string, projectId: string) => {
    const project = await prisma.project.findUnique({
        where: {
            userId: userId,
            id: projectId
        }
    })

    if(!project){
        throw new Error("project doesnot exists")
    }

    return {
        name: project.name,
        prompt: project.prompt,
        star: project.starred,
        edited: project.updatedAt
    }
}

const createProject = async () => {

}

const updateProject = async () => {

}

const deleteProject = async () => {

}


export const projectService = {
    getAllProjects,
    getProjectById,
    createProject,
    updateProject,
    deleteProject
}