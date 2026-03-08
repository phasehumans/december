import { prisma } from '../../config/db'

type GetProject = {
    userId: string
    projectId: string
}

type CreateProject = {
    name: string
    description: string | undefined
    prompt: string
    userId: string
}

type UpdateProject = {
    projectId: string
    userId: string
    rename?: string
    isStarred?: boolean
}

type DeleteProject = {
    userId: string
    projectId: string
}

type DuplicateProject = {
    userId: string
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
    const { userId, projectId } = data
    const project = await prisma.project.findUnique({
        where: {
            userId: userId,
            id: projectId,
        },
    })

    if (!project) {
        throw new Error('project not found')
    }

    return project
}

const createProject = async (data: CreateProject) => {
    const { name, description, prompt, userId } = data

    const project = await prisma.project.create({
        data: {
            name: name,
            description: description,
            prompt: prompt,
            isStarred: false,
            userId: userId,
        },
    })

    return project
}

const updateProject = async (data: UpdateProject) => {
    let { projectId, userId, rename, isStarred } = data

    const project = await prisma.project.updateMany({
        where: {
            id: projectId,
            userId: userId,
        },

        data: {
            ...(rename !== undefined && { name: rename }),
            ...(isStarred !== undefined && { isStarred }),
        },
    })

    if (project.count === 0) {
        throw new Error('project not found')
    }

    return { message: 'project updated' }
}

const deleteProject = async (data: DeleteProject) => {
    const { userId, projectId } = data

    const project = await prisma.project.delete({
        where: {
            id: projectId,
            userId: userId,
        },
    })

    if (!project) {
        throw new Error('project not found')
    }

    return project
}

const duplicateProject = async (data: DuplicateProject) => {
    const { projectId, userId } = data

    const project = await prisma.project.findUnique({
        where: {
            id: projectId,
            userId: userId,
        },
    })

    if (!project) {
        throw new Error('project not found')
    }

    const newProject = await prisma.project.create({
        data: {
            name: `copy of ${project.name}`,
            description: project.description,
            prompt: project.prompt,
            userId: userId,
        },
    })

    return newProject
}

export const projectService = {
    getAllProjects,
    getProjectById,
    createProject,
    updateProject,
    deleteProject,
    duplicateProject,
}
