import {
    extractProjectChangePlan,
    extractProjectIntent,
    extractProjectPlan,
    generateProjectFile,
    generateProjectPatchFile,
} from '../../core/engine/generation'
import { saveProjectFiles } from '../../lib/save-project-files'
import { prisma } from '../../config/db'
import { cleanPrompt } from '../generation/generation.utils'
import { persistCanvasDocument } from '../canvas/canvas.persistence'

import { planAgentResponseSchema, promptAgentResponseSchema } from './generation.schema'
import {
    appendAssistantMessageContent,
    assertFrontendOnlyChangePlan,
    assertFrontendOnlyPlan,
    getFilesInGenerationOrder,
    mergeProjectFiles,
    toRecentMessages,
} from './generation.helpers'
import {
    getProjectRevisionBase,
    initializeGenerationTarget,
    markGenerationFailed,
    persistProjectRevision,
} from './generation.repository'
import { emitAssistantMessage, emitFileStream, emitPatchFileStream } from './generation.stream'
import {
    publishFinalPreviewSnapshot,
    publishIncrementalPreviewSnapshot,
} from './generation.runtime'
import type { GenerateWebsiteInput, ProjectPlan, ProjectRecord } from './generation.types'

type ApplyProjectEditInput = {
    userId: string
    projectId: string
    versionId?: string
    prompt: string
    selectedElement?: {
        tagName: string
        textContent: string
    }
    canvasState?: GenerateWebsiteInput['canvasState']
    onEvent?: GenerateWebsiteInput['onEvent']
}

type ApplyProjectFixInput = {
    userId: string
    projectId: string
    versionId?: string
    errorMessage: string
    stack?: string
    onEvent?: GenerateWebsiteInput['onEvent']
}

const fileTreeForPlanning = (files: Record<string, string>) =>
    Object.entries(files)
        .sort(([pathA], [pathB]) => pathA.localeCompare(pathB))
        .map(([path, content]) => ({
            path,
            excerpt: content.slice(0, 1400),
        }))

export const generateWebsite = async (data: GenerateWebsiteInput) => {
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
        const persistedCanvas = await persistCanvasDocument({
            projectId: project.id,
            userId: data.userId,
            versionId,
            canvasState: data.canvasState,
        })

        await prisma.projectVersion.update({
            where: {
                id: versionId,
            },
            data: {
                canvasStateJson: persistedCanvas.canvasStateJson as any,
                canvasAssetManifestJson: persistedCanvas.canvasAssetManifestJson as any,
            },
        })
        await onEvent?.({
            type: 'project-created',
            data: {
                project,
                version: {
                    id: versionId,
                    versionNumber,
                    label: versionLabel,
                },
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
            throw new Error('invalid response | plan agent')
        }

        const intent = parseIntent.data.intent
        assistantMessageContent = appendAssistantMessageContent(
            assistantMessageContent,
            parseIntent.data.summary
        )

        await emitAssistantMessage(onEvent, {
            messageId: `${project.id}:prompt-agent`,
            status: 'thinking',
            content: parseIntent.data.summary,
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
        let previewManifestSequence = 0
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

                previewManifestSequence += 1
                await publishIncrementalPreviewSnapshot({
                    projectId: project.id,
                    versionId,
                    path: file.path,
                    content,
                    generatedFiles,
                    sequence: previewManifestSequence,
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
                    canvasStateJson: persistedCanvas.canvasStateJson as any,
                    canvasAssetManifestJson: persistedCanvas.canvasAssetManifestJson as any,
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
            await markGenerationFailed({
                project,
                versionId,
                prompt,
                assistantMessageContent,
                hadCurrentVersion,
                messagesPersisted,
                error,
            })
        }

        throw error
    }
}

const applyProjectChange = async (
    mode: 'edit' | 'fix',
    data: ApplyProjectEditInput | ApplyProjectFixInput
) => {
    const base = await getProjectRevisionBase({
        userId: data.userId,
        projectId: data.projectId,
        versionId: data.versionId,
    })
    const isEdit = mode === 'edit'
    const editData = data as ApplyProjectEditInput
    const fixData = data as ApplyProjectFixInput
    const sourcePrompt = isEdit ? editData.prompt : `Fix preview error: ${fixData.errorMessage}`
    let assistantMessageContent = ''

    await data.onEvent?.({
        type: 'phase',
        data: {
            phase: 'planning',
        },
    })

    const rawPlanResponse = await extractProjectChangePlan({
        mode,
        ...(isEdit ? { prompt: editData.prompt } : {}),
        ...(isEdit && editData.selectedElement
            ? { selectedElement: editData.selectedElement }
            : {}),
        ...(!isEdit
            ? {
                  runtimeError: {
                      message: fixData.errorMessage,
                      ...(fixData.stack ? { stack: fixData.stack } : {}),
                  },
              }
            : {}),
        project: {
            id: base.project.id,
            name: base.project.name,
            description: base.project.description,
            prompt: base.project.prompt,
        },
        baseVersion: {
            id: base.baseVersion.id,
            versionNumber: base.baseVersion.versionNumber,
            summary: base.baseVersion.summary,
            sourcePrompt: base.baseVersion.sourcePrompt,
            intentJson: base.baseVersion.intentJson,
            planJson: base.baseVersion.planJson,
        },
        fileTree: fileTreeForPlanning(base.baseFiles),
        recentMessages: toRecentMessages(base.baseVersion),
    })

    if (!rawPlanResponse.plan.success) {
        throw new Error(rawPlanResponse.plan.errors[0] || `invalid response | plan agent ${mode}`)
    }

    if (!rawPlanResponse.plan.data) {
        throw new Error(`plan agent returned empty ${mode} plan data`)
    }

    const plan = rawPlanResponse.plan
    const planData = plan.data as NonNullable<typeof plan.data>
    assertFrontendOnlyChangePlan(plan)
    assistantMessageContent = appendAssistantMessageContent(
        assistantMessageContent,
        rawPlanResponse.message
    )

    await emitAssistantMessage(data.onEvent, {
        messageId: `${base.project.id}:plan-agent:${mode}`,
        status: 'planning',
        content: rawPlanResponse.message,
    })

    const operations = planData.operations
    await data.onEvent?.({
        type: 'patch-plan',
        data: {
            files: operations,
            totalFiles: operations.length,
        },
    })

    await data.onEvent?.({
        type: 'phase',
        data: {
            phase: 'building',
        },
    })

    const updatedFiles: Array<{ path: string; content: string }> = []
    const deletedFiles: string[] = []
    let workingFiles = { ...base.baseFiles }

    for (const [operationIndex, operation] of operations.entries()) {
        try {
            if (operation.action === 'delete') {
                deletedFiles.push(operation.path)
                delete workingFiles[operation.path]
                await emitPatchFileStream(data.onEvent, {
                    file: operation,
                    content: '',
                    index: operationIndex + 1,
                    total: operations.length,
                })
                continue
            }

            const content = await generateProjectPatchFile({
                operation,
                currentFiles: workingFiles,
                projectContext: {
                    projectName: base.project.name,
                    sourcePrompt: base.baseVersion.sourcePrompt,
                    summary: base.baseVersion.summary,
                },
                request: {
                    mode,
                    ...(isEdit ? { prompt: editData.prompt } : {}),
                    ...(isEdit && editData.selectedElement
                        ? { selectedElement: editData.selectedElement }
                        : {}),
                    ...(!isEdit
                        ? {
                              runtimeError: {
                                  message: fixData.errorMessage,
                                  ...(fixData.stack ? { stack: fixData.stack } : {}),
                              },
                          }
                        : {}),
                },
            })

            workingFiles[operation.path] = content
            updatedFiles.push({
                path: operation.path,
                content,
            })

            await emitPatchFileStream(data.onEvent, {
                file: operation,
                content,
                index: operationIndex + 1,
                total: operations.length,
            })
        } catch (error) {
            const message =
                error instanceof Error ? error.message : `failed to patch ${operation.path}`

            await data.onEvent?.({
                type: 'file-error',
                data: {
                    path: operation.path,
                    message,
                },
            })

            throw error
        }
    }

    const { mergedFiles, appliedFiles, removedFiles } = mergeProjectFiles({
        currentFiles: base.baseFiles,
        updatedFiles,
        deletedFiles,
    })

    const persisted = await persistProjectRevision({
        project: base.project,
        userId: data.userId,
        baseVersion: base.baseVersion,
        nextVersionNumber: base.nextVersionNumber,
        mergedFiles,
        removedFiles,
        sourcePrompt,
        assistantMessage: assistantMessageContent,
        summary: rawPlanResponse.summary || planData.summary,
        ...(isEdit ? { nextProjectPrompt: editData.prompt } : {}),
        ...(isEdit && editData.canvasState ? { canvasState: editData.canvasState } : {}),
    })

    await data.onEvent?.({
        type: 'phase',
        data: {
            phase: 'done',
        },
    })

    const result = {
        project: persisted.project,
        version: persisted.version,
        versions: persisted.versions,
        chatMessages: persisted.chatMessages,
        intent: (base.baseVersion.intentJson ?? {}) as any,
        plan,
        generatedFiles: persisted.generatedFiles,
        appliedFiles,
        deletedFiles: removedFiles,
        assistantMessage: persisted.assistantMessage,
    }

    await data.onEvent?.({
        type: 'result',
        data: result,
    })

    return result
}

export const applyProjectEdit = (data: ApplyProjectEditInput) => applyProjectChange('edit', data)

export const applyProjectFix = (data: ApplyProjectFixInput) => applyProjectChange('fix', data)
