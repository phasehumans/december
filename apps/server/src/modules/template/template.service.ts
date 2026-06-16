import { prisma } from '@december/database'
import { AppError } from '../../shared/appError'
import { getBinaryFile, deletePrefix, projectPrefix } from '../../shared/project-storage'
import { sendNotificationToUser } from '../notification/notification.service'
import { copyProjectVersionsAndMessages } from '../project/project.service'

import type {
    ToggleLike,
    RemixTemplate,
    TemplateWithLikeMeta,
    GetAllTemplates,
    GetTemplateById,
    GetFeaturedTemplates,
    GetTemplatePreviewImage,
    DbTemplateWithLikes,
} from '@december/shared'

const mapTemplateWithLikeMeta = (
    template: DbTemplateWithLikes,
    viewerUserId: string
): TemplateWithLikeMeta => {
    const likeCount = template.likes.filter((like) => like.isLiked).length
    const viewerLike = template.likes.find((like) => like.userId === viewerUserId)

    return {
        id: template.id,
        name: template.name,
        description: template.description,
        prompt: template.prompt,
        isFeatured: template.isFeatured,
        isSharedAsTemplate: template.isSharedAsTemplate,
        projectCategory: template.projectCategory,
        createdAt: template.createdAt,
        updatedAt: template.updatedAt,
        userId: template.userId,
        authorName: template.user.name,
        authorUsername: template.user.username,
        likeCount,
        isLiked: viewerLike?.isLiked ?? false,
        previewImageKey: template.previewImageKey,
    }
}

const getAllTemplates = async (data: GetAllTemplates = {}) => {
    const { userId } = data
    const templates = await prisma.project.findMany({
        where: {
            isSharedAsTemplate: true,
        },
        orderBy: {
            updatedAt: 'desc',
        },
        select: {
            id: true,
            name: true,
            description: true,
            prompt: true,
            isFeatured: true,
            isSharedAsTemplate: true,
            projectCategory: true,
            createdAt: true,
            updatedAt: true,
            userId: true,
            previewImageKey: true,
            user: {
                select: {
                    name: true,
                    username: true,
                },
            },
            likes: {
                select: {
                    userId: true,
                    isLiked: true,
                },
            },
        },
    })

    if (!userId) {
        return templates
    }

    return templates.map((template) => mapTemplateWithLikeMeta(template, userId))
}

const getTemplateById = async (data: GetTemplateById) => {
    const { templateId, userId } = data
    const template = await prisma.project.findFirst({
        where: {
            id: templateId,
            isSharedAsTemplate: true,
        },
        select: {
            id: true,
            name: true,
            description: true,
            prompt: true,
            isFeatured: true,
            isSharedAsTemplate: true,
            projectCategory: true,
            createdAt: true,
            updatedAt: true,
            userId: true,
            previewImageKey: true,
            user: {
                select: {
                    name: true,
                    username: true,
                },
            },
            likes: {
                select: {
                    userId: true,
                    isLiked: true,
                },
            },
        },
    })

    if (!template) {
        throw new AppError('template not found', 404)
    }

    if (!userId) {
        return template
    }

    return mapTemplateWithLikeMeta(template, userId)
}

const getFeaturedTemplates = async (data: GetFeaturedTemplates = {}) => {
    const { userId } = data
    const templates = await prisma.project.findMany({
        where: {
            isSharedAsTemplate: true,
            isFeatured: true,
        },
        orderBy: {
            updatedAt: 'desc',
        },
        select: {
            id: true,
            name: true,
            description: true,
            prompt: true,
            isFeatured: true,
            isSharedAsTemplate: true,
            projectCategory: true,
            createdAt: true,
            updatedAt: true,
            userId: true,
            previewImageKey: true,
            user: {
                select: {
                    name: true,
                    username: true,
                },
            },
            likes: {
                select: {
                    userId: true,
                    isLiked: true,
                },
            },
        },
    })

    if (!userId) {
        return templates
    }

    return templates.map((template) => mapTemplateWithLikeMeta(template, userId))
}

const remixTemplate = async (data: RemixTemplate) => {
    const { userId, templateId, name } = data

    const template = await prisma.project.findUnique({
        where: {
            id: templateId,
        },
        select: {
            id: true,
            name: true,
            description: true,
            prompt: true,
            isSharedAsTemplate: true,
            projectStatus: true,
            currentVersionId: true,
        },
    })

    if (!template || template.isSharedAsTemplate == false) {
        throw new AppError('template not found', 404)
    }

    const latestVersion = await prisma.projectVersion.findFirst({
        where: {
            projectId: template.id,
        },
        orderBy: {
            versionNumber: 'desc',
        },
        select: {
            id: true,
            sourcePrompt: true,
        },
    })

    try {
        const newProject = await prisma.project.create({
            data: {
                name: name || `Remix of ${template.name}`,
                description: template.description,
                prompt: latestVersion?.sourcePrompt ?? template.prompt,
                projectStatus: latestVersion ? 'READY' : template.projectStatus,
                userId: userId,
            },
            select: {
                id: true,
                name: true,
                description: true,
                prompt: true,
                isStarred: true,
                isSharedAsTemplate: true,
                projectStatus: true,
                versionCount: true,
                currentVersionId: true,
                createdAt: true,
                updatedAt: true,
                userId: true,
            },
        })

        if (!latestVersion) {
            return newProject
        }

        try {
            const copyResult = await copyProjectVersionsAndMessages({
                sourceProjectId: template.id,
                newProjectId: newProject.id,
                newUserId: userId,
                sourceCurrentVersionId: template.currentVersionId,
            })

            newProject.currentVersionId = copyResult.newCurrentVersionId
            newProject.versionCount = copyResult.versionCount

            return newProject
        } catch (copyError) {
            try {
                await prisma.project.delete({
                    where: { id: newProject.id },
                })
            } catch (dbError) {
                console.error('Failed to rollback project creation in database:', dbError)
            }
            try {
                await deletePrefix(projectPrefix(newProject.id))
            } catch (s3Error) {
                console.error('Failed to rollback project files in S3:', s3Error)
            }
            throw copyError
        }
    } catch (error: any) {
        if (error.code === 'P2003') {
            throw new AppError('user not found', 404)
        }
        throw error
    }
}

const toggleLike = async (data: ToggleLike) => {
    const { userId, templateId, isLiked } = data

    const user = await prisma.user.findUnique({
        where: {
            id: userId,
        },
        select: {
            name: true,
        },
    })

    if (!user) {
        throw new AppError('user not found', 404)
    }

    const template = await prisma.project.findFirst({
        where: {
            id: templateId,
            isSharedAsTemplate: true,
        },
    })

    if (!template) {
        throw new AppError('template not found', 404)
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

        if (isLiked && template.userId !== userId) {
            try {
                await sendNotificationToUser({
                    userId: template.userId,
                    title: 'Someone liked your template',
                    message: `${user.name} liked your template "${template.name}".`,
                    type: 'SUCCESS',
                })
            } catch (err) {
                console.error('Failed to send like notification:', err)
            }
        }

        return updated
    }

    const created = await prisma.projectLike.create({
        data: {
            projectId: templateId,
            userId: userId,
            isLiked: isLiked,
        },
    })

    if (isLiked && template.userId !== userId) {
        try {
            await sendNotificationToUser({
                userId: template.userId,
                title: 'Someone liked your template',
                message: `${user.name} liked your template "${template.name}".`,
                type: 'SUCCESS',
            })
        } catch (err) {
            console.error('Failed to send like notification:', err)
        }
    }

    return created
}

const getTemplatePreviewImage = async (data: GetTemplatePreviewImage) => {
    const { templateId } = data
    const template = await prisma.project.findFirst({
        where: {
            id: templateId,
            isSharedAsTemplate: true,
        },
        select: {
            id: true,
            previewImageKey: true,
        },
    })

    if (!template) {
        throw new AppError('template not found', 404)
    }

    if (!template.previewImageKey) {
        return null
    }

    const file = await getBinaryFile(template.previewImageKey)
    if (!file) {
        return null
    }

    return Buffer.from(file.body)
}

export const templateService = {
    getAllTemplates,
    getTemplateById,
    getFeaturedTemplates,
    remixTemplate,
    toggleLike,
    getTemplatePreviewImage,
}
