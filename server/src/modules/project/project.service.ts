import crypto from 'crypto'

import { prisma } from '../../config/db'
import { Prisma } from '../../generated/prisma/client'
import {
    deletePrefix,
    projectPrefix,
    getTextFile,
    getBinaryFile,
    putBinaryFile,
    versionKey,
    currentKey,
} from './project-storage'
import { AppError } from '../../shared/appError'
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
} from './project.types'

export type StoredProjectFile = {
    path: string
    key: string
    contentType?: string
    size: number
}

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

const getAllProjects = async (data: GetAllProjects) => {
    const { userId } = data

    try {
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
    } catch (error) {
        throw new AppError('error while fetching projects', 500)
    }
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

    try {
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
    } catch (error) {
        throw new AppError('failed to create project', 500)
    }
}

const renameProject = async (data: RenameProject) => {
    const { projectId, userId, rename } = data

    try {
        await prisma.project.update({
            where: {
                id: projectId,
                userId,
            },
            data: {
                name: rename,
            },
        })

        return { message: 'project updated' }
    } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError) {
            if (error.code === 'P2025') {
                throw new AppError('project not found', 404)
            }

            if (error.code === 'P2002') {
                throw new AppError('duplicate field value', 400)
            }
        }
        throw new AppError('failed to rename project', 500)
    }
}

const updateGeneralSettings = async (data: UpdateGeneralSettings) => {
    const { projectId, userId, name, description, isStarred, isSharedAsTemplate, projectCategory } =
        data

    try {
        const updateData: any = {}
        if (name !== undefined) updateData.name = name
        if (description !== undefined) updateData.description = description
        if (isStarred !== undefined) updateData.isStarred = isStarred
        if (isSharedAsTemplate !== undefined) updateData.isSharedAsTemplate = isSharedAsTemplate
        if (projectCategory !== undefined) updateData.projectCategory = projectCategory

        await prisma.project.update({
            where: {
                id: projectId,
                userId,
            },
            data: updateData,
        })

        return { message: 'project general settings updated' }
    } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError) {
            if (error.code === 'P2025') {
                throw new AppError('project not found', 404)
            }

            if (error.code === 'P2002') {
                throw new AppError('duplicate field value', 400)
            }
        }
        throw new AppError('failed to update general settings', 500)
    }
}

const deleteProject = async (data: DeleteProject) => {
    const { userId, projectId } = data

    const project = await prisma.project.findFirst({
        where: {
            id: projectId,
            userId: userId,
        },
        select: {
            id: true,
        },
    })

    if (!project) {
        throw new AppError('project not found', 404)
    }

    try {
        await prisma.project.delete({
            where: {
                id: projectId,
                userId,
            },
        })
    } catch (error) {
        throw new AppError('failed to delete project', 500)
    }

    try {
        await deletePrefix(projectPrefix(projectId)) // delete from obj store
    } catch (error) {
        console.log('failed to delete project files')
    }

    return { message: 'project deleted' }
}

export const copyProjectVersionsAndMessages = async (
    sourceProjectId: string,
    newProjectId: string,
    newUserId: string,
    sourceCurrentVersionId: string | null
) => {
    const versions = await prisma.projectVersion.findMany({
        where: {
            projectId: sourceProjectId,
        },
        orderBy: {
            versionNumber: 'asc',
        },
        include: {
            messages: {
                orderBy: {
                    sequence: 'asc',
                },
            },
        },
    })

    const versionIdMap = new Map<string, string>()

    for (const version of versions) {
        const newVersionId = crypto.randomUUID()
        versionIdMap.set(version.id, newVersionId)

        const manifest = parseStoredProjectFiles(version.manifestJson)

        const newManifest: any[] = []
        for (const file of manifest) {
            const fileData = await getBinaryFile(file.key)
            if (fileData) {
                const newVersionFileKey = versionKey(newProjectId, newVersionId, file.path)
                await putBinaryFile({
                    key: newVersionFileKey,
                    content: Buffer.from(fileData.body),
                    contentType: fileData.contentType,
                })

                const isLatestVersion =
                    sourceCurrentVersionId === version.id ||
                    version.id === versions[versions.length - 1]?.id
                if (isLatestVersion) {
                    const newCurrentFileKey = currentKey(newProjectId, file.path)
                    await putBinaryFile({
                        key: newCurrentFileKey,
                        content: Buffer.from(fileData.body),
                        contentType: fileData.contentType,
                    })
                }

                newManifest.push({
                    path: file.path,
                    key: newVersionFileKey,
                    size: fileData.body.byteLength,
                    ...(fileData.contentType ? { contentType: fileData.contentType } : {}),
                })
            }
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
                versionNumber: version.versionNumber,
                label: version.label,
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
                messages: {
                    create: version.messages.map((message: any) => ({
                        projectId: newProjectId,
                        role: message.role,
                        content: message.content,
                        ...(message.status ? { status: message.status } : {}),
                        sequence: message.sequence,
                    })),
                },
            },
        })
    }

    const newCurrentVersionId = sourceCurrentVersionId
        ? (versionIdMap.get(sourceCurrentVersionId) ?? null)
        : null

    await prisma.project.update({
        where: {
            id: newProjectId,
        },
        data: {
            currentVersionId: newCurrentVersionId,
            versionCount: versions.length,
        },
        select: {
            id: true,
        },
    })

    return {
        newCurrentVersionId,
        versionCount: versions.length,
    }
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

    if (!latestVersion) {
        return newProject
    }

    const copyResult = await copyProjectVersionsAndMessages(
        sourceProject.id,
        newProject.id,
        userId,
        sourceProject.currentVersionId
    )

    newProject.currentVersionId = copyResult.newCurrentVersionId
    newProject.versionCount = copyResult.versionCount

    return newProject
}

const shareProjectAsTemplate = async (data: ShareProject) => {
    const { userId, projectId, isSharedAsTemplate, projectCategory } = data

    // updateMany w/ single query >> atomic | check user and then project and then update project >> not atomic
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

    return { message: 'project isStarred state updated' }
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
