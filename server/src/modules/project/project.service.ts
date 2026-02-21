import { prisma } from '../../utils/db'

type projectInfoType = {
    name: string
    prompt: string
}

type updateProjectInfoType = {
    rename?: string
    starred?: boolean
}

const getAllProjects = async (userId: string) => {
    const projects = await prisma.project.findMany({
        where: {
            userId: userId,
        },
    })

    if (!projects) {
        throw new Error('projects doesnot exist')
    }

    return projects
}

const getProjectById = async (userId: string, projectId: string) => {
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

const createProject = async (projectInfo: projectInfoType, userId: string) => {
    const { name, prompt } = projectInfo

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

const updateProject = async (
    updateProjectInfo: updateProjectInfoType,
    projectId: string,
    userId: string
) => {
    let { rename, starred } = updateProjectInfo

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

const deleteProject = async (userId: string, projectId: string) => {
    try {
        const project = await prisma.project.delete({
            where: {
                id: projectId,
                userId: userId,
            },
        })

        return project
    } catch (error) {
        throw new Error('project not found')
    }
}

export const projectService = {
    getAllProjects,
    getProjectById,
    createProject,
    updateProject,
    deleteProject,
}
