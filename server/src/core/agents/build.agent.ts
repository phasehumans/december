import { z } from 'zod'

import { openai } from '../../config/oai'
import {
    plannedProjectFileSchema,
    projectPatchOperationSchema,
    projectIntentSchema,
    projectPlanSchema,
} from '../../modules/generation/generation.schema'
import {
    assertFrontendWorkspacePath,
    isFrontendWorkspacePath,
} from '../../modules/generation/generation.utils'
import { readChatCompletionText } from '../../utils/readChatCompletionText'
import { retryAsync } from '../../utils/retry'
import { BUILD_AGENT_PROMPT } from '../prompts/build.prompt'

type ProjectIntent = z.infer<typeof projectIntentSchema>
type ProjectPlan = z.infer<typeof projectPlanSchema>
type PlannedProjectFile = z.infer<typeof plannedProjectFileSchema>
type ProjectPatchOperation = z.infer<typeof projectPatchOperationSchema>

type GenerateProjectFileInput = {
    intent: ProjectIntent
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

export const generateProjectFile = async (data: GenerateProjectFileInput) => {
    assertFrontendWorkspacePath(data.targetFile.path, 'target frontend file')

    return retryAsync({
        label: `build agent (${data.targetFile.path})`,
        maxAttempts: BUILD_AGENT_MAX_ATTEMPTS,
        task: async (attempt, lastError) => {
            const completion = await openai.chat.completions.create({
                model: BUILD_AGENT_MODEL,
                temperature: 0,
                messages: [
                    {
                        role: 'system',
                        content: BUILD_AGENT_PROMPT,
                    },
                    {
                        role: 'user',
                        content: JSON.stringify({
                            intent: data.intent,
                            projectPlan: data.plan,
                            targetFile: data.targetFile,
                            plannedFiles: data.plan.data?.files ?? [],
                            relatedFiles: selectRelatedFiles(
                                data.targetFile.path,
                                data.generatedFiles
                            ),
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
                throw new Error(`no response from build agent for ${data.targetFile.path}`)
            }

            return validateGeneratedFileContent(data.targetFile.path, content)
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

const BUILD_PATCH_AGENT_PROMPT = `You are the Build Agent for a December follow-up patch.

Generate EXACTLY ONE frontend file for one patch operation.
Return ONLY raw file content.
No markdown.
No code fences.
No JSON.
No filename.
No explanation.

You are given:
- the user's edit or runtime-fix request
- one planned patch operation
- the current target file content when it exists
- a small set of related project files

Rules:
- Produce the complete final content for the requested path only.
- Keep the change targeted to the operation instructions.
- Do not redesign unrelated UI or rewrite the whole project style.
- Do not add imports for files that are not present or clearly planned by the operation.
- Stay browser-only Bun React TypeScript.
- Do not write backend, API, database, env, Docker, or server code.
- Never output TODO, FIXME, placeholders, pseudocode, or markdown fences.
- package.json and tsconfig.json must remain valid JSON.
- React files must have valid imports and exports.
- If fixing an error, preserve working behavior and fix the smallest likely cause.`

export const generateProjectPatchFile = async (data: GenerateProjectPatchInput) => {
    assertFrontendWorkspacePath(data.operation.path, 'target frontend patch file')

    if (data.operation.action === 'delete') {
        return ''
    }

    return retryAsync({
        label: `build agent patch (${data.operation.path})`,
        maxAttempts: BUILD_AGENT_MAX_ATTEMPTS,
        task: async (attempt, lastError) => {
            const completion = await openai.chat.completions.create({
                model: BUILD_AGENT_MODEL,
                temperature: 0,
                messages: [
                    {
                        role: 'system',
                        content: BUILD_PATCH_AGENT_PROMPT,
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
                throw new Error(`no response from build agent for ${data.operation.path}`)
            }

            return validateGeneratedFileContent(data.operation.path, content)
        },
    })
}
