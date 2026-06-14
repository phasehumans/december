import crypto from 'crypto'

import { prisma } from '../../config/db'
import { AppError } from '../../shared/appError'
import {
    deletePrefix,
    projectPrefix,
    getTextFile,
    versionKey,
    currentKey,
    copyObject,
} from '../../shared/project-storage'
import { hydrateCanvasDocument, persistCanvasDocument } from '../canvas/canvas.persistence'
import { parseStoredProjectFiles, mapVersionSummary } from '../project/project.utils'

import type {
    GetAllProjects,
    GetProject,
    CreateProject,
    RenameProject,
    UpdateGeneralSettings,
    DeleteProject,
    DuplicateProject,
    ShareProject,
    ToggleStarProject,
    StoredProjectFile,
    CopyProjectVersionsAndMessages,
} from './project.types'

// loads code files from objstore to memeory
export const loadGeneratedFilesFromManifest = async (manifest: StoredProjectFile[]) => {
    const files = await Promise.all(
        manifest.map(async (file) => {
            const isBinary =
                file.contentType &&
                !file.contentType.startsWith('text/') &&
                !file.contentType.includes('json') &&
                !file.contentType.includes('javascript') &&
                !file.contentType.includes('typescript') &&
                !file.contentType.includes('xml')
            if (isBinary) {
                return [file.path, ''] as const
            }
            try {
                const content = await getTextFile(file.key)
                return [file.path, content ?? ''] as const
            } catch (err) {
                console.error(`Failed to load file content for ${file.path} (${file.key}):`, err)
                return [file.path, ''] as const
            }
        })
    )

    return Object.fromEntries(files)
}

// remix and duplicate used same copy fn
export const copyProjectVersionsAndMessages = async (data: CopyProjectVersionsAndMessages) => {
    const { sourceProjectId, newProjectId, newUserId, sourceCurrentVersionId } = data

    // find the current version (or latest version if currentVersionId is not set)
    const version = await prisma.projectVersion.findFirst({
        where: {
            projectId: sourceProjectId,
            ...(sourceCurrentVersionId ? { id: sourceCurrentVersionId } : {}),
        },
        orderBy: {
            versionNumber: 'desc',
        },
    })

    if (!version) {
        return {
            newCurrentVersionId: null,
            versionCount: 0,
        }
    }

    const newVersionId = crypto.randomUUID()
    const manifest = parseStoredProjectFiles(version.manifestJson)
    const newManifest: any[] = []

    for (const file of manifest) {
        const newVersionFileKey = versionKey(newProjectId, newVersionId, file.path)
        await copyObject({ sourceKey: file.key, destinationKey: newVersionFileKey })

        const newCurrentFileKey = currentKey(newProjectId, file.path)
        await copyObject({ sourceKey: file.key, destinationKey: newCurrentFileKey })

        newManifest.push({
            path: file.path,
            key: newVersionFileKey,
            size: file.size,
            ...(file.contentType ? { contentType: file.contentType } : {}),
        })
    }

    const hydratedCanvasState = await hydrateCanvasDocument({
        canvasState: version.canvasStateJson,
        canvasAssetManifest: version.canvasAssetManifestJson,
    })
    const persistedCanvas = await persistCanvasDocument({
        projectId: newProjectId,
        userId: newUserId,
        versionId: newVersionId,
        canvasState: hydratedCanvasState,
    })

    await prisma.projectVersion.create({
        data: {
            id: newVersionId,
            projectId: newProjectId,
            versionNumber: 1,
            label: 'v1',
            sourcePrompt: version.sourcePrompt,
            summary: version.summary ?? undefined,
            status: version.status,
            objectStoragePrefix: `projects/${newProjectId}/previous-version/${newVersionId}`,
            manifestJson: newManifest,
            canvasStateJson: persistedCanvas.canvasStateJson as any,
            canvasAssetManifestJson: persistedCanvas.canvasAssetManifestJson as any,
            isDatabaseEnabled: version.isDatabaseEnabled,
            databaseUrl: version.databaseUrl,
            ...(version.intentJson !== null ? { intentJson: version.intentJson as any } : {}),
            ...(version.planJson !== null ? { planJson: version.planJson as any } : {}),
        },
    })

    await prisma.project.update({
        where: {
            id: newProjectId,
        },
        data: {
            currentVersionId: newVersionId,
            versionCount: 1,
        },
        select: {
            id: true,
        },
    })

    return {
        newCurrentVersionId: newVersionId,
        versionCount: 1,
    }
}

const getAllProjects = async (data: GetAllProjects) => {
    const { userId } = data

    const projects = await prisma.project.findMany({
        where: {
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
            user: {
                select: {
                    username: true,
                },
            },
        },
    })

    return projects
}

const getProjectById = async (data: GetProject) => {
    const { userId, projectId, versionId } = data

    const project = await prisma.project.findFirst({
        where: {
            id: projectId,
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
            githubRepoName: true,
            githubRepoOwner: true,
            githubRepoUrl: true,
            githubLastSyncedAt: true,
            vercelProjectId: true,
            vercelProjectName: true,
            vercelDeploymentUrl: true,
            vercelLastDeployedAt: true,
            user: {
                select: {
                    username: true,
                },
            },
        },
    })

    if (!project) {
        throw new AppError('project not found', 404)
    }

    const versions = await prisma.projectVersion.findMany({
        where: {
            projectId: project.id,
        },
        orderBy: {
            versionNumber: 'desc',
        },
    })

    // provided version on newest version [0]
    const selectedVersionId = versionId ?? versions[0]?.id ?? null

    const activeVersion = selectedVersionId
        ? await prisma.projectVersion.findFirst({
              where: {
                  id: selectedVersionId,
                  projectId: project.id,
              },
              include: {
                  messages: {
                      orderBy: {
                          sequence: 'asc',
                      },
                  },
              },
          })
        : null

    if (selectedVersionId && !activeVersion) {
        throw new AppError('project version not found', 404)
    }

    const generatedFiles = activeVersion
        ? await loadGeneratedFilesFromManifest(parseStoredProjectFiles(activeVersion.manifestJson))
        : {}

    // reconstrcut visual builder
    const canvasState = activeVersion
        ? await hydrateCanvasDocument({
              canvasState: activeVersion.canvasStateJson,
              canvasAssetManifest: activeVersion.canvasAssetManifestJson,
          })
        : await hydrateCanvasDocument({})

    return {
        project,
        versions: versions.map(mapVersionSummary),
        selectedVersionId: activeVersion?.id ?? null,
        activeVersion: activeVersion
            ? {
                  ...mapVersionSummary(activeVersion),
                  intent: activeVersion.intentJson,
                  plan: activeVersion.planJson,
              }
            : null,
        chatMessages:
            activeVersion?.messages.map((message) => ({
                id: message.id,
                role: message.role,
                content: message.content,
                status: message.status,
                sequence: message.sequence,
                createdAt: message.createdAt,
                updatedAt: message.updatedAt,
            })) ?? [],
        generatedFiles,
        canvasState,
    }
}

const createProject = async (data: CreateProject) => {
    const { name, description, prompt, userId } = data

    const project = await prisma.project.create({
        data: {
            name,
            description,
            prompt,
            isStarred: false,
            userId,
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

    return project
}

const renameProject = async (data: RenameProject) => {
    const { projectId, userId, rename } = data

    const result = await prisma.project.updateMany({
        where: {
            id: projectId,
            userId,
        },
        data: {
            name: rename,
        },
    })

    if (result.count === 0) {
        throw new AppError('project not found', 404)
    }

    return { message: 'project updated' }
}

const updateGeneralSettings = async (data: UpdateGeneralSettings) => {
    const { projectId, userId, name, description, isStarred, isSharedAsTemplate, projectCategory } =
        data

    const updateData: any = {}
    if (name !== undefined) updateData.name = name
    if (description !== undefined) updateData.description = description
    if (isStarred !== undefined) updateData.isStarred = isStarred
    if (isSharedAsTemplate !== undefined) updateData.isSharedAsTemplate = isSharedAsTemplate
    if (projectCategory !== undefined) updateData.projectCategory = projectCategory

    const result = await prisma.project.updateMany({
        where: {
            id: projectId,
            userId,
        },
        data: updateData,
    })

    if (result.count === 0) {
        throw new AppError('project not found', 404)
    }

    return { message: 'project general settings updated' }
}

const deleteProject = async (data: DeleteProject) => {
    const { userId, projectId } = data

    const result = await prisma.project.deleteMany({
        where: {
            id: projectId,
            userId,
        },
    })

    if (result.count === 0) {
        throw new AppError('project not found', 404)
    }

    try {
        await deletePrefix(projectPrefix(projectId)) // delete from obj store
    } catch (error) {
        console.log('failed to delete project files')
    }

    return { message: 'project deleted' }
}

const duplicateProject = async (data: DuplicateProject) => {
    const { projectId, userId, name } = data

    const sourceProject = await prisma.project.findFirst({
        where: {
            id: projectId,
            userId: userId,
        },
        select: {
            id: true,
            name: true,
            description: true,
            prompt: true,
            projectStatus: true,
            currentVersionId: true,
        },
    })

    if (!sourceProject) {
        throw new AppError('project not found', 404)
    }

    const latestVersion = await prisma.projectVersion.findFirst({
        where: {
            projectId: sourceProject.id,
        },
        orderBy: {
            versionNumber: 'desc',
        },
        select: {
            id: true,
            sourcePrompt: true,
        },
    })

    const newProject = await prisma.project.create({
        data: {
            name: name || `Copy of ${sourceProject.name}`,
            description: sourceProject.description,
            prompt: latestVersion?.sourcePrompt ?? sourceProject.prompt,
            projectStatus: latestVersion ? 'READY' : sourceProject.projectStatus,
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

    // if source project has no version (empty project); return new project
    if (!latestVersion) {
        return newProject
    }

    try {
        const copyResult = await copyProjectVersionsAndMessages({
            sourceProjectId: sourceProject.id,
            newProjectId: newProject.id,
            newUserId: userId,
            sourceCurrentVersionId: sourceProject.currentVersionId,
        })

        newProject.currentVersionId = copyResult.newCurrentVersionId
        newProject.versionCount = copyResult.versionCount

        return newProject
    } catch (error) {
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
        throw error
    }
}

const shareProjectAsTemplate = async (data: ShareProject) => {
    const { userId, projectId, isSharedAsTemplate, projectCategory } = data

    const project = await prisma.project.updateMany({
        where: {
            id: projectId,
            userId: userId,
        },
        data: {
            isSharedAsTemplate,
            ...(projectCategory ? { projectCategory } : {}),
        },
    })

    if (project.count === 0) {
        throw new AppError('project not found', 404)
    }

    return {
        message: isSharedAsTemplate ? 'project shared as template' : 'project unshared as template',
    }
}

const toggleStarProject = async (data: ToggleStarProject) => {
    const { userId, projectId, isStarred } = data

    const project = await prisma.project.updateMany({
        where: {
            id: projectId,
            userId: userId,
        },
        data: {
            isStarred,
        },
    })

    if (project.count === 0) {
        throw new AppError('project not found', 404)
    }

    return {
        message: 'project isStarred state updated',
    }
}

export const projectService = {
    getAllProjects,
    getProjectById,
    createProject,
    renameProject,
    updateGeneralSettings,
    deleteProject,
    duplicateProject,
    shareProjectAsTemplate,
    toggleStarProject,
}
