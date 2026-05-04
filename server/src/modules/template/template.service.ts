import { prisma } from '../../config/db'
import { AppError } from '../../utils/appError'

type ToggleLike = {
    userId: string
    templateId: string
    isLiked: boolean
}

const getAllTemplates = async () => {
    try {
        const templates = await prisma.project.findMany({
            where: {
                isSharedAsTemplate: true,
            },
        })
        return templates
    } catch (error) {
        throw new AppError('database error while fetching templates', 500)
    }
}

const getTemplateById = async (data: string) => {
    const template = await prisma.project.findUnique({
        where: {
            id: data,
            isSharedAsTemplate: true,
        },
    })

    /* 
    const template = await prisma.project.findUnique({
        where: { id: data },
    })
    
    if (!template || !template.isSharedAsTemplate) {
        throw new AppError('template not found')
    }

    Uses DB index → faster
Cleaner logic
No unnecessary filtering in DB
    
    */

    if (!template) {
        throw new AppError('template not found', 404)
    }

    return template
}

const getFeaturedTemplates = async () => {
    try {
        const templates = await prisma.project.findMany({
            where: {
                isSharedAsTemplate: true,
                isFeatured: true,
            },
        })
        return templates
    } catch (error) {
        throw new AppError('database error while fetching featured templates', 500)
    }
}

const remixTemplate = async () => {}

const toggleLike = async (data: ToggleLike) => {
    const { userId, templateId, isLiked } = data

    const user = await prisma.user.findUnique({
        where: {
            id: userId,
            isDeleted: false,
        },
    })

    if (!user) {
        throw new AppError('user not found', 404)
    }

    const template = await prisma.project.findUnique({
        where: {
            id: templateId,
            isSharedAsTemplate: true,
        },
    })

    if (!template) {
        throw new AppError('template not found')
    }

    const existing = await prisma.projectLike.findUnique({
        where: {
            userId_projectId: {
                userId: userId,
                projectId: templateId,
            },
        },
    })

    if (existing) {
        if (existing.isLiked == isLiked) {
            return existing
        }

        const updated = await prisma.projectLike.update({
            where: {
                userId_projectId: {
                    userId: userId,
                    projectId: templateId,
                },
            },
            data: {
                isLiked: isLiked,
            },
        })

        return updated
    }

    const created = await prisma.projectLike.create({
        data: {
            projectId: templateId,
            userId: userId,
            isLiked: isLiked,
        },
    })

    return created
}

export const templateService = {
    getAllTemplates,
    getTemplateById,
    getFeaturedTemplates,
    remixTemplate,
    toggleLike,
}
