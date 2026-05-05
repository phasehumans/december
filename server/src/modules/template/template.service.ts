import { prisma } from '../../config/db'
import { saveProjectFiles } from '../../lib/save-project-files'
import { AppError } from '../../utils/appError'
import { loadGeneratedFilesFromManifest } from '../project/project.service'
import { parseStoredProjectFiles } from '../project/project.utils'
import crypto from 'crypto'

type ToggleLike = {
    userId: string
    templateId: string
    isLiked: boolean
}

type RemixTemplate = {
    userId: string
    templateId: string
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
        },
    })

    if (!template || template.isSharedAsTemplate == false) {
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
