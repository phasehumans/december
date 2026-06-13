import { z } from 'zod'

import { openai } from '../../config/oai'
import {
    extractProjectPlanSchema,
    projectChangePlanResponseSchema,
    planAgentResponseSchema,
} from '../generation/generation.schema'
import {
    autoHealPlanAgentResponse,
    autoHealChangePlanResponse,
} from '../generation/generation.self-healing'
import { parseModelJson, readChatCompletionText, retryAsync } from './agents.utils'
import { CHANGE_PLAN_AGENT_PROMPT, PLAN_AGENT_PROMPT } from './plan.prompt'
import { loadMemoryPromptInstructions } from '../memory/memory.service'

type ExtractProjectPlan = z.infer<typeof extractProjectPlanSchema>
type ExtractProjectPlanResponse = z.infer<typeof planAgentResponseSchema>
type ExtractProjectChangePlanResponse = z.infer<typeof projectChangePlanResponseSchema>

type ExtractProjectChangePlan = {
    mode: 'edit' | 'fix'
    prompt?: string
    selectedElement?: {
        tagName: string
        textContent: string
    }
    runtimeError?: {
        message: string
        stack?: string
    }
    project: {
        id: string
        name: string
        description?: string | null
        prompt: string
    }
    baseVersion: {
        id: string
        versionNumber: number
        summary?: string | null
        sourcePrompt: string
        intentJson?: unknown
        planJson?: unknown
    }
    canvasState?: unknown
    fileTree: Array<{
        path: string
        excerpt: string
    }>
    recentMessages: Array<{
        role: string
        content: string
    }>
}

type ChatCompletionWithFinishReason = {
    choices?: Array<{
        finish_reason?: string | null
    }>
}

const PLAN_AGENT_MAX_ATTEMPTS = 3
const PLAN_AGENT_MODEL = 'openai/gpt-oss-20b:free'
const PLAN_AGENT_MAX_TOKENS = 4096
const PLAN_AGENT_CHANGE_MAX_TOKENS = 4096

const cleanCanvasItem = (item: any) => {
    if (!item) return item
    const cleaned = { ...item }
    if (cleaned.type === 'image') {
        delete cleaned.content
    }
    if (cleaned.points) {
        delete cleaned.points
    }
    return cleaned
}

const cleanCanvasState = (state: any) => {
    if (!state) return state
    try {
        const cleaned = { ...state }
        if (Array.isArray(cleaned.items)) {
            cleaned.items = cleaned.items.map(cleanCanvasItem)
        }
        return cleaned
    } catch {
        return state
    }
}

const validatePlanAgentResponse = (payload: unknown): ExtractProjectPlanResponse => {
    const healed = autoHealPlanAgentResponse(payload)
    const parsed = planAgentResponseSchema.safeParse(healed)

    if (!parsed.success) {
        throw new Error(`invalid response | plan agent | ${parsed.error.message}`)
    }

    return parsed.data
}

const validateChangePlanResponse = (payload: unknown): ExtractProjectChangePlanResponse => {
    const healed = autoHealChangePlanResponse(payload)
    const parsed = projectChangePlanResponseSchema.safeParse(healed)

    if (!parsed.success) {
        throw new Error(`invalid response | plan agent change | ${parsed.error.message}`)
    }

    return parsed.data
}

const parsePlanAgentPayload = (
    content: string,
    completion: ChatCompletionWithFinishReason | null | undefined
) => {
    try {
        return parseModelJson(content, 'plan agent')
    } catch (error) {
        const finishReason = completion?.choices?.[0]?.finish_reason

        if (finishReason === 'length') {
            throw new Error('truncated JSON response | plan agent | model stopped at token limit')
        }

        throw error
    }
}

export const extractProjectPlan = async (
    data: ExtractProjectPlan & {
        model?: string
        onStream?: (fullContent: string) => Promise<void>
        projectId?: string
        userId?: string
    }
) => {
    const compactData = {
        userPrompt: data.userPrompt,
        canvasState: cleanCanvasState(data.canvasState),
    }

    return retryAsync({
        label: 'plan agent',
        maxAttempts: PLAN_AGENT_MAX_ATTEMPTS,
        task: async (attempt, lastError) => {
            console.log(`[generation] plan agent starting, attempt: ${attempt}`)
            const memoryInstructions = data.projectId
                ? await loadMemoryPromptInstructions({
                      projectId: data.projectId,
                      userId: data.userId,
                  })
                : ''
            const systemPrompt = PLAN_AGENT_PROMPT + memoryInstructions
            const completion = await openai.chat.completions.create({
                model: data.model || process.env.AUTO_MODEL || PLAN_AGENT_MODEL,
                max_tokens: PLAN_AGENT_MAX_TOKENS,
                temperature: 0,
                messages: [
                    {
                        role: 'system',
                        content: systemPrompt,
                    },
                    {
                        role: 'user',
                        content: JSON.stringify(compactData),
                    },
                    ...(attempt > 1
                        ? [
                              {
                                  role: 'system' as const,
                                  content: `Retry attempt ${attempt}. The previous plan could not be used: ${lastError?.message ?? 'unknown error'}. Return only one valid JSON object in the exact required shape. thoughts and plan_of_action must be JSON arrays of short strings with no embedded newline characters. Keep unique frontend file paths and a complete buildOrder.`,
                              },
                          ]
                        : []),
                ],
                stream: true,
            })

            let content = ''
            for await (const chunk of completion) {
                const delta = chunk.choices[0]?.delta?.content || ''
                content += delta
                if (data.onStream) {
                    await data.onStream(content)
                }
            }

            if (!content) {
                console.log(`[generation] plan agent failed: no response`)
                throw new Error('no response from plan agent')
            }

            console.log(
                `[generation] plan agent completed successfully. Full response:\n${content}`
            )
            const parsedData = validatePlanAgentResponse(parsePlanAgentPayload(content, undefined))
            return {
                data: parsedData,
                usage: {
                    inputTokens: (completion as any).usage?.prompt_tokens ?? 0,
                    outputTokens: (completion as any).usage?.completion_tokens ?? 0,
                    totalTokens: (completion as any).usage?.total_tokens ?? 0,
                },
            }
        },
    })
}

const toCompactChangePlanInput = (data: ExtractProjectChangePlan) => ({
    mode: data.mode,
    prompt: data.prompt,
    selectedElement: data.selectedElement,
    runtimeError: data.runtimeError,
    project: data.project,
    baseVersion: data.baseVersion,
    canvasState: cleanCanvasState(data.canvasState),
    fileTree: data.fileTree,
    recentMessages: data.recentMessages,
})

export const extractProjectChangePlan = async (
    data: ExtractProjectChangePlan & {
        model?: string
        onStream?: (fullContent: string) => Promise<void>
        userId?: string
    }
) => {
    return retryAsync({
        label: `plan agent ${data.mode}`,
        maxAttempts: PLAN_AGENT_MAX_ATTEMPTS,
        task: async (attempt, lastError) => {
            console.log(
                `[generation change] plan agent starting, mode: ${data.mode}, attempt: ${attempt}`
            )
            const memoryInstructions = await loadMemoryPromptInstructions({
                projectId: data.project.id,
                userId: data.userId,
            })
            const systemPrompt = CHANGE_PLAN_AGENT_PROMPT + memoryInstructions
            const completion = await openai.chat.completions.create({
                model: data.model || process.env.AUTO_MODEL || PLAN_AGENT_MODEL,
                max_tokens: PLAN_AGENT_CHANGE_MAX_TOKENS,
                temperature: 0,
                messages: [
                    {
                        role: 'system',
                        content: systemPrompt,
                    },
                    {
                        role: 'user',
                        content: JSON.stringify(toCompactChangePlanInput(data)),
                    },
                    ...(attempt > 1
                        ? [
                              {
                                  role: 'system' as const,
                                  content: `Retry attempt ${attempt}. The previous change plan could not be used: ${lastError?.message ?? 'unknown error'}. Return only one valid JSON object in the exact required shape. thoughts and plan_of_action must be JSON arrays of short strings with no embedded newline characters. Keep unique frontend paths.`,
                              },
                          ]
                        : []),
                ],
                stream: true,
            })

            let content = ''
            for await (const chunk of completion) {
                const delta = chunk.choices[0]?.delta?.content || ''
                content += delta
                if (data.onStream) {
                    await data.onStream(content)
                }
            }

            if (!content) {
                console.log(`[generation change] plan agent failed: no response`)
                throw new Error(`no response from plan agent ${data.mode}`)
            }

            console.log(
                `[generation change] plan agent completed successfully. Full response:\n${content}`
            )

            const parsedData = validateChangePlanResponse(parsePlanAgentPayload(content, undefined))
            return {
                data: parsedData,
                usage: {
                    inputTokens: (completion as any).usage?.prompt_tokens ?? 0,
                    outputTokens: (completion as any).usage?.completion_tokens ?? 0,
                    totalTokens: (completion as any).usage?.total_tokens ?? 0,
                },
            }
        },
    })
}
