import { z } from 'zod'
import { openai } from '../../config/oai'
import {
    assertFrontendWorkspacePath,
    isFrontendWorkspacePath,
} from '../../modules/generation/frontend-paths'
import {
    plannedProjectFileSchema,
    projectIntentSchema,
    projectPlanSchema,
} from '../../modules/generation/generation.schema'
import { readChatCompletionText } from '../../utils/readChatCompletionText'
import { retryAsync } from '../../utils/retry'
import { BUILD_AGENT_PROMPT } from '../prompts/build.prompt'

type ProjectIntent = z.infer<typeof projectIntentSchema>
type ProjectPlan = z.infer<typeof projectPlanSchema>
type PlannedProjectFile = z.infer<typeof plannedProjectFileSchema>

type GenerateProjectFileInput = {
    intent: ProjectIntent
    plan: ProjectPlan
    targetFile: PlannedProjectFile
    generatedFiles: Record<string, string>
}

const BUILD_AGENT_MAX_ATTEMPTS = 3
const BUILD_CONTEXT_LIMIT = 6

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
                model: 'openai/gpt-oss-20b:free',
                // model: 'openai/gpt-5.1-codex-mini',
                // max_tokens: 4000,
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
