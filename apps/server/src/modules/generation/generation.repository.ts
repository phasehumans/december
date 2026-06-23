import fs from 'node:fs'
import path from 'node:path'

import { prisma } from '@december/database'

import { currentKey, deleteObject, getTextFile } from '../../shared/project-storage'
import { saveProjectFiles } from '../../shared/save-project-files'
import { persistCanvasDocument } from '../canvas/canvas.utils'

import { publishFinalPreviewSnapshot } from './generation.runtime'
import { createProjectName, mapVersionSummary, parseStoredProjectFiles } from './generation.utils'

import type {
    GenerateWebsiteInput,
    PersistedProjectRevision,
    RevisionBase,
    GetProjectRevisionBase,
    PersistProjectRevision,
    MarkGenerationFailed,
} from './generation.types'
import type { StoredProjectFile } from '../project/project.types'

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

export const initializeGenerationTarget = async (data: GenerateWebsiteInput) => {
    const { userId, projectId, prompt } = data
    const versionId = crypto.randomUUID()

    const result = await prisma.$transaction(async (tx) => {
        const existingProject = projectId
            ? await tx.project.findFirst({
                  where: {
                      id: projectId,
                      userId,
                  },
              })
            : null

        if (projectId && !existingProject) {
            throw new Error('project not found')
        }

        const project = existingProject
            ? await tx.project.update({
                  where: {
                      id: existingProject.id,
                  },
                  data: {
                      prompt,
                      projectStatus: 'GENERATING',
                  },
              })
            : await tx.project.create({
                  data: {
                      name: createProjectName(prompt),
                      description:
                          prompt.trim().length > 150
                              ? prompt.trim().slice(0, 147) + '...'
                              : prompt.trim(),
                      prompt,
                      projectStatus: 'GENERATING',
                      userId,
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
                sourcePrompt: prompt,
                status: 'GENERATING',
                objectStoragePrefix: `projects/${project.id}/previous-version/${versionId}`,
                manifestJson: [],
            },
        })

        return {
            project,
            version,
            hadCurrentVersion: Boolean(existingProject?.currentVersionId),
            versionNumber,
        }
    })

    if (result.versionNumber === 1) {
        const scaffoldDir = path.resolve(__dirname, '../../../../runtime/scaffold')
        const filesToSave = [
            {
                path: 'package.json',
                content: fs.readFileSync(path.join(scaffoldDir, 'package.json'), 'utf8'),
            },
            {
                path: 'vite.config.ts',
                content: fs.readFileSync(path.join(scaffoldDir, 'vite.config.ts'), 'utf8'),
            },
            {
                path: 'tsconfig.json',
                content: fs.readFileSync(path.join(scaffoldDir, 'tsconfig.json'), 'utf8'),
            },
            {
                path: 'index.html',
                content: fs.readFileSync(path.join(scaffoldDir, 'index.html'), 'utf8'),
            },
            {
                path: 'src/main.tsx',
                content: fs.readFileSync(path.join(scaffoldDir, 'src/main.tsx'), 'utf8'),
            },
        ]

        const savedFiles = await saveProjectFiles({
            projectId: result.project.id,
            versionId,
            files: filesToSave,
        })

        const updatedVersion = await prisma.projectVersion.update({
            where: {
                id: versionId,
            },
            data: {
                manifestJson: savedFiles.map((file) => ({
                    path: file.path,
                    key: file.key,
                    contentType: file.contentType,
                    size: file.size,
                })),
            },
        })

        result.version = updatedVersion
    }

    return {
        project: result.project,
        version: result.version,
        hadCurrentVersion: result.hadCurrentVersion,
    }
}

export const getProjectRevisionBase = async (
    data: GetProjectRevisionBase
): Promise<RevisionBase> => {
    const { userId, projectId, versionId } = data
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

export const persistProjectRevision = async (
    data: PersistProjectRevision
): Promise<PersistedProjectRevision> => {
    const {
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
    } = data
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
export const markGenerationFailed = async (data: MarkGenerationFailed) => {
    const {
        project,
        versionId,
        prompt,
        assistantMessageContent,
        hadCurrentVersion,
        messagesPersisted,
        error,
    } = data
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

export const findUserSubscriptionInfo = async (data: { userId: string }) => {
    const { userId } = data
    return prisma.user.findUnique({
        where: { id: userId },
        select: { subscriptionPlan: true, subscriptionStatus: true },
    })
}

export const updateProjectCurrentVersion = async (data: {
    projectId: string
    versionId: string
}) => {
    const { projectId, versionId } = data
    return prisma.project.update({
        where: { id: projectId },
        data: { currentVersionId: versionId },
    })
}

export const findAgentSessionMemory = async (data: {
    projectId: string
    versionId: string
    errorSignature: string
}) => {
    const { projectId, versionId, errorSignature } = data
    return prisma.agentSessionMemory.findFirst({
        where: {
            projectId,
            versionId,
            errorSignature,
        },
    })
}

export const createAgentSessionMemory = async (data: {
    projectId: string
    versionId: string
    errorSignature: string
}) => {
    const { projectId, versionId, errorSignature } = data
    return prisma.agentSessionMemory.create({
        data: {
            projectId,
            versionId,
            errorSignature,
        },
    })
}

export const updateProjectVersionCanvas = async (data: {
    versionId: string
    canvasStateJson: any
    canvasAssetManifestJson: any
}) => {
    const { versionId, canvasStateJson, canvasAssetManifestJson } = data
    return prisma.projectVersion.update({
        where: {
            id: versionId,
        },
        data: {
            canvasStateJson,
            canvasAssetManifestJson,
        },
    })
}

export const updateProjectDetails = async (data: {
    projectId: string
    name: string
    description: string | null
    prompt: string
}) => {
    const { projectId, name, description, prompt } = data
    return prisma.project.update({
        where: {
            id: projectId,
        },
        data: {
            name,
            description,
            prompt,
        },
    })
}

export const findProjectByIdAndUser = async (data: { id: string; userId: string }) => {
    const { id, userId } = data
    return prisma.project.findFirst({
        where: {
            id,
            userId,
        },
    })
}

export const completeWebsiteGeneration = async (data: {
    projectId: string
    versionId: string
    generatedSummary: string
    savedFiles: any[]
    canvasStateJson: any
    canvasAssetManifestJson: any
    intent: any
    plan: any
    prompt: string
    assistantMessageContent: string
    projectName: string
    versionNumber: number
}) => {
    const {
        projectId,
        versionId,
        generatedSummary,
        savedFiles,
        canvasStateJson,
        canvasAssetManifestJson,
        intent,
        plan,
        prompt,
        assistantMessageContent,
        projectName,
        versionNumber,
    } = data

    return prisma.$transaction(async (tx) => {
        const updatedVersion = await tx.projectVersion.update({
            where: {
                id: versionId,
            },
            data: {
                summary: generatedSummary,
                status: 'READY',
                manifestJson: savedFiles.map((file) => ({
                    path: file.path,
                    key: file.key,
                    contentType: file.contentType,
                    size: file.size,
                })),
                canvasStateJson: canvasStateJson as any,
                canvasAssetManifestJson: canvasAssetManifestJson as any,
                intentJson: intent as any,
                planJson: plan as any,
                messages: {
                    create: [
                        {
                            projectId,
                            role: 'USER',
                            content: prompt,
                            sequence: 1,
                        },
                        {
                            projectId,
                            role: 'ASSISTANT',
                            content: assistantMessageContent,
                            status: 'done',
                            sequence: 2,
                        },
                    ],
                },
            },
        })

        const updatedProject = await tx.project.update({
            where: {
                id: projectId,
            },
            data: {
                name: projectName,
                description: intent.summary,
                prompt,
                projectStatus: 'READY',
                currentVersionId: updatedVersion.id,
                versionCount: versionNumber,
            },
        })

        return {
            project: updatedProject,
            version: updatedVersion,
        }
    })
}
