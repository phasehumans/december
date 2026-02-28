import { string } from 'zod'
import { prisma } from '../../utils/db'

type GetProject = {
    userId: string
    projectId: string
}

type CreateProject = {
    name: string,
    prompt: string,
    userId: string
}

type UpdateProject = {
    projectId: string
    userId: string
    rename?: string
    starred?: boolean
}

type DeleteProject = {
    userId: string,
    projectId: string
}

const getAllProjects = async (userId: string) => {
    const projects = await prisma.project.findMany({
        where: {
            userId: userId,
        },
    })

    if (!projects) {
        throw new Error('projects not found')
    }

    return projects
}

const getProjectById = async (data: GetProject) => {
    const {userId, projectId} = data
    const project = await prisma.project.findUnique({
        where: {
            userId: userId,
            id: projectId,
        },
    })

    if (!project) {
        throw new Error('project doesnot exist')
    }

    return project
}

const createProject = async (data: CreateProject) => {
    const { name, prompt, userId } = data

    const project = await prisma.project.create({
        data: {
            name: name,
            prompt: prompt,
            starred: false,
            userId: userId,
        },
    })

    return project
}

const updateProject = async (data: UpdateProject) => {
    let { projectId, userId, rename, starred } = data

    const project = await prisma.project.findUnique({
        where: {
            id: projectId,
            userId: userId,
        },
    })

    if (!project) {
        throw new Error('project not found')
    }

    if (rename == undefined) {
        rename = project.name
    }

    if (starred == undefined) {
        starred = project.starred
    }

    const updatedProject = await prisma.project.update({
        where: {
            id: projectId,
            userId: userId,
        },

        data: {
            name: rename,
            starred: starred,
        },
    })

    return updatedProject
}

const deleteProject = async (data: DeleteProject) => {
    const {userId, projectId} = data

    const project = await prisma.project.delete({
        where: {
            id: projectId,
            userId: userId,
        },
    })

    if(!project){
        throw new Error('project not found')
    }

    return project
}

export const projectService = {
    getAllProjects,
    getProjectById,
    createProject,
    updateProject,
    deleteProject,
}
