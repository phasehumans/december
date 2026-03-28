import { z } from 'zod'
import { prisma } from '../../config/db'
import { generateProjectFile } from '../../core/agents/build.agent'
import { applyProjectEdit as applyProjectEditAgent } from '../../core/agents/edit.agent'
import { applyProjectFix as applyProjectFixAgent } from '../../core/agents/fix.agent'
import { extractProjectPlan } from '../../core/agents/plan.agent'
import { extractProjectIntent } from '../../core/agents/prompt.agent'
import { currentKey, deleteObject, getTextFile } from '../../lib/project-storage'
import { saveProjectFiles } from '../../lib/save-project-files'
import { cleanPrompt } from '../../utils/cleanPrompt'
import {
    applyProjectEditSchema,
    applyProjectFixSchema,
    plannedProjectFileSchema,
    planAgentResponseSchema,
    projectIntentSchema,
    projectPlanSchema,
    promptAgentResponseSchema,
} from './generation.schema'

type GenerateWebsite = {
    prompt: string
    userId: string
    projectId?: string
    onEvent?: (event: GenerationStreamEvent) => Promise<void> | void
}

type ApplyProjectEditInput = z.infer<typeof applyProjectEditSchema> & {
    userId: string
}

type ApplyProjectFixInput = z.infer<typeof applyProjectFixSchema> & {
    userId: string
}

type ProjectIntent = z.infer<typeof projectIntentSchema>
type ProjectPlan = z.infer<typeof projectPlanSchema>
type PlannedProjectFile = z.infer<typeof plannedProjectFileSchema>
type ProjectRecord = Awaited<ReturnType<typeof prisma.project.create>>
type StoredProjectFile = {
    path: string
    key: string
    contentType?: string
    size: number
}

type RevisionBase = {
    project: NonNullable<Awaited<ReturnType<typeof prisma.project.findFirst>>>
    baseVersion: any
    baseFiles: Record<string, string>
    nextVersionNumber: number
}

type GenerationStreamEvent =
    | {
          type: 'project-created'
          data: {
              project: ProjectRecord
          }
      }
    | {
          type: 'phase'
          data: {
              phase: 'thinking' | 'planning' | 'building' | 'done'
          }
      }
    | {
          type: 'message-start'
          data: {
              messageId: string
              status: 'thinking' | 'planning'
          }
      }
    | {
          type: 'message-chunk'
          data: {
              messageId: string
              chunk: string
          }
      }
    | {
          type: 'message-complete'
          data: {
              messageId: string
              status: 'done'
          }
      }
    | {
          type: 'build-plan'
          data: {
              files: PlannedProjectFile[]
              totalFiles: number
          }
      }
    | {
          type: 'file-start'
          data: {
              path: string
              purpose: string
              generator: PlannedProjectFile['generator']
              index: number
              total: number
          }
      }
    | {
          type: 'file-chunk'
          data: {
              path: string
              chunk: string
          }
      }
    | {
          type: 'file-complete'
          data: {
              path: string
              index: number
              total: number
          }
      }
    | {
          type: 'file-error'
          data: {
              path: string
              message: string
          }
      }
    | {
          type: 'result'
          data: {
              project: ProjectRecord
              version: {
                  id: string
                  versionNumber: number
                  label: string
                  status: 'READY'
              }
              intent: ProjectIntent
              plan: ProjectPlan
              generatedFiles: Record<string, string>
          }
      }

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

const createProjectName = (prompt: string) => {
    const words = cleanPrompt(prompt)
        .split(' ')
        .filter(Boolean)
        .slice(0, 4)
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())

    const name = words.join(' ').trim()
    return name.length >= 3 ? name.slice(0, 40) : 'New Project'
}

const splitIntoChunks = (content: string, minLength: number, maxLength: number) => {
    const chunks: string[] = []
    let cursor = 0

    while (cursor < content.length) {
        const remaining = content.length - cursor
        const currentMaxLength = Math.min(maxLength, remaining)
        const currentMinLength = Math.min(minLength, currentMaxLength)
        let sliceLength = currentMinLength

        if (currentMaxLength > currentMinLength) {
            sliceLength += Math.floor(Math.random() * (currentMaxLength - currentMinLength + 1))
        }

        let nextCursor = cursor + sliceLength

        if (nextCursor < content.length) {
            const whitespaceIndex = content.lastIndexOf(' ', nextCursor)

            if (whitespaceIndex > cursor + 2) {
                nextCursor = whitespaceIndex + 1
            }
        }

        const chunk = content.slice(cursor, nextCursor)

        if (chunk) {
            chunks.push(chunk)
        }

        cursor = nextCursor
    }

    return chunks.length > 0 ? chunks : [content]
}

const splitFileContentIntoChunks = (content: string, targetChunkLength = 72) => {
    if (!content) {
        return ['']
    }

    const chunks: string[] = []
    let cursor = 0

    while (cursor < content.length) {
        let nextCursor = Math.min(cursor + targetChunkLength, content.length)
        const newlineIndex = content.lastIndexOf('\n', nextCursor)
        const whitespaceIndex = content.lastIndexOf(' ', nextCursor)

        if (newlineIndex >= cursor + 18) {
            nextCursor = newlineIndex + 1
        } else if (whitespaceIndex >= cursor + 18) {
            nextCursor = whitespaceIndex + 1
        }

        if (nextCursor <= cursor) {
            nextCursor = Math.min(cursor + targetChunkLength, content.length)
        }

        chunks.push(content.slice(cursor, nextCursor))
        cursor = nextCursor
    }

    return chunks
}

const FRONTEND_ONLY_FILE_PREFIX = 'web/'

const assertFrontendOnlyPlan = (plan: ProjectPlan) => {
    const plannedFiles = plan.data?.files ?? []
    const invalidFile = plannedFiles.find(
        (file) => !file.path.startsWith(FRONTEND_ONLY_FILE_PREFIX)
    )

    if (invalidFile) {
        throw new Error(`plan agent returned non-frontend file: ${invalidFile.path}`)
    }
}

const appendAssistantMessageContent = (existing: string, next: string) => {
    if (!next.trim()) {
        return existing
    }

    if (!existing.trim()) {
        return next.trim()
    }

    return `${existing.trim()}\n\n${next.trim()}`
}

const emitAssistantMessage = async (
    onEvent: GenerateWebsite['onEvent'],
    data: {
        messageId: string
        status: 'thinking' | 'planning'
        content: string
    }
) => {
    if (!onEvent) {
        return
    }

    const chunkRange =
        data.status === 'planning'
            ? { minLength: 6, maxLength: 12, minDelay: 22, maxDelay: 40 }
            : { minLength: 8, maxLength: 16, minDelay: 20, maxDelay: 36 }

    await onEvent({
        type: 'message-start',
        data: {
            messageId: data.messageId,
            status: data.status,
        },
    })

    await sleep(120)

    for (const chunk of splitIntoChunks(data.content, chunkRange.minLength, chunkRange.maxLength)) {
        await onEvent({
            type: 'message-chunk',
            data: {
                messageId: data.messageId,
                chunk,
            },
        })

        const delay =
            chunkRange.minDelay +
            Math.floor(Math.random() * (chunkRange.maxDelay - chunkRange.minDelay + 1))

        await sleep(delay)
    }

    await sleep(32)

    await onEvent({
        type: 'message-complete',
        data: {
            messageId: data.messageId,
            status: 'done',
        },
    })
}

const getFilesInGenerationOrder = (plan: ProjectPlan) => {
    if (!plan.data) {
        throw new Error('project plan is missing data')
    }

    const plannedFiles = new Map(plan.data.files.map((file) => [file.path, file]))

    return plan.data.generationOrder.map((path) => {
        const file = plannedFiles.get(path)

        if (!file || !file.generate) {
            throw new Error(`generation order contains invalid file path: ${path}`)
        }

        return file
    })
}

const emitFileStream = async (
    onEvent: GenerateWebsite['onEvent'],
    data: {
        file: PlannedProjectFile
        content: string
        index: number
        total: number
    }
) => {
    if (!onEvent) {
        return
    }

    await onEvent({
        type: 'file-start',
        data: {
            path: data.file.path,
            purpose: data.file.purpose,
            generator: data.file.generator,
            index: data.index,
            total: data.total,
        },
    })

    await sleep(32)

    for (const chunk of splitFileContentIntoChunks(data.content)) {
        await onEvent({
            type: 'file-chunk',
            data: {
                path: data.file.path,
                chunk,
            },
        })

        await sleep(10)
    }

    await sleep(20)

    await onEvent({
        type: 'file-complete',
        data: {
            path: data.file.path,
            index: data.index,
            total: data.total,
        },
    })
}

const parseStoredProjectFiles = (value: unknown): StoredProjectFile[] => {
    if (!Array.isArray(value)) {
        return []
    }

    return value.reduce<StoredProjectFile[]>((files, item) => {
        if (!item || typeof item !== 'object') {
            return files
        }

        const candidate = item as Partial<StoredProjectFile>

        if (typeof candidate.path !== 'string' || typeof candidate.key !== 'string') {
            return files
        }

        files.push({
            path: candidate.path,
            key: candidate.key,
            ...(typeof candidate.contentType === 'string'
                ? { contentType: candidate.contentType }
                : {}),
            size: typeof candidate.size === 'number' ? candidate.size : 0,
        })

        return files
    }, [])
}

const loadGeneratedFilesFromManifest = async (manifest: StoredProjectFile[]) => {
    const files = await Promise.all(
        manifest.map(async (file) => [file.path, (await getTextFile(file.key)) ?? ''] as const)
    )

    return Object.fromEntries(files)
}

const mapVersionSummary = (version: {
    id: string
    versionNumber: number
    label: string | null
    sourcePrompt: string
    summary: string | null
    status: 'GENERATING' | 'READY' | 'FAILED'
    objectStoragePrefix: string
    manifestJson: unknown
    createdAt: Date
    updatedAt: Date
}) => ({
    id: version.id,
    versionNumber: version.versionNumber,
    label: version.label ?? `v${version.versionNumber}`,
    sourcePrompt: version.sourcePrompt,
    summary: version.summary,
    status: version.status,
    objectStoragePrefix: version.objectStoragePrefix,
    fileCount: parseStoredProjectFiles(version.manifestJson).length,
    createdAt: version.createdAt,
    updatedAt: version.updatedAt,
})

const initializeGenerationTarget = async (data: GenerateWebsite) => {
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
                objectStoragePrefix: `projects/${project.id}/frontend/versions/${versionId}`,
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

const getProjectRevisionBase = async ({
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

const mergeProjectFiles = ({
    currentFiles,
    updatedFiles,
    deletedFiles,
}: {
    currentFiles: Record<string, string>
    updatedFiles: Array<{ path: string; content: string }>
    deletedFiles: string[]
}) => {
    const mergedFiles = { ...currentFiles }

    for (const file of updatedFiles) {
        mergedFiles[file.path] = file.content
    }

    for (const path of deletedFiles) {
        delete mergedFiles[path]
    }

    const appliedFiles = updatedFiles
        .filter((file) => currentFiles[file.path] !== file.content)
        .map((file) => file.path)
    const removedFiles = deletedFiles.filter((path) => path in currentFiles)

    return {
        mergedFiles,
        appliedFiles,
        removedFiles,
    }
}

const persistProjectRevision = async ({
    project,
    baseVersion,
    nextVersionNumber,
    mergedFiles,
    removedFiles,
    sourcePrompt,
    assistantMessage,
    summary,
    nextProjectPrompt,
}: {
    project: RevisionBase['project']
    baseVersion: RevisionBase['baseVersion']
    nextVersionNumber: number
    mergedFiles: Record<string, string>
    removedFiles: string[]
    sourcePrompt: string
    assistantMessage: string
    summary: string
    nextProjectPrompt?: string
}) => {
    const versionId = crypto.randomUUID()
    const savedFiles = await saveProjectFiles({
        projectId: project.id,
        versionId,
        files: Object.entries(mergedFiles).map(([path, content]) => ({
            path,
            content,
        })),
    })

    await Promise.all(removedFiles.map((path) => deleteObject(currentKey(project.id, path))))

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
                objectStoragePrefix: `projects/${project.id}/frontend/versions/${versionId}`,
                manifestJson: savedFiles.map((file) => ({
                    path: file.path,
                    key: file.key,
                    contentType: file.contentType,
                    size: file.size,
                })),
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
            status: persisted.version.status,
        },
        versions: persisted.versions.map(mapVersionSummary),
        chatMessages: persisted.version.messages,
        generatedFiles: mergedFiles,
        assistantMessage,
    }
}

const generateWebsite = async (data: GenerateWebsite) => {
    const { prompt, onEvent } = data
    const userPrompt = cleanPrompt(prompt)
    let project: ProjectRecord | null = null
    let versionId = ''
    let versionNumber = 0
    let versionLabel = ''
    let hadCurrentVersion = false
    let assistantMessageContent = ''
    let messagesPersisted = false

    try {
        const initializedTarget = await initializeGenerationTarget({
            ...data,
            prompt,
        })

        project = initializedTarget.project
        versionId = initializedTarget.version.id
        versionNumber = initializedTarget.version.versionNumber
        versionLabel = initializedTarget.version.label ?? `v${versionNumber}`
        hadCurrentVersion = initializedTarget.hadCurrentVersion

        await onEvent?.({
            type: 'project-created',
            data: {
                project,
            },
        })

        await onEvent?.({
            type: 'phase',
            data: {
                phase: 'thinking',
            },
        })

        const rawIntentResponse = await extractProjectIntent({ userPrompt })
        const parseIntent = promptAgentResponseSchema.safeParse(rawIntentResponse)

        if (!parseIntent.success) {
            throw new Error('invalid response | prompt agent')
        }

        const intent = parseIntent.data.intent
        assistantMessageContent = appendAssistantMessageContent(
            assistantMessageContent,
            parseIntent.data.message
        )

        await emitAssistantMessage(onEvent, {
            messageId: `${project.id}:prompt-agent`,
            status: 'thinking',
            content: parseIntent.data.message,
        })

        await onEvent?.({
            type: 'phase',
            data: {
                phase: 'planning',
            },
        })

        const rawPlanResponse = await extractProjectPlan(intent)
        const parsePlan = planAgentResponseSchema.safeParse(rawPlanResponse)

        if (!parsePlan.success) {
            throw new Error('invalid response | plan agent')
        }

        if (!parsePlan.data.plan.success) {
            throw new Error(parsePlan.data.plan.errors[0] || 'invalid response | plan agent')
        }

        if (!parsePlan.data.plan.data) {
            throw new Error('plan agent returned empty plan data')
        }

        const plan = parsePlan.data.plan
        const planData = plan.data as NonNullable<ProjectPlan['data']>
        assertFrontendOnlyPlan(plan)
        const orderedFiles = getFilesInGenerationOrder(plan)
        const generatedFiles: Record<string, string> = {}
        assistantMessageContent = appendAssistantMessageContent(
            assistantMessageContent,
            parsePlan.data.message
        )

        await emitAssistantMessage(onEvent, {
            messageId: `${project.id}:plan-agent`,
            status: 'planning',
            content: parsePlan.data.message,
        })

        project = await prisma.project.update({
            where: {
                id: project.id,
            },
            data: {
                name: planData.projectName,
                description: intent.summary,
                prompt,
            },
        })

        await onEvent?.({
            type: 'phase',
            data: {
                phase: 'building',
            },
        })

        await onEvent?.({
            type: 'build-plan',
            data: {
                files: orderedFiles,
                totalFiles: orderedFiles.length,
            },
        })

        for (const [fileIndex, file] of orderedFiles.entries()) {
            try {
                const content = await generateProjectFile({
                    intent,
                    plan,
                    targetFile: file,
                    generatedFiles,
                })

                generatedFiles[file.path] = content

                await emitFileStream(onEvent, {
                    file,
                    content,
                    index: fileIndex + 1,
                    total: orderedFiles.length,
                })
            } catch (error) {
                const message =
                    error instanceof Error ? error.message : `failed to generate ${file.path}`

                await onEvent?.({
                    type: 'file-error',
                    data: {
                        path: file.path,
                        message,
                    },
                })

                throw error
            }
        }

        const savedFiles = await saveProjectFiles({
            projectId: project.id,
            versionId,
            files: Object.entries(generatedFiles).map(([path, content]) => ({
                path,
                content,
            })),
        })

        const persisted = await prisma.$transaction(async (tx) => {
            const updatedVersion = await tx.projectVersion.update({
                where: {
                    id: versionId,
                },
                data: {
                    summary: intent.summary,
                    status: 'READY',
                    manifestJson: savedFiles.map((file) => ({
                        path: file.path,
                        key: file.key,
                        contentType: file.contentType,
                        size: file.size,
                    })),
                    intentJson: intent as any,
                    planJson: plan as any,
                    messages: {
                        create: [
                            {
                                projectId: project!.id,
                                role: 'USER',
                                content: prompt,
                                sequence: 1,
                            },
                            {
                                projectId: project!.id,
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
                    id: project!.id,
                },
                data: {
                    name: planData.projectName,
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

        messagesPersisted = true
        project = persisted.project

        await onEvent?.({
            type: 'phase',
            data: {
                phase: 'done',
            },
        })

        const result = {
            project,
            version: {
                id: persisted.version.id,
                versionNumber: persisted.version.versionNumber,
                label: persisted.version.label ?? versionLabel,
                status: 'READY' as const,
            },
            intent,
            plan,
            generatedFiles,
        }

        await onEvent?.({
            type: 'result',
            data: result,
        })

        return result
    } catch (error) {
        if (project && versionId) {
            const fallbackAssistantMessage =
                assistantMessageContent.trim() ||
                (error instanceof Error ? error.message : 'Generation failed unexpectedly.')

            await prisma.$transaction(async (tx) => {
                if (!messagesPersisted) {
                    await tx.projectMessage.createMany({
                        data: [
                            {
                                projectId: project!.id,
                                projectVersionId: versionId,
                                role: 'USER',
                                content: prompt,
                                sequence: 1,
                            },
                            {
                                projectId: project!.id,
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
                        id: project!.id,
                    },
                    data: {
                        projectStatus: hadCurrentVersion ? 'READY' : 'FAILED',
                    },
                })
            })
        }

        throw error
    }
}

const applyProjectEdit = async (data: ApplyProjectEditInput) => {
    const base = await getProjectRevisionBase(data)
    const prompt = cleanPrompt(data.prompt)
    const editResult = await applyProjectEditAgent({
        prompt,
        ...(data.selectedElement ? { selectedElement: data.selectedElement } : {}),
        project: {
            name: base.project.name,
            description: base.project.description,
            prompt: base.project.prompt,
        },
        recentMessages: base.baseVersion.messages.slice(-8).map((message: any) => ({
            role: message.role,
            content: message.content,
        })),
        files: base.baseFiles,
    })

    const { mergedFiles, appliedFiles, removedFiles } = mergeProjectFiles({
        currentFiles: base.baseFiles,
        updatedFiles: editResult.updatedFiles,
        deletedFiles: editResult.deletedFiles,
    })

    const persisted = await persistProjectRevision({
        project: base.project,
        baseVersion: base.baseVersion,
        nextVersionNumber: base.nextVersionNumber,
        mergedFiles,
        removedFiles,
        sourcePrompt: prompt,
        assistantMessage: editResult.message,
        summary: editResult.summary,
        nextProjectPrompt: prompt,
    })

    return {
        ...persisted,
        appliedFiles,
        deletedFiles: removedFiles,
    }
}

const applyProjectFix = async (data: ApplyProjectFixInput) => {
    const base = await getProjectRevisionBase(data)
    const errorMessage = data.errorMessage.trim()
    const fixResult = await applyProjectFixAgent({
        errorMessage,
        ...(data.stack ? { stack: data.stack } : {}),
        project: {
            name: base.project.name,
            description: base.project.description,
            prompt: base.project.prompt,
        },
        recentMessages: base.baseVersion.messages.slice(-8).map((message: any) => ({
            role: message.role,
            content: message.content,
        })),
        files: base.baseFiles,
    })

    const { mergedFiles, appliedFiles, removedFiles } = mergeProjectFiles({
        currentFiles: base.baseFiles,
        updatedFiles: fixResult.updatedFiles,
        deletedFiles: fixResult.deletedFiles,
    })

    const persisted = await persistProjectRevision({
        project: base.project,
        baseVersion: base.baseVersion,
        nextVersionNumber: base.nextVersionNumber,
        mergedFiles,
        removedFiles,
        sourcePrompt: `Fix preview error: ${errorMessage}`,
        assistantMessage: fixResult.message,
        summary: fixResult.summary,
    })

    return {
        ...persisted,
        appliedFiles,
        deletedFiles: removedFiles,
    }
}

export const generateService = {
    generateWebsite,
    applyProjectEdit,
    applyProjectFix,
}
