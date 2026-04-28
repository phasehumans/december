import { prisma } from '../../config/db'
import type { ProjectCategory } from '../../generated/prisma/enums'

const getAllTemplates = async () => {
    const templates = await prisma.project.findMany({
        where: {
            isSharedAsTemplate: true,
        },
    })

    if (templates.length === 0) {
        throw new Error('no templates found')
    }

    return templates
}

const getTemplateById = async (data: string) => {
    const template = await prisma.project.findMany({
        where: {
            id: data,
            isSharedAsTemplate: true,
        },
    })

    if (!template) {
        throw new Error('template not found')
    }

    return template
}

const getTemplatesByCategory = async (data: ProjectCategory) => {
    const templates = await prisma.project.findMany({
        where: {
            isSharedAsTemplate: true,
            projectCategory: data,
        },
    })

    if (templates.length === 0) {
        throw new Error('no templates found for this category')
    }

    return templates
}

export const templateService = {
    getAllTemplates,
    getTemplateById,
    getTemplatesByCategory,
}
