import { prisma } from '../../config/db'
import {
    extractProjectChangePlan,
    extractProjectPlan,
    generateProjectFile,
    generateProjectPatchFile,
    generateWorkDoneSummary,
} from '../agents'
import { saveProjectFiles } from '../project/save-project-files'
import { persistCanvasDocument } from '../canvas/canvas.persistence'
import { cleanPrompt } from '../generation/generation.utils'

import {
    appendAssistantMessageContent,
    assertFrontendOnlyChangePlan,
    assertFrontendOnlyPlan,
    getFilesInGenerationOrder,
    mergeProjectFiles,
    toRecentMessages,
    parsePartialArray,
    parseStoredProjectFiles,
} from './generation.utils'
import {
    getProjectRevisionBase,
    initializeGenerationTarget,
    markGenerationFailed,
    persistProjectRevision,
    loadGeneratedFilesFromManifest,
} from './generation.repository'
import {
    publishFinalPreviewSnapshot,
    publishIncrementalPreviewSnapshot,
} from './generation.runtime'
import { planAgentResponseSchema } from './generation.schema'
import { emitAssistantMessage, emitFileStream, emitPatchFileStream } from './generation.stream'
import { runtimeService } from '../runtime/runtime.service'
import { usageService } from '../usage/usage.service'
import {
    extractStyleGuidelines,
    upsertStyleGuidelines,
    getErrorSignature,
} from '../memory/memory.service'

import type {
    GenerateWebsiteInput,
    ProjectPlan,
    ProjectRecord,
    ApplyProjectEdit,
    ApplyProjectFix,
} from './generation.types'

const fileTreeForPlanning = (files: Record<string, string>) =>
    Object.entries(files)
        .sort(([pathA], [pathB]) => pathA.localeCompare(pathB))
        .map(([path, content]) => ({
            path,
            excerpt: content.slice(0, 1400),
        }))

const toVisibleMessage = (lines: string[]) => lines.join('\n')

const resolveModel = async (userId: string, requestedModel?: string): Promise<string> => {
    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { subscriptionPlan: true, subscriptionStatus: true },
    })
    const isPro = user?.subscriptionPlan === 'PRO' && user?.subscriptionStatus === 'ACTIVE'
    if (isPro && requestedModel) {
        return requestedModel
    }
    return process.env.AUTO_MODEL || 'openai/gpt-oss-20b:free'
}

const executeSelfCorrection = async (
    projectId: string,
    initialVersionId: string,
    userId: string,
    model?: string,
    onEvent?: GenerateWebsiteInput['onEvent'],
    initialResult?: any,
    lastHealthyVersionId?: string
): Promise<any> => {
    let currentVersionId = initialVersionId
    let currentResult = initialResult
    const maxAttempts = 3

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        console.log(
            `[self-healing] Attempt ${attempt} of ${maxAttempts} for project ${projectId}, version ${currentVersionId}`
        )

        // Abort self-healing if user credit balance falls below required threshold
        const canRun = await usageService.canRunSelfCorrection({ userId })
        if (!canRun) {
            console.warn(
                `[self-healing] Aborting self-healing loop: user credit balance is below the required threshold.`
            )
            if (lastHealthyVersionId) {
                console.log(
                    `[self-healing] Rolling back project ${projectId} currentVersionId pointer to ${lastHealthyVersionId}`
                )
                await prisma.project.update({
                    where: { id: projectId },
                    data: { currentVersionId: lastHealthyVersionId },
                })
            }
            return currentResult
        }

        await onEvent?.({
            type: 'phase',
            data: {
                phase: 'building',
            },
        })

        const checkResult = await runtimeService.checkSandboxCompilation({ projectId })

        if (checkResult.success) {
            console.log(`[self-healing] Compilation check passed on attempt ${attempt}!`)
            return currentResult
        }

        const compileErrors = checkResult.errors || 'Unknown compilation error'
        console.warn(
            `[self-healing] Compilation check failed on attempt ${attempt}:\n${compileErrors}`
        )

        const errorSignature = getErrorSignature(compileErrors)

        // Check if we've already seen this exact error in this session (scoped to initialVersionId)
        const existingMemory = await prisma.agentSessionMemory.findFirst({
            where: {
                projectId,
                versionId: initialVersionId,
                errorSignature,
            },
        })

        if (existingMemory) {
            console.warn(
                `[self-healing] Loop detected: exact error signature already seen in this session. Aborting self-healing loop.`
            )
            if (lastHealthyVersionId) {
                console.log(
                    `[self-healing] Rolling back project ${projectId} currentVersionId pointer to ${lastHealthyVersionId}`
                )
                await prisma.project.update({
                    where: { id: projectId },
                    data: { currentVersionId: lastHealthyVersionId },
                })
            }
            return currentResult
        }

        // Log the error signature to prevent repeating it
        await prisma.agentSessionMemory.create({
            data: {
                projectId,
                versionId: initialVersionId,
                errorSignature,
            },
        })

        if (attempt === maxAttempts) {
            console.error(
                `[self-healing] Reached maximum attempts (${maxAttempts}). Returning last generated version.`
            )
            if (lastHealthyVersionId) {
                console.log(
                    `[self-healing] Rolling back project ${projectId} currentVersionId pointer to ${lastHealthyVersionId}`
                )
                await prisma.project.update({
                    where: { id: projectId },
                    data: { currentVersionId: lastHealthyVersionId },
                })
            }
            return currentResult
        }

        // Apply automated fix
        await onEvent?.({
            type: 'phase',
            data: {
                phase: 'thinking',
            },
        })

        // Call applyProjectFix inside the loop with isSelfHealing: true
        currentResult = await applyProjectChange('fix', {
            userId,
            projectId,
            versionId: currentVersionId,
            errorMessage: compileErrors,
            model,
            onEvent,
            isSelfHealing: true,
        })

        currentVersionId = currentResult.version.id
    }

    return currentResult
}

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
    let totalInputTokens = 0
    let totalOutputTokens = 0
    let resolvedModelName = 'auto'

    try {
        const initializedTarget = await initializeGenerationTarget({
            ...data,
            prompt,
        })

        project = initializedTarget.project
        versionId = initializedTarget.version.id

        // Extract and save style guidelines from the prompt
        const extractedGuidelines = extractStyleGuidelines(prompt)
        await upsertStyleGuidelines({ projectId: project.id, guidelines: extractedGuidelines })

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

        const resolvedModel = await resolveModel(data.userId, data.model)
        resolvedModelName = resolvedModel
        console.log(
            `[generation] user: ${data.userId} requested model: ${data.model || 'auto'}, resolved to: ${resolvedModelName}`
        )

        let lastThoughtsLength = 0
        let lastPlanLength = 0
        let isThoughtsComplete = false

        const rawPlanResponse = await extractProjectPlan({
            userPrompt,
            canvasState: persistedCanvas.canvasStateJson as any,
            model: resolvedModel,
            projectId: project.id,
            userId: data.userId,
            onStream: async (fullContent: string) => {
                const thoughts = parsePartialArray(fullContent, 'thoughts')
                if (thoughts.length > lastThoughtsLength) {
                    const chunk = thoughts.slice(lastThoughtsLength)
                    lastThoughtsLength = thoughts.length
                    await emitAssistantMessage(onEvent, {
                        messageId: `${project!.id}:plan-agent:thoughts`,
                        status: 'thinking',
                        content: chunk,
                    })
                }

                const thoughtsRegex = /"thoughts"\s*:\s*\[[\s\S]*?\],/
                if (!isThoughtsComplete && thoughtsRegex.test(fullContent)) {
                    isThoughtsComplete = true
                }

                if (isThoughtsComplete) {
                    const planOfAction = parsePartialArray(fullContent, 'plan_of_action')
                    if (planOfAction.length > lastPlanLength) {
                        const chunk = planOfAction.slice(lastPlanLength)
                        lastPlanLength = planOfAction.length
                        await emitAssistantMessage(onEvent, {
                            messageId: `${project!.id}:plan-agent:plan_of_action`,
                            status: 'thinking',
                            content: chunk,
                        })
                    }
                }
            },
        })
        totalInputTokens += rawPlanResponse.usage.inputTokens
        totalOutputTokens += rawPlanResponse.usage.outputTokens

        const parsePlan = planAgentResponseSchema.safeParse(rawPlanResponse.data)

        if (!parsePlan.success) {
            throw new Error('invalid response | plan agent')
        }

        if (!parsePlan.data.plan.success) {
            throw new Error(parsePlan.data.plan.errors[0] || 'invalid response | plan agent')
        }

        if (!parsePlan.data.plan.data) {
            throw new Error('plan agent returned empty plan data')
        }

        const intent = parsePlan.data.intent
        const plan = parsePlan.data.plan
        const planData = plan.data as NonNullable<ProjectPlan['data']>
        assertFrontendOnlyPlan(plan)
        const orderedFiles = getFilesInGenerationOrder(plan)
        const initialFiles = await loadGeneratedFilesFromManifest(
            parseStoredProjectFiles(initializedTarget.version.manifestJson)
        )
        const generatedFiles: Record<string, string> = { ...initialFiles }
        let previewManifestSequence = 0
        const thoughtsMessage = toVisibleMessage(parsePlan.data.thoughts)
        const planOfActionMessage = toVisibleMessage(parsePlan.data.plan_of_action)
        assistantMessageContent = appendAssistantMessageContent(
            assistantMessageContent,
            thoughtsMessage
        )

        assistantMessageContent = appendAssistantMessageContent(
            assistantMessageContent,
            planOfActionMessage
        )

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
                const buildRes = await generateProjectFile({
                    brief: intent,
                    plan,
                    targetFile: file,
                    generatedFiles,
                    model: resolvedModel,
                    projectId: project.id,
                    userId: data.userId,
                })
                totalInputTokens += buildRes.usage.inputTokens
                totalOutputTokens += buildRes.usage.outputTokens
                const content = buildRes.content

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

        const summaryMessageId = `${project!.id}:plan-agent:summary`
        await onEvent?.({
            type: 'message-start',
            data: { messageId: summaryMessageId, status: 'done' },
        })

        const generatedSummary = await generateWorkDoneSummary({
            prompt: userPrompt,
            plan: planData,
            generatedFiles: Object.keys(generatedFiles),
            model: resolvedModelName,
            onStream: async (chunk) => {
                await onEvent?.({
                    type: 'message-chunk',
                    data: { messageId: summaryMessageId, chunk },
                })
            },
        })

        await onEvent?.({
            type: 'message-complete',
            data: { messageId: summaryMessageId, status: 'done' },
        })

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
                    summary: generatedSummary,
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

        // Run self-healing compilation loop
        const finalResult = await executeSelfCorrection(
            project.id,
            persisted.version.id,
            data.userId,
            resolvedModelName,
            onEvent,
            result,
            initializedTarget.project.currentVersionId || undefined
        )

        await onEvent?.({
            type: 'result',
            data: finalResult,
        })

        return finalResult
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
    } finally {
        if (totalInputTokens > 0 || totalOutputTokens > 0) {
            usageService
                .recordUsageEvent({
                    userId: data.userId,
                    model: resolvedModelName,
                    inputTokens: totalInputTokens,
                    outputTokens: totalOutputTokens,
                    totalTokens: totalInputTokens + totalOutputTokens,
                    projectId: project?.id,
                })
                .catch((e) => console.error('Failed to record usage event:', e))
        }
    }
}

const applyProjectChange = async (
    mode: 'edit' | 'fix',
    data: ApplyProjectEdit | ApplyProjectFix
) => {
    const base = await getProjectRevisionBase({
        userId: data.userId,
        projectId: data.projectId,
        versionId: data.versionId,
    })
    const isEdit = mode === 'edit'
    const editData = data as ApplyProjectEdit
    const fixData = data as ApplyProjectFix

    if (isEdit && editData.prompt) {
        const extractedGuidelines = extractStyleGuidelines(editData.prompt)
        await upsertStyleGuidelines({ projectId: base.project.id, guidelines: extractedGuidelines })
    }

    const sourcePrompt = isEdit ? editData.prompt : `Fix preview error: ${fixData.errorMessage}`
    let assistantMessageContent = ''

    let totalInputTokens = 0
    let totalOutputTokens = 0
    let resolvedModelName = 'auto'

    try {
        await data.onEvent?.({
            type: 'phase',
            data: {
                phase: 'thinking',
            },
        })

        const resolvedModel = await resolveModel(data.userId, data.model)
        resolvedModelName = resolvedModel
        console.log(
            `[generation change] user: ${data.userId} requested model: ${data.model || 'auto'}, resolved to: ${resolvedModelName}`
        )

        let lastThoughtsLength = 0
        let lastPlanLength = 0
        let isThoughtsComplete = false

        const rawPlanResponse = await extractProjectChangePlan({
            mode,
            userId: data.userId,
            ...(isEdit ? { prompt: editData.prompt } : {}),
            ...(isEdit && editData.selectedElement
                ? { selectedElement: editData.selectedElement }
                : {}),
            ...(isEdit && (editData.canvasState ?? base.baseVersion.canvasStateJson)
                ? { canvasState: editData.canvasState ?? base.baseVersion.canvasStateJson }
                : {}),
            ...(!isEdit && base.baseVersion.canvasStateJson
                ? { canvasState: base.baseVersion.canvasStateJson }
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
            model: resolvedModel,
            onStream: async (fullContent) => {
                const thoughts = parsePartialArray(fullContent, 'thoughts')
                if (thoughts.length > lastThoughtsLength) {
                    const chunk = thoughts.slice(lastThoughtsLength)
                    lastThoughtsLength = thoughts.length
                    await emitAssistantMessage(data.onEvent, {
                        messageId: `${base.project.id}:plan-agent:${mode}:thoughts`,
                        status: 'thinking',
                        content: chunk,
                    })
                }

                const thoughtsRegex = /"thoughts"\s*:\s*\[[\s\S]*?\],/
                if (!isThoughtsComplete && thoughtsRegex.test(fullContent)) {
                    isThoughtsComplete = true
                }

                if (isThoughtsComplete) {
                    const planOfAction = parsePartialArray(fullContent, 'plan_of_action')
                    if (planOfAction.length > lastPlanLength) {
                        const chunk = planOfAction.slice(lastPlanLength)
                        lastPlanLength = planOfAction.length
                        await emitAssistantMessage(data.onEvent, {
                            messageId: `${base.project.id}:plan-agent:${mode}:plan_of_action`,
                            status: 'thinking',
                            content: chunk,
                        })
                    }
                }
            },
        })
        totalInputTokens += rawPlanResponse.usage.inputTokens
        totalOutputTokens += rawPlanResponse.usage.outputTokens

        if (!rawPlanResponse.data.plan.success) {
            throw new Error(
                rawPlanResponse.data.plan.errors[0] || `invalid response | plan agent ${mode}`
            )
        }

        if (!rawPlanResponse.data.plan.data) {
            throw new Error(`plan agent returned empty ${mode} plan data`)
        }

        const plan = rawPlanResponse.data.plan
        const planData = plan.data as NonNullable<typeof plan.data>
        assertFrontendOnlyChangePlan(plan)
        const thoughtsMessage = toVisibleMessage(rawPlanResponse.data.thoughts)
        const planOfActionMessage = toVisibleMessage(rawPlanResponse.data.plan_of_action)

        assistantMessageContent = appendAssistantMessageContent(
            assistantMessageContent,
            thoughtsMessage
        )

        assistantMessageContent = appendAssistantMessageContent(
            assistantMessageContent,
            planOfActionMessage
        )

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
        const workingFiles = { ...base.baseFiles }

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

                const patchRes = await generateProjectPatchFile({
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
                    model: resolvedModel,
                    projectId: base.project.id,
                    userId: data.userId,
                })
                totalInputTokens += patchRes.usage.inputTokens
                totalOutputTokens += patchRes.usage.outputTokens
                const content = patchRes.content

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

        const summaryMessageId = `${base.project.id}:plan-agent:${mode}:summary`
        await data.onEvent?.({
            type: 'message-start',
            data: { messageId: summaryMessageId, status: 'done' },
        })

        const generatedSummary = await generateWorkDoneSummary({
            prompt: sourcePrompt,
            plan: planData,
            generatedFiles: appliedFiles.concat(removedFiles),
            model: resolvedModelName,
            onStream: async (chunk) => {
                await data.onEvent?.({
                    type: 'message-chunk',
                    data: { messageId: summaryMessageId, chunk },
                })
            },
        })

        await data.onEvent?.({
            type: 'message-complete',
            data: { messageId: summaryMessageId, status: 'done' },
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
            summary: generatedSummary,
            ...(isEdit ? { nextProjectPrompt: editData.prompt } : {}),
            ...(isEdit && editData.canvasState ? { canvasState: editData.canvasState } : {}),
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

        if (data.isSelfHealing) {
            await data.onEvent?.({
                type: 'result',
                data: result,
            })
            return result
        }

        // Run self-healing compilation loop
        const finalResult = await executeSelfCorrection(
            base.project.id,
            persisted.version.id,
            data.userId,
            resolvedModelName,
            data.onEvent,
            result,
            base.baseVersion.id
        )

        await data.onEvent?.({
            type: 'result',
            data: finalResult,
        })

        return finalResult
    } finally {
        if (totalInputTokens > 0 || totalOutputTokens > 0) {
            usageService
                .recordUsageEvent({
                    userId: data.userId,
                    model: resolvedModelName,
                    inputTokens: totalInputTokens,
                    outputTokens: totalOutputTokens,
                    totalTokens: totalInputTokens + totalOutputTokens,
                    projectId: base.project.id,
                })
                .catch((e) => console.error('Failed to record usage event:', e))
        }
    }
}

export const applyProjectEdit = (data: ApplyProjectEdit) => applyProjectChange('edit', data)

export const applyProjectFix = (data: ApplyProjectFix) => applyProjectChange('fix', data)

export const generateService = { applyProjectEdit, applyProjectFix, generateWebsite }
