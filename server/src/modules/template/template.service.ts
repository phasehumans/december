import { prisma } from '../../config/db'

const getAllTemplates = async () => {
    const templates = await prisma.project.findMany({
        where: {
            isSharedAsTemplate: true,
        },
    })

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

const getTemplateByCategory = (data: string) => {}

export const templateService = {
    getAllTemplates,
    getTemplateById,
    getTemplateByCategory,
}
