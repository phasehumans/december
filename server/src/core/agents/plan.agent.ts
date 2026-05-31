import { z } from 'zod'

import { openai } from '../../config/oai'
import {
    extractProjectPlanSchema,
    projectChangePlanResponseSchema,
    planAgentResponseSchema,
} from '../../modules/generation/generation.schema'
import {
    autoHealPlanAgentResponse,
    autoHealChangePlanResponse,
} from '../../modules/generation/generation.self-healing'
import { parseModelJson } from '../../utils/parseModelJson'
import { readChatCompletionText } from '../../utils/readChatCompletionText'
import { retryAsync } from '../../utils/retry'
import { CHANGE_PLAN_AGENT_PROMPT, PLAN_AGENT_PROMPT } from '../prompts/plan.prompt'

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

export const extractProjectPlan = async (data: ExtractProjectPlan) => {
    const compactData = {
        userPrompt: data.userPrompt,
        canvasState: cleanCanvasState(data.canvasState),
    }

    return retryAsync({
        label: 'plan agent',
        maxAttempts: PLAN_AGENT_MAX_ATTEMPTS,
        task: async (attempt, lastError) => {
            const completion = await openai.chat.completions.create({
                model: PLAN_AGENT_MODEL,
                max_tokens: PLAN_AGENT_MAX_TOKENS,
                temperature: 0,
                messages: [
                    {
                        role: 'system',
                        content: PLAN_AGENT_PROMPT,
                    },
                    {
                        role: 'user',
                        content: JSON.stringify(compactData),
                    },
                    ...(attempt > 1
                        ? [
                              {
                                  role: 'system' as const,
                                  content: `Retry attempt ${attempt}. The previous plan could not be used: ${lastError?.message ?? 'unknown error'}. Return only one valid JSON object in the exact required shape. thinking and summary must be JSON arrays of short strings with no embedded newline characters. Keep unique frontend file paths and a complete buildOrder.`,
                              },
                          ]
                        : []),
                ],
            })

            const content = readChatCompletionText(completion)

            if (!content) {
                throw new Error('no response from plan agent')
            }

            return validatePlanAgentResponse(parsePlanAgentPayload(content, completion))
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

export const extractProjectChangePlan = async (data: ExtractProjectChangePlan) => {
    return retryAsync({
        label: `plan agent ${data.mode}`,
        maxAttempts: PLAN_AGENT_MAX_ATTEMPTS,
        task: async (attempt, lastError) => {
            const completion = await openai.chat.completions.create({
                model: PLAN_AGENT_MODEL,
                max_tokens: PLAN_AGENT_CHANGE_MAX_TOKENS,
                temperature: 0,
                messages: [
                    {
                        role: 'system',
                        content: CHANGE_PLAN_AGENT_PROMPT,
                    },
                    {
                        role: 'user',
                        content: JSON.stringify(toCompactChangePlanInput(data)),
                    },
                    ...(attempt > 1
                        ? [
                              {
                                  role: 'system' as const,
                                  content: `Retry attempt ${attempt}. The previous change plan could not be used: ${lastError?.message ?? 'unknown error'}. Return only one valid JSON object in the exact required shape. thinking and summary must be JSON arrays of short strings with no embedded newline characters. Keep unique frontend paths.`,
                              },
                          ]
                        : []),
                ],
            })

            const content = readChatCompletionText(completion)

            if (!content) {
                throw new Error(`no response from plan agent ${data.mode}`)
            }

            return validateChangePlanResponse(parsePlanAgentPayload(content, completion))
        },
    })
}
