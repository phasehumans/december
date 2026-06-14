import crypto from 'crypto'

import { prisma } from '../../config/db'
import { getBinaryFile, deletePrefix, projectPrefix } from '../../shared/project-storage'
import { saveProjectFiles } from '../../shared/save-project-files'
import { AppError } from '../../shared/appError'
import { hydrateCanvasDocument, persistCanvasDocument } from '../canvas/canvas.persistence'
import { sendNotificationToUser } from '../notification/notification.service'
import {
    loadGeneratedFilesFromManifest,
    copyProjectVersionsAndMessages,
} from '../project/project.service'
import { parseStoredProjectFiles } from '../project/project.utils'

type ToggleLike = {
    userId: string
    templateId: string
    isLiked: boolean
}

type RemixTemplate = {
    userId: string
    templateId: string
    name?: string
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
    previewImageKey?: string | null
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
        previewImageKey: string | null
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
        previewImageKey: template.previewImageKey,
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
    } catch (error) {
        throw new AppError('database error while fetching templates', 500)
    }
}

const getTemplateById = async (data: string | { userId?: string; templateId: string }) => {
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
    } catch (error) {
        throw new AppError('database error while fetching featured templates', 500)
    }
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

const getTemplatePreviewHtml = async (templateId: string) => {
    const template = await prisma.project.findFirst({
        where: { id: templateId, isSharedAsTemplate: true },
        select: { id: true },
    })

    if (!template) {
        throw new AppError('template not found', 404)
    }

    const currentVersion = await prisma.projectVersion.findFirst({
        where: { projectId: templateId },
        orderBy: { versionNumber: 'desc' },
    })

    if (!currentVersion) {
        return ''
    }

    const manifest = parseStoredProjectFiles(currentVersion.manifestJson)
    const generatedFiles = await loadGeneratedFilesFromManifest(manifest)

    let html =
        generatedFiles['index.html'] ||
        generatedFiles['public/index.html'] ||
        generatedFiles['web/index.html'] ||
        ''

    const cssContents = Object.entries(generatedFiles)
        .filter(([path, content]) => path.endsWith('.css') && content)
        .map(([_, content]) => content)

    if (cssContents.length > 0 && html) {
        const styleTag = `\n<style>\n${cssContents.join('\n')}\n</style>\n`
        if (/<\/head>/i.test(html)) {
            html = html.replace(/<\/head>/i, () => `${styleTag}</head>`)
        } else {
            html += styleTag
        }
    }

    let documentHtml = html.trim()
    if (documentHtml && !/<html[\s>]/i.test(documentHtml)) {
        documentHtml = `<!DOCTYPE html><html><head></head><body>${documentHtml}</body></html>`
    }
    if (documentHtml && !/<head[\s>]/i.test(documentHtml)) {
        documentHtml = documentHtml.replace(/<html([^>]*)>/i, '<html$1><head></head>')
    }
    if (documentHtml && !/<body[\s>]/i.test(documentHtml)) {
        documentHtml = documentHtml.replace(/<\/head>/i, '</head><body></body>')
    }

    return documentHtml
}

const getTemplatePreviewImage = async (templateId: string) => {
    const template = await prisma.project.findFirst({
        where: { id: templateId, isSharedAsTemplate: true },
        select: { id: true, previewImageKey: true },
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
    getTemplatePreviewHtml,
    getTemplatePreviewImage,
}
