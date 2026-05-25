import crypto from 'crypto'

import { prisma } from '../../config/db'
import { saveProjectFiles } from '../../lib/save-project-files'
import { AppError } from '../../utils/appError'
import { sendNotificationToUser } from '../notification/notification.service'
import { loadGeneratedFilesFromManifest } from '../project/project.service'
import { parseStoredProjectFiles } from '../project/project.utils'

type ToggleLike = {
    userId: string
    templateId: string
    isLiked: boolean
}

type RemixTemplate = {
    userId: string
    templateId: string
}

type TemplateWithLikeMeta = {
    id: string
    name: string
    description: string | null
    prompt: string
    isFeatured: boolean
    isSharedAsTemplate: boolean
    projectCategory: string
    createdAt: Date
    updatedAt: Date
    userId: string
    authorName: string
    authorUsername: string
    likeCount: number
    isLiked: boolean
}

const mapTemplateWithLikeMeta = (
    template: {
        id: string
        name: string
        description: string | null
        prompt: string
        isFeatured: boolean
        isSharedAsTemplate: boolean
        projectCategory: any
        createdAt: Date
        updatedAt: Date
        userId: string
        user: {
            name: string
            username: string
        }
        likes: Array<{
            userId: string
            isLiked: boolean
        }>
    },
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
    }
}

const getAllTemplates = async (userId?: string) => {
    try {
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
    } catch (error) {
        throw new AppError('database error while fetching templates', 500)
    }
}

const getTemplateById = async (data: string | { userId: string; templateId: string }) => {
    const userId = typeof data === 'string' ? undefined : data.userId
    const templateId = typeof data === 'string' ? data : data.templateId
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

const getFeaturedTemplates = async (userId?: string) => {
    try {
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
    } catch (error) {
        throw new AppError('database error while fetching featured templates', 500)
    }
}

const remixTemplate = async (data: RemixTemplate) => {
    // add COW (copy on write) to copy the files ; TODO
    const { userId, templateId } = data

    const user = await prisma.user.findUnique({
        where: {
            id: userId,
        },
    })

    // better optimize; findunique uses indexing,
    // if search w/ isDeleted, reduce optimisation due to unneccassary filteing
    if (!user || user.isDeleted == true) {
        throw new AppError('user not found', 404)
    }

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
        },
    })

    if (!template || template.isSharedAsTemplate == false) {
        throw new AppError('template not found', 404)
    }

    const currentVersion = await prisma.projectVersion.findFirst({
        where: {
            projectId: template.id,
        },
        orderBy: {
            versionNumber: 'desc',
        },
    })

    const newProject = await prisma.project.create({
        data: {
            name: `Remix of ${template.name}`,
            description: template.description,
            prompt: currentVersion?.sourcePrompt ?? template.prompt,
            projectStatus: currentVersion ? 'READY' : template.projectStatus,
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

    if (!currentVersion) {
        return newProject
    }

    const manifest = parseStoredProjectFiles(currentVersion.manifestJson)
    const generatedFiles = await loadGeneratedFilesFromManifest(manifest)

    const versionRecordId = crypto.randomUUID()

    const savedFiles = await saveProjectFiles({
        projectId: newProject.id,
        versionId: versionRecordId,
        files: Object.entries(generatedFiles).map(([path, content]) => ({
            path,
            content,
        })),
    })

    await prisma.projectVersion.create({
        data: {
            id: versionRecordId,
            projectId: newProject.id,
            versionNumber: 1,
            label: 'v1',
            sourcePrompt: currentVersion.sourcePrompt,
            status: 'READY',
            objectStoragePrefix: `projects/${newProject.id}/v1/${versionRecordId}`,

            manifestJson: savedFiles.map((file) => ({
                path: file.path,
                key: file.key,
                size: file.size,
                ...(file.contentType ? { contentType: file.contentType } : {}),
            })),
        },
    })

    await prisma.project.update({
        where: { id: newProject.id },
        data: {
            currentVersionId: versionRecordId,
            versionCount: 1,
        },
    })

    return newProject
}

const toggleLike = async (data: ToggleLike) => {
    const { userId, templateId, isLiked } = data

    const user = await prisma.user.findUnique({
        where: {
            id: userId,
        },
    })

    if (!user || user.isDeleted == true) {
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

export const templateService = {
    getAllTemplates,
    getTemplateById,
    getFeaturedTemplates,
    remixTemplate,
    toggleLike,
}
