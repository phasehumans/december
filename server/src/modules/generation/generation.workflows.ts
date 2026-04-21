import {
    extractProjectIntent,
    extractProjectPlan,
    generateProjectFile,
} from '../../core/engine/generation'
import { saveProjectFiles } from '../../lib/save-project-files'
import { prisma } from '../../config/db'
import { cleanPrompt } from '../generation/generation.utils'
import { persistCanvasDocument } from '../canvas/canvas.persistence'

import { planAgentResponseSchema, promptAgentResponseSchema } from './generation.schema'
import {
    appendAssistantMessageContent,
    assertFrontendOnlyPlan,
    getFilesInGenerationOrder,
} from './generation.helpers'
import { initializeGenerationTarget, markGenerationFailed } from './generation.repository'
import { emitAssistantMessage, emitFileStream } from './generation.stream'
import {
    publishFinalPreviewSnapshot,
    publishIncrementalPreviewSnapshot,
} from './generation.runtime'
import type { GenerateWebsiteInput, ProjectPlan, ProjectRecord } from './generation.types'

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

        console.log(parseIntent)

        if (!parseIntent.success) {
            throw new Error('invalid response | prompt agent')
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

        console.log(parsePlan)

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
