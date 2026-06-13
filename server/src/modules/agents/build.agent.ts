import { z } from 'zod'

import { openai } from '../../config/oai'
import {
    plannedProjectFileSchema,
    projectPatchOperationSchema,
    projectIntentSchema,
    projectPlanSchema,
} from '../generation/generation.schema'
import {
    assertFrontendWorkspacePath,
    isFrontendWorkspacePath,
} from '../generation/generation.utils'
import { readChatCompletionText, retryAsync } from './agents.utils'
import {
    BUILD_AGENT_PROMPT,
    BUILD_PATCH_AGENT_PROMPT,
    BUILD_SUMMARY_AGENT_PROMPT,
} from './build.prompt'
import { buildDeclarationMap } from '../generation/context-indexer'
import { loadMemoryPromptInstructions } from '../memory/memory.service'

type ProjectIntent = z.infer<typeof projectIntentSchema>
type ProjectPlan = z.infer<typeof projectPlanSchema>
type PlannedProjectFile = z.infer<typeof plannedProjectFileSchema>
type ProjectPatchOperation = z.infer<typeof projectPatchOperationSchema>

type GenerateProjectFileInput = {
    brief: ProjectIntent
    plan: ProjectPlan
    targetFile: PlannedProjectFile
    generatedFiles: Record<string, string>
}

type GenerateProjectPatchInput = {
    operation: ProjectPatchOperation
    currentFiles: Record<string, string>
    projectContext: {
        projectName: string
        sourcePrompt: string
        summary?: string | null
    }
    request: {
        mode: 'edit' | 'fix'
        prompt?: string
        runtimeError?: {
            message: string
            stack?: string
        }
        selectedElement?: {
            tagName: string
            textContent: string
        }
    }
}

const BUILD_AGENT_MAX_ATTEMPTS = 3
const BUILD_CONTEXT_LIMIT = 6
const BUILD_AGENT_MODEL = 'openai/gpt-oss-20b:free'
// const BUILD_AGENT_MAX_TOKENS = 2000

const stripWrappingCodeFence = (content: string) => {
    const trimmed = content.trim()

    if (!trimmed.startsWith('```')) {
        return trimmed
    }

    return trimmed
        .replace(/^```(?:[\w.-]+)?\s*/i, '')
        .replace(/\s*```$/, '')
        .trim()
}

const validateGeneratedFileContent = (path: string, content: string) => {
    const normalizedContent = stripWrappingCodeFence(content)

    if (!normalizedContent.trim()) {
        throw new Error(`empty file content for ${path}`)
    }

    if (normalizedContent.includes('```')) {
        throw new Error(`markdown fences detected in generated content for ${path}`)
    }

    assertFrontendWorkspacePath(path, 'generated frontend file')

    if (path.endsWith('.json')) {
        try {
            JSON.parse(normalizedContent)
        } catch {
            throw new Error(`invalid JSON generated for ${path}`)
        }
    }

    return normalizedContent
}

const getPriorityContextPaths = (targetPath: string) => {
    if (!isFrontendWorkspacePath(targetPath)) {
        return []
    }

    return [
        'package.json',
        'tsconfig.json',
        'vite.config.ts',
        'index.html',
        'src/main.tsx',
        'src/App.tsx',
        'src/index.css',
    ]
}

const selectRelatedFiles = (targetPath: string, generatedFiles: Record<string, string>) => {
    const targetDirectory = targetPath.includes('/')
        ? targetPath.slice(0, targetPath.lastIndexOf('/'))
        : ''
    const sameDirectoryPaths = Object.keys(generatedFiles).filter(
        (path) => path !== targetPath && targetDirectory && path.startsWith(`${targetDirectory}/`)
    )
    const priorityPaths = getPriorityContextPaths(targetPath).filter(
        (path) => path !== targetPath && generatedFiles[path]
    )

    const orderedPaths = [...priorityPaths, ...sameDirectoryPaths].filter(
        (path, index, paths) => paths.indexOf(path) === index
    )

    return orderedPaths.slice(0, BUILD_CONTEXT_LIMIT).map((path) => ({
        path,
        content: generatedFiles[path],
    }))
}

export const generateProjectFile = async (
    data: GenerateProjectFileInput & {
        model?: string
        projectId?: string
        userId?: string
    }
) => {
    assertFrontendWorkspacePath(data.targetFile.path, 'target frontend file')

    return retryAsync({
        label: `build agent (${data.targetFile.path})`,
        maxAttempts: BUILD_AGENT_MAX_ATTEMPTS,
        task: async (attempt, lastError) => {
            console.log(
                `[build agent] starting file generation for ${data.targetFile.path}, attempt: ${attempt}`
            )
            const memoryInstructions = data.projectId
                ? await loadMemoryPromptInstructions({
                      projectId: data.projectId,
                      userId: data.userId,
                  })
                : ''
            const systemPrompt = BUILD_AGENT_PROMPT + memoryInstructions
            const completion = await openai.chat.completions.create({
                model: data.model || process.env.AUTO_MODEL || BUILD_AGENT_MODEL,
                temperature: 0,
                messages: [
                    {
                        role: 'system',
                        content: systemPrompt,
                    },
                    {
                        role: 'user',
                        content: JSON.stringify({
                            projectBrief: data.brief,
                            buildPlan: data.plan,
                            targetFile: data.targetFile,
                            plannedFiles: data.plan.data?.files ?? [],
                            buildOrder: data.plan.data?.buildOrder ?? [],
                            builderNotes: data.plan.data?.builderNotes ?? [],
                            relatedFiles: selectRelatedFiles(
                                data.targetFile.path,
                                data.generatedFiles
                            ),
                            workspaceDeclarations: buildDeclarationMap(data.generatedFiles),
                        }),
                    },
                    ...(attempt > 1
                        ? [
                              {
                                  role: 'system' as const,
                                  content: `Retry attempt ${attempt}. The previous file response could not be used: ${lastError?.message ?? 'unknown error'}. Regenerate only ${data.targetFile.path} as raw file content with no markdown fences or commentary. Keep the output inside the repo-root frontend workspace, using src/, public/, and allowed root config files only.`,
                              },
                          ]
                        : []),
                ],
            })

            const content = readChatCompletionText(completion)

            if (!content) {
                console.log(
                    `[build agent] file generation failed for ${data.targetFile.path}: no response`
                )
                throw new Error(`no response from build agent for ${data.targetFile.path}`)
            }

            console.log(
                `[build agent] file generation completed successfully for ${data.targetFile.path}. Full response:\n${content}`
            )
            const validatedContent = validateGeneratedFileContent(data.targetFile.path, content)
            return {
                content: validatedContent,
                usage: {
                    inputTokens: (completion as any).usage?.prompt_tokens ?? 0,
                    outputTokens: (completion as any).usage?.completion_tokens ?? 0,
                    totalTokens: (completion as any).usage?.total_tokens ?? 0,
                },
            }
        },
    })
}

const selectPatchContext = (targetPath: string, currentFiles: Record<string, string>) => {
    const targetDirectory = targetPath.includes('/')
        ? targetPath.slice(0, targetPath.lastIndexOf('/'))
        : ''
    const priorityPaths = getPriorityContextPaths(targetPath).filter((path) => currentFiles[path])
    const sameDirectoryPaths = Object.keys(currentFiles).filter(
        (path) => path !== targetPath && targetDirectory && path.startsWith(`${targetDirectory}/`)
    )

    return [...priorityPaths, ...sameDirectoryPaths]
        .filter((path, index, paths) => paths.indexOf(path) === index)
        .slice(0, BUILD_CONTEXT_LIMIT)
        .map((path) => ({
            path,
            content: currentFiles[path],
        }))
}

export const generateProjectPatchFile = async (
    data: GenerateProjectPatchInput & {
        model?: string
        projectId?: string
        userId?: string
    }
) => {
    assertFrontendWorkspacePath(data.operation.path, 'target frontend patch file')

    if (data.operation.action === 'delete') {
        return {
            content: '',
            usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
        }
    }

    return retryAsync({
        label: `build agent patch (${data.operation.path})`,
        maxAttempts: BUILD_AGENT_MAX_ATTEMPTS,
        task: async (attempt, lastError) => {
            console.log(
                `[build agent patch] starting patch generation for ${data.operation.path}, attempt: ${attempt}`
            )
            const memoryInstructions = data.projectId
                ? await loadMemoryPromptInstructions({
                      projectId: data.projectId,
                      userId: data.userId,
                  })
                : ''
            const systemPrompt = BUILD_PATCH_AGENT_PROMPT + memoryInstructions
            const completion = await openai.chat.completions.create({
                model: data.model || process.env.AUTO_MODEL || BUILD_AGENT_MODEL,
                temperature: 0,
                messages: [
                    {
                        role: 'system',
                        content: systemPrompt,
                    },
                    {
                        role: 'user',
                        content: JSON.stringify({
                            request: data.request,
                            projectContext: data.projectContext,
                            operation: data.operation,
                            currentFile: {
                                path: data.operation.path,
                                content: data.currentFiles[data.operation.path] ?? '',
                            },
                            relatedFiles: selectPatchContext(
                                data.operation.path,
                                data.currentFiles
                            ),
                            fileTree: Object.keys(data.currentFiles).sort(),
                            workspaceDeclarations: buildDeclarationMap(data.currentFiles),
                        }),
                    },
                    ...(attempt > 1
                        ? [
                              {
                                  role: 'system' as const,
                                  content: `Retry attempt ${attempt}. The previous patch file response could not be used: ${lastError?.message ?? 'unknown error'}. Regenerate only ${data.operation.path} as raw complete file content with no markdown fences or commentary.`,
                              },
                          ]
                        : []),
                ],
            })

            const content = readChatCompletionText(completion)

            if (!content) {
                console.log(
                    `[build agent patch] patch generation failed for ${data.operation.path}: no response`
                )
                throw new Error(`no response from build agent for ${data.operation.path}`)
            }

            console.log(
                `[build agent patch] patch generation completed successfully for ${data.operation.path}. Full response:\n${content}`
            )
            const validatedContent = validateGeneratedFileContent(data.operation.path, content)
            return {
                content: validatedContent,
                usage: {
                    inputTokens: (completion as any).usage?.prompt_tokens ?? 0,
                    outputTokens: (completion as any).usage?.completion_tokens ?? 0,
                    totalTokens: (completion as any).usage?.total_tokens ?? 0,
                },
            }
        },
    })
}

export type GenerateWorkDoneSummaryInput = {
    prompt: string
    plan: any
    generatedFiles: string[]
    model?: string
    onStream?: (chunk: string) => Promise<void> | void
}

export const generateWorkDoneSummary = async (data: GenerateWorkDoneSummaryInput) => {
    console.log(`[build agent summary] starting summary generation`)
    const stream = await openai.chat.completions.create({
        model: data.model || 'claude-3-5-sonnet-latest',
        messages: [
            {
                role: 'system',
                content: BUILD_SUMMARY_AGENT_PROMPT,
            },
            {
                role: 'user',
                content: JSON.stringify({
                    intentPrompt: data.prompt,
                    originalPlan: data.plan,
                    filesGeneratedOrModified: data.generatedFiles,
                }),
            },
        ],
        stream: true,
    })

    let fullContent = ''
    for await (const chunk of stream) {
        const text = chunk.choices[0]?.delta?.content || ''
        if (text) {
            fullContent += text
            await data.onStream?.(text)
        }
    }

    console.log(
        `[build agent summary] summary generation completed successfully. Full response:\n${fullContent}`
    )
    return fullContent
}
