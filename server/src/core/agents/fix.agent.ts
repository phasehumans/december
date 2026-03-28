import { openai } from '../../config/oai'
import { fixAgentResponseSchema } from '../../modules/generation/generation.schema'
import { parseModelJson } from '../../utils/parseModelJson'
import { retryAsync } from '../../utils/retry'
import { FIX_AGENT_PROMPT } from '../prompts/fix.prompt'

type ApplyProjectFixInput = {
    errorMessage: string
    stack?: string
    project: {
        name: string
        description: string | null
        prompt: string
    }
    recentMessages: Array<{
        role: 'USER' | 'ASSISTANT' | 'SYSTEM'
        content: string
    }>
    files: Record<string, string>
}

const FIX_AGENT_MAX_ATTEMPTS = 3

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

const validateChangedFileContent = (path: string, content: string) => {
    const normalizedContent = stripWrappingCodeFence(content)

    if (normalizedContent.includes('```')) {
        throw new Error(`markdown fences detected in fixed content for ${path}`)
    }

    if (path.endsWith('.json')) {
        try {
            JSON.parse(normalizedContent)
        } catch {
            throw new Error(`invalid JSON generated for ${path}`)
        }
    }

    return normalizedContent
}

export const applyProjectFix = async (data: ApplyProjectFixInput) => {
    return retryAsync({
        label: 'fix agent',
        maxAttempts: FIX_AGENT_MAX_ATTEMPTS,
        task: async (attempt, lastError) => {
            const completion = await openai.chat.completions.create({
                model: 'openai/gpt-5.1-codex-mini',
                max_tokens: 6000,
                temperature: 0,
                messages: [
                    {
                        role: 'system',
                        content: FIX_AGENT_PROMPT,
                    },
                    {
                        role: 'user',
                        content: JSON.stringify({
                            runtimeError: {
                                message: data.errorMessage,
                                stack: data.stack ?? null,
                            },
                            project: data.project,
                            recentMessages: data.recentMessages,
                            existingFiles: Object.entries(data.files).map(([path, content]) => ({
                                path,
                                content,
                            })),
                        }),
                    },
                    ...(attempt > 1
                        ? [
                              {
                                  role: 'system' as const,
                                  content: `Retry attempt ${attempt}. The previous fix response could not be used: ${lastError?.message ?? 'unknown error'}. Return only one valid JSON object in the exact required shape.`,
                              },
                          ]
                        : []),
                ],
            })

            const content = completion.choices[0]?.message?.content

            if (!content) {
                throw new Error('fix agent returned empty response')
            }

            const parsed = fixAgentResponseSchema.safeParse(parseModelJson(content, 'fix agent'))

            if (!parsed.success) {
                throw new Error(`invalid response | fix agent | ${parsed.error.message}`)
            }

            return {
                ...parsed.data,
                updatedFiles: parsed.data.updatedFiles.map((file) => ({
                    ...file,
                    content: validateChangedFileContent(file.path, file.content),
                })),
            }
        },
    })
}
