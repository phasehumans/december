import { prisma } from '../../config/db'
import { currentKey, deleteObject, getTextFile } from '../../lib/project-storage'
import { saveProjectFiles } from '../../lib/save-project-files'
import { createProjectName, mapVersionSummary, parseStoredProjectFiles } from './generation.helpers'
import { publishFinalPreviewSnapshot } from './generation.runtime'
import { persistCanvasDocument } from '../canvas/canvas.persistence'
import type {
    GenerateWebsiteInput,
    PersistedProjectRevision,
    ProjectRecord,
    RevisionBase,
    StoredProjectFile,
} from './generation.types'

const loadGeneratedFilesFromManifest = async (manifest: StoredProjectFile[]) => {
    const files = await Promise.all(
        manifest.map(async (file) => [file.path, (await getTextFile(file.key)) ?? ''] as const)
    )

    return Object.fromEntries(files)
}

export const initializeGenerationTarget = async (data: GenerateWebsiteInput) => {
    const versionId = crypto.randomUUID()

    return prisma.$transaction(async (tx) => {
        const existingProject = data.projectId
            ? await tx.project.findFirst({
                  where: {
                      id: data.projectId,
                      userId: data.userId,
                  },
              })
            : null

        if (data.projectId && !existingProject) {
            throw new Error('project not found')
        }

        const project = existingProject
            ? await tx.project.update({
                  where: {
                      id: existingProject.id,
                  },
                  data: {
                      prompt: data.prompt,
                      projectStatus: 'GENERATING',
                  },
              })
            : await tx.project.create({
                  data: {
                      name: createProjectName(data.prompt),
                      description: 'Generation in progress',
                      prompt: data.prompt,
                      projectStatus: 'GENERATING',
                      userId: data.userId,
                  },
              })

        const latestVersion = await tx.projectVersion.findFirst({
            where: {
                projectId: project.id,
            },
            orderBy: {
                versionNumber: 'desc',
            },
            select: {
                versionNumber: true,
            },
        })

        const versionNumber = (latestVersion?.versionNumber ?? 0) + 1
        const version = await tx.projectVersion.create({
            data: {
                id: versionId,
                projectId: project.id,
                versionNumber,
                label: `v${versionNumber}`,
                sourcePrompt: data.prompt,
                status: 'GENERATING',
                objectStoragePrefix: `projects/${project.id}/previous-version/${versionId}`,
                manifestJson: [],
            },
        })

        return {
            project,
            version,
            hadCurrentVersion: Boolean(existingProject?.currentVersionId),
        }
    })
}

export const getProjectRevisionBase = async ({
    userId,
    projectId,
    versionId,
}: {
    userId: string
    projectId: string
    versionId?: string
}): Promise<RevisionBase> => {
    const project = await prisma.project.findFirst({
        where: {
            id: projectId,
            userId,
        },
    })

    if (!project) {
        throw new Error('project not found')
    }

    const versions = await prisma.projectVersion.findMany({
        where: {
            projectId: project.id,
        },
        orderBy: {
            versionNumber: 'desc',
        },
    })

    const selectedVersionId = versionId ?? project.currentVersionId ?? versions[0]?.id

    if (!selectedVersionId) {
        throw new Error('project version not found')
    }

    const baseVersion = await prisma.projectVersion.findFirst({
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

    if (!baseVersion) {
        throw new Error('project version not found')
    }

    const baseFiles = await loadGeneratedFilesFromManifest(
        parseStoredProjectFiles(baseVersion.manifestJson)
    )

    return {
        project,
        baseVersion,
        baseFiles,
        nextVersionNumber: (versions[0]?.versionNumber ?? 0) + 1,
    }
}

export const persistProjectRevision = async ({
    project,
    userId,
    baseVersion,
    nextVersionNumber,
    mergedFiles,
    removedFiles,
    sourcePrompt,
    assistantMessage,
    summary,
    nextProjectPrompt,
    canvasState,
}: {
    project: RevisionBase['project']
    userId: string
    baseVersion: RevisionBase['baseVersion']
    nextVersionNumber: number
    mergedFiles: Record<string, string>
    removedFiles: string[]
    sourcePrompt: string
    assistantMessage: string
    summary: string
    nextProjectPrompt?: string
    canvasState?: unknown
}): Promise<PersistedProjectRevision> => {
    const versionId = crypto.randomUUID()
    const savedFiles = await saveProjectFiles({
        projectId: project.id,
        versionId,
        files: Object.entries(mergedFiles).map(([path, content]) => ({
            path,
            content,
        })),
    })
    const persistedCanvas =
        canvasState !== undefined
            ? await persistCanvasDocument({
                  projectId: project.id,
                  userId,
                  versionId,
                  canvasState: canvasState as any,
              })
            : {
                  canvasStateJson: (baseVersion.canvasStateJson ?? undefined) as any,
                  canvasAssetManifestJson: (baseVersion.canvasAssetManifestJson ??
                      undefined) as any,
              }

    await Promise.all(removedFiles.map((path) => deleteObject(currentKey(project.id, path))))

    await publishFinalPreviewSnapshot({
        projectId: project.id,
        versionId,
        files: savedFiles.map((file) => ({
            path: file.path,
            key: file.key,
            contentType: file.contentType,
            size: file.size,
        })),
    })

    const nextMessages = [
        ...baseVersion.messages.map((message: any) => ({
            projectId: project.id,
            role: message.role,
            content: message.content,
            ...(message.status ? { status: message.status } : {}),
            sequence: message.sequence,
        })),
        {
            projectId: project.id,
            role: 'USER' as const,
            content: sourcePrompt,
            sequence: baseVersion.messages.length + 1,
        },
        {
            projectId: project.id,
            role: 'ASSISTANT' as const,
            content: assistantMessage,
            status: 'done',
            sequence: baseVersion.messages.length + 2,
        },
    ]

    const persisted = await prisma.$transaction(async (tx) => {
        const version = await tx.projectVersion.create({
            data: {
                id: versionId,
                projectId: project.id,
                versionNumber: nextVersionNumber,
                label: `v${nextVersionNumber}`,
                sourcePrompt,
                summary,
                status: 'READY',
                objectStoragePrefix: `projects/${project.id}/previous-version/${versionId}`,
                manifestJson: savedFiles.map((file) => ({
                    path: file.path,
                    key: file.key,
                    contentType: file.contentType,
                    size: file.size,
                })),
                ...(persistedCanvas.canvasStateJson !== undefined
                    ? { canvasStateJson: persistedCanvas.canvasStateJson as any }
                    : {}),
                ...(persistedCanvas.canvasAssetManifestJson !== undefined
                    ? { canvasAssetManifestJson: persistedCanvas.canvasAssetManifestJson as any }
                    : {}),
                ...(baseVersion.intentJson !== null
                    ? { intentJson: baseVersion.intentJson as any }
                    : {}),
                ...(baseVersion.planJson !== null ? { planJson: baseVersion.planJson as any } : {}),
                messages: {
                    create: nextMessages,
                },
            },
            include: {
                messages: {
                    orderBy: {
                        sequence: 'asc',
                    },
                },
            },
        })

        const updatedProject = await tx.project.update({
            where: {
                id: project.id,
            },
            data: {
                description: summary,
                projectStatus: 'READY',
                currentVersionId: version.id,
                versionCount: nextVersionNumber,
                ...(nextProjectPrompt ? { prompt: nextProjectPrompt } : {}),
            },
        })

        const versions = await tx.projectVersion.findMany({
            where: {
                projectId: project.id,
            },
            orderBy: {
                versionNumber: 'desc',
            },
        })

        return {
            project: updatedProject,
            version,
            versions,
        }
    })

    return {
        project: persisted.project,
        version: {
            id: persisted.version.id,
            versionNumber: persisted.version.versionNumber,
            label: persisted.version.label ?? `v${persisted.version.versionNumber}`,
            status: 'READY',
        },
        versions: persisted.versions.map(mapVersionSummary),
        chatMessages: persisted.version.messages,
        generatedFiles: mergedFiles,
        assistantMessage,
    }
}
export const markGenerationFailed = async ({
    project,
    versionId,
    prompt,
    assistantMessageContent,
    hadCurrentVersion,
    messagesPersisted,
    error,
}: {
    project: ProjectRecord
    versionId: string
    prompt: string
    assistantMessageContent: string
    hadCurrentVersion: boolean
    messagesPersisted: boolean
    error: unknown
}) => {
    const fallbackAssistantMessage =
        assistantMessageContent.trim() ||
        (error instanceof Error ? error.message : 'Generation failed unexpectedly.')

    await prisma.$transaction(async (tx) => {
        if (!messagesPersisted) {
            await tx.projectMessage.createMany({
                data: [
                    {
                        projectId: project.id,
                        projectVersionId: versionId,
                        role: 'USER',
                        content: prompt,
                        sequence: 1,
                    },
                    {
                        projectId: project.id,
                        projectVersionId: versionId,
                        role: 'ASSISTANT',
                        content: fallbackAssistantMessage,
                        status: 'error',
                        sequence: 2,
                    },
                ],
            })
        }

        await tx.projectVersion.update({
            where: {
                id: versionId,
            },
            data: {
                summary: assistantMessageContent.trim() || undefined,
                status: 'FAILED',
            },
        })

        await tx.project.update({
            where: {
                id: project.id,
            },
            data: {
                projectStatus: hadCurrentVersion ? 'READY' : 'FAILED',
            },
        })
    })
}
