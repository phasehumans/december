import { z } from 'zod'
import { openai } from '../../config/oai'
import {
    editAgentResponseSchema,
    previewSelectedElementSchema,
} from '../../modules/generation/generation.schema'
import { parseModelJson } from '../../utils/parseModelJson'
import { retryAsync } from '../../utils/retry'
import { EDIT_AGENT_PROMPT } from '../prompts/edit.prompt'

type PreviewSelectedElement = z.infer<typeof previewSelectedElementSchema>

type ApplyProjectEditInput = {
    prompt: string
    selectedElement?: PreviewSelectedElement
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

const EDIT_AGENT_MAX_ATTEMPTS = 3

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
        throw new Error(`markdown fences detected in edited content for ${path}`)
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

export const applyProjectEdit = async (data: ApplyProjectEditInput) => {
    return retryAsync({
        label: 'edit agent',
        maxAttempts: EDIT_AGENT_MAX_ATTEMPTS,
        task: async (attempt, lastError) => {
            const completion = await openai.chat.completions.create({
                model: 'openai/gpt-5.1-codex-mini',
                max_tokens: 6000,
                temperature: 0,
                messages: [
                    {
                        role: 'system',
                        content: EDIT_AGENT_PROMPT,
                    },
                    {
                        role: 'user',
                        content: JSON.stringify({
                            editRequest: data.prompt,
                            selectedElement: data.selectedElement ?? null,
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
                                  content: `Retry attempt ${attempt}. The previous edit response could not be used: ${lastError?.message ?? 'unknown error'}. Return only one valid JSON object in the exact required shape.`,
                              },
                          ]
                        : []),
                ],
            })

            const content = completion.choices[0]?.message?.content

            if (!content) {
                throw new Error('edit agent returned empty response')
            }

            const parsed = editAgentResponseSchema.safeParse(parseModelJson(content, 'edit agent'))

            if (!parsed.success) {
                throw new Error(`invalid response | edit agent | ${parsed.error.message}`)
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
