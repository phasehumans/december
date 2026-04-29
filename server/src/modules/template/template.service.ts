import { prisma } from '../../config/db'
import type { ProjectCategory } from '../../generated/prisma/enums'

type LikeTemplate = {
    userId: string
    templateId: string
}

type DislikeTemplate = {
    userId: string
    templateId: string
}

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

const remixTemplate = async () => {}

const likeTemplate = async (data: LikeTemplate) => {
    const { userId, templateId } = data

    const template = await prisma.project.findUnique({
        where: {
            id: templateId,
            isSharedAsTemplate: true,
        },
    })

    if (!template) {
        throw new Error('template not found')
    }

    const existingLike = await prisma.projectLike.findUnique({
        where: {
            userId_projectId: {
                userId: userId,
                projectId: templateId,
            },
        },
    })

    if (existingLike) {
        return {
            message: 'template already liked',
            isLiked: true,
        }
    }

    await prisma.projectLike.create({
        data: {
            projectId: templateId,
            userId: userId,
        },
    })

    const likeCount = await prisma.projectLike.count({
        where: {
            projectId: templateId,
        },
    })

    return {
        isLiked: true,
        likeCount: likeCount,
    }
}

const dislikeTemplate = async (data: DislikeTemplate) => {
    const { userId, templateId } = data

    const template = await prisma.project.findUnique({
        where: {
            id: templateId,
            isSharedAsTemplate: true,
        },
    })

    if (!template) {
        throw new Error('template not found')
    }

    const existingLike = await prisma.projectLike.findUnique({
        where: {
            userId_projectId: {
                userId: userId,
                projectId: templateId,
            },
        },
    })

    if (!existingLike) {
        return {
            message: 'template liked not found',
            isLiked: false,
        }
    }

    await prisma.projectLike.delete({
        where: {
            userId_projectId: {
                userId: userId,
                projectId: templateId,
            },
        },
    })

    const likeCount = await prisma.projectLike.count({
        where: {
            projectId: templateId,
        },
    })

    return {
        isLiked: false,
        likeCount: likeCount,
    }
}

export const templateService = {
    getAllTemplates,
    getTemplateById,
    getTemplatesByCategory,
    remixTemplate,
    likeTemplate,
    dislikeTemplate,
}
