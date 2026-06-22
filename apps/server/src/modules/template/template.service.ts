import { AppError } from '../../shared/appError'
import { getBinaryFile, deletePrefix, projectPrefix } from '../../shared/project-storage'
import { sendNotificationToUser } from '../notification/notification.service'
import { copyProjectVersionsAndMessages } from '../project/project.service'
import { templateRepository } from './template.repository'

import type {
    ToggleLike,
    RemixTemplate,
    TemplateWithLikeMeta,
    GetAllTemplates,
    GetTemplateById,
    GetFeaturedTemplates,
    GetTemplatePreviewImage,
    DbTemplateWithLikes,
} from './template.types'

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
    const templates = await templateRepository.findManyTemplates()

    if (!userId) {
        return templates
    }

    return templates.map((template) => mapTemplateWithLikeMeta(template, userId))
}

const getTemplateById = async (data: GetTemplateById) => {
    const { templateId, userId } = data
    const template = await templateRepository.findTemplateById({ templateId })

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
    const templates = await templateRepository.findFeaturedTemplates()

    if (!userId) {
        return templates
    }

    return templates.map((template) => mapTemplateWithLikeMeta(template, userId))
}

const remixTemplate = async (data: RemixTemplate) => {
    const { userId, templateId, name } = data

    const template = await templateRepository.findProjectForRemix({ templateId })

    if (!template || template.isSharedAsTemplate == false) {
        throw new AppError('template not found', 404)
    }

    const latestVersion = await templateRepository.findLatestProjectVersion({
        projectId: template.id,
    })

    try {
        const newProject = await templateRepository.createRemixedProject({
            name: name || `Remix of ${template.name}`,
            description: template.description,
            prompt: latestVersion?.sourcePrompt ?? template.prompt,
            projectStatus: latestVersion ? 'READY' : template.projectStatus,
            userId,
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
                await templateRepository.deleteProject({ id: newProject.id })
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

    const user = await templateRepository.findUserForLike({ userId })

    if (!user) {
        throw new AppError('user not found', 404)
    }

    const template = await templateRepository.findProjectForLike({ templateId })

    if (!template) {
        throw new AppError('template not found', 404)
    }

    const existing = await templateRepository.findProjectLike({ userId, templateId })

    if (existing) {
        if (existing.isLiked == isLiked) {
            return existing
        }

        const updated = await templateRepository.updateProjectLike({ userId, templateId, isLiked })

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

    const created = await templateRepository.createProjectLike({ userId, templateId, isLiked })

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
    const template = await templateRepository.findTemplatePreviewImage({ templateId })

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
