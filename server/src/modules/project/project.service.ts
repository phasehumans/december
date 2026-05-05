import { prisma } from '../../config/db'
import { buildProjectZip } from '../../lib/build-project-zip'
import { saveProjectFiles } from '../../lib/save-project-files'
import { deletePrefix, projectPrefix, getTextFile } from '../../lib/project-storage'
import crypto from 'crypto'
import { hydrateCanvasDocument, persistCanvasDocument } from '../canvas/canvas.persistence'
import {
    parseStoredProjectFiles,
    mapVersionSummary,
    isVersionSchemaMissing,
} from '../project/project.utils'
import { AppError } from '../../utils/appError'
import { Prisma } from '../../generated/prisma/client'

type GetProject = {
    userId: string
    projectId: string
    versionId?: string
}

type CreateProject = {
    name: string
    description: string | undefined
    prompt: string
    userId: string
}

type RenameProject = {
    projectId: string
    userId: string
    rename: string
}

type DeleteProject = {
    userId: string
    projectId: string
}

type DuplicateProject = {
    userId: string
    projectId: string
}

type ShareProject = {
    userId: string
    projectId: string
}

type ToogleStarProject = {
    userId: string
    projectId: string
    isStarred: boolean
}

export type StoredProjectFile = {
    path: string
    key: string
    contentType?: string
    size: number
}

export const loadGeneratedFilesFromManifest = async (manifest: StoredProjectFile[]) => {
    const files = await Promise.all(
        manifest.map(async (file) => [file.path, (await getTextFile(file.key)) ?? ''] as const)
    )

    return Object.fromEntries(files)
}

const getAllProjects = async (userId: string) => {
    const user = await prisma.user.findUnique({
        where: {
            id: userId,
            isDeleted: false,
        },
    })

    if (!user) {
        throw new AppError('user not found', 404)
    }

    try {
        const projects = await prisma.project.findMany({
            where: {
                userId: userId,
            },
        })

        return projects
    } catch (error) {
        throw new AppError('database error while fetching projects', 500)
    }
}

const getProjectById = async (data: GetProject) => {
    const { userId, projectId, versionId } = data

    const user = await prisma.user.findUnique({
        where: {
            id: userId,
            isDeleted: false,
        },
    })

    if (!user) {
        throw new AppError('user not found', 404)
    }

    const project = await prisma.project.findFirst({
        where: {
            id: projectId,
            userId: userId,
        },
    })

    if (!project) {
        throw new AppError('project not found', 404)
    }

    try {
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
            ? await loadGeneratedFilesFromManifest(
                  parseStoredProjectFiles(activeVersion.manifestJson)
              )
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
    } catch (error) {
        if (!isVersionSchemaMissing(error)) {
            throw error
        }

        return {
            project,
            versions: [],
            selectedVersionId: null,
            activeVersion: null,
            chatMessages: [],
            generatedFiles: {},
            canvasState: await hydrateCanvasDocument({}),
        }
    }
}

const createProject = async (data: CreateProject) => {
    const { name, description, prompt, userId } = data

    const user = await prisma.user.findUnique({
        where: {
            id: userId,
            isDeleted: false,
        },
    })

    if (!user) {
        throw new AppError('user not found', 404)
    }

    try {
        const project = await prisma.project.create({
            data: {
                name,
                description,
                prompt,
                isStarred: false,
                userId,
            },
        })

        return project
    } catch (error) {
        throw new AppError('failed to create project', 500)
    }
}

const renameProject = async (data: RenameProject) => {
    const { projectId, userId, rename } = data

    const user = await prisma.user.findUnique({
        where: {
            id: userId,
            isDeleted: false,
        },
    })

    if (!user) {
        throw new AppError('user not found', 404)
    }

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

const deleteProject = async (data: DeleteProject) => {
    const { userId, projectId } = data

    const user = await prisma.user.findUnique({
        where: {
            id: userId,
            isDeleted: false,
        },
    })

    if (!user) {
        throw new AppError('user not found', 404)
    }

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

const duplicateProject = async (data: DuplicateProject) => {
    const { projectId, userId } = data

    const user = await prisma.user.findUnique({
        where: {
            id: userId,
        },
    })

    if (!user || user.isDeleted == true) {
        throw new AppError('user not found', 404)
    }

    const sourceProject = await prisma.project.findFirst({
        where: {
            id: projectId,
            userId: userId,
        },
    })

    if (!sourceProject) {
        throw new AppError('project not found', 404)
    }

    let currentVersion: any = null

    try {
        currentVersion = await prisma.projectVersion.findFirst({
            where: {
                projectId: sourceProject.id,
            },
            orderBy: {
                versionNumber: 'desc',
            },
            include: {
                messages: {
                    orderBy: {
                        sequence: 'asc',
                    },
                },
            },
        })
    } catch (error) {
        if (!isVersionSchemaMissing(error)) {
            throw error
        }
    }

    const newProject = await prisma.project.create({
        data: {
            name: `Copy of ${sourceProject.name}`,
            description: sourceProject.description,
            prompt: currentVersion?.sourcePrompt ?? sourceProject.prompt,
            projectStatus: currentVersion ? 'READY' : sourceProject.projectStatus,
            userId: userId,
        },
    })

    if (!currentVersion) {
        return newProject
    }

    const manifest = parseStoredProjectFiles(currentVersion.manifestJson)
    const generatedFiles = await loadGeneratedFilesFromManifest(manifest)
    const versionRecordId = crypto.randomUUID()
    const hydratedCanvasState = await hydrateCanvasDocument({
        canvasState: currentVersion.canvasStateJson,
        canvasAssetManifest: currentVersion.canvasAssetManifestJson,
    })
    const persistedCanvas = await persistCanvasDocument({
        projectId: newProject.id,
        userId,
        versionId: versionRecordId,
        canvasState: hydratedCanvasState,
    })
    const savedFiles = await saveProjectFiles({
        projectId: newProject.id,
        versionId: versionRecordId,
        files: Object.entries(generatedFiles).map(([path, content]) => ({ path, content })),
    })

    await prisma.projectVersion.create({
        data: {
            id: versionRecordId,
            projectId: newProject.id,
            versionNumber: 1,
            label: 'v1',
            sourcePrompt: currentVersion.sourcePrompt,
            summary: currentVersion.summary ?? undefined,
            status: 'READY',
            objectStoragePrefix: `projects/${newProject.id}/previous-version/${versionRecordId}`,
            manifestJson: savedFiles.map((file) => ({
                path: file.path,
                key: file.key,
                ...(file.contentType ? { contentType: file.contentType } : {}),
                size: file.size,
            })),
            canvasStateJson: persistedCanvas.canvasStateJson as any,
            canvasAssetManifestJson: persistedCanvas.canvasAssetManifestJson as any,
            ...(currentVersion.intentJson !== null
                ? { intentJson: currentVersion.intentJson as any }
                : {}),
            ...(currentVersion.planJson !== null
                ? { planJson: currentVersion.planJson as any }
                : {}),
            messages: {
                create: currentVersion.messages.map((message: any) => ({
                    projectId: newProject.id,
                    role: message.role,
                    content: message.content,
                    ...(message.status ? { status: message.status } : {}),
                    sequence: message.sequence,
                })),
            },
        },
    })

    try {
        await prisma.project.update({
            where: {
                id: newProject.id,
            },
            data: {
                currentVersionId: versionRecordId,
                versionCount: 1,
            },
            select: {
                id: true,
            },
        })
    } catch (error) {
        if (!isVersionSchemaMissing(error)) {
            throw error
        }
    }

    return newProject
}

const downloadProjectVersion = async (data: GetProject) => {
    const detail = await getProjectById(data)

    if (!detail.activeVersion) {
        throw new AppError('project version not found', 404)
    }

    const zip = buildProjectZip(
        Object.entries(detail.generatedFiles).map(([path, content]) => ({
            path,
            content,
        }))
    )

    const safeProjectName =
        detail.project.name
            .trim()
            .replace(/[^a-z0-9-_]+/gi, '-')
            .replace(/^-+|-+$/g, '') || 'project'
    const fileName = `${safeProjectName}.zip`

    return {
        fileName,
        zip,
    }
}

const shareProjectAsTemplate = async (data: ShareProject) => {
    const { userId, projectId } = data

    // updateMany w/ single query >> atomic | check user and then project and then update project >> not atomic
    const project = await prisma.project.updateMany({
        where: {
            id: projectId,
            userId: userId,
            user: {
                isDeleted: false,
            },
        },
        data: {
            isSharedAsTemplate: true,
        },
    })

    if (project.count === 0) {
        throw new AppError('project not found', 404)
    }

    return { message: 'project shared as template' }
}

const toggleStarProject = async (data: ToogleStarProject) => {
    const { userId, projectId, isStarred } = data

    const project = await prisma.project.updateMany({
        where: {
            id: projectId,
            userId: userId,
            user: {
                isDeleted: false,
            },
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
    deleteProject,
    duplicateProject,
    downloadProjectVersion,
    shareProjectAsTemplate,
    toggleStarProject,
}
