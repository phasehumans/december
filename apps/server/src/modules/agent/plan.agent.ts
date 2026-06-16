import { projectChangePlanResponseSchema, planAgentResponseSchema } from '@december/shared'
import { z } from 'zod'

import { openai } from '../../config/oai'
import {
    autoHealPlanAgentResponse,
    autoHealChangePlanResponse,
} from '../generation/generation.self-healing'
import { loadMemoryPromptInstructions } from '../memory/memory.service'

import { parseModelJson, retryAsync } from './agents.utils'
import { CHANGE_PLAN_AGENT_PROMPT, PLAN_AGENT_PROMPT } from './plan.prompt'

import type { ExtractProjectPlan, ExtractProjectChangePlan } from '@december/shared'

type ExtractProjectPlanResponse = z.infer<typeof planAgentResponseSchema>
type ExtractProjectChangePlanResponse = z.infer<typeof projectChangePlanResponseSchema>

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
            throw new Error('truncated JSON response | plan agent | model stopped at token limit', {
                cause: error,
            })
        }

        throw error
    }
}

export const extractProjectPlan = async (data: ExtractProjectPlan) => {
    const { userPrompt, canvasState, model, onStream, projectId, userId } = data
    const compactData = {
        userPrompt,
        canvasState: cleanCanvasState(canvasState),
    }

    return retryAsync({
        label: 'plan agent',
        maxAttempts: PLAN_AGENT_MAX_ATTEMPTS,
        task: async (attempt, lastError) => {
            console.log(`[generation] plan agent starting, attempt: ${attempt}`)
            const memoryInstructions = projectId
                ? await loadMemoryPromptInstructions({
                      projectId,
                      userId,
                  })
                : ''
            const systemPrompt = PLAN_AGENT_PROMPT + memoryInstructions
            const completion = await openai.chat.completions.create({
                model: model || process.env.AUTO_MODEL || PLAN_AGENT_MODEL,
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
                if (onStream) {
                    await onStream(content)
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

const toCompactChangePlanInput = (data: ExtractProjectChangePlan) => {
    const {
        mode,
        prompt,
        selectedElement,
        runtimeError,
        project,
        baseVersion,
        canvasState,
        fileTree,
        recentMessages,
    } = data
    return {
        mode,
        prompt,
        selectedElement,
        runtimeError,
        project,
        baseVersion,
        canvasState: cleanCanvasState(canvasState),
        fileTree,
        recentMessages,
    }
}

export const extractProjectChangePlan = async (data: ExtractProjectChangePlan) => {
    const {
        mode,
        prompt,
        selectedElement,
        runtimeError,
        project,
        baseVersion,
        canvasState,
        fileTree,
        recentMessages,
        model,
        onStream,
        userId,
    } = data
    return retryAsync({
        label: `plan agent ${mode}`,
        maxAttempts: PLAN_AGENT_MAX_ATTEMPTS,
        task: async (attempt, lastError) => {
            console.log(
                `[generation change] plan agent starting, mode: ${mode}, attempt: ${attempt}`
            )
            const memoryInstructions = await loadMemoryPromptInstructions({
                projectId: project.id,
                userId,
            })
            const systemPrompt = CHANGE_PLAN_AGENT_PROMPT + memoryInstructions
            const completion = await openai.chat.completions.create({
                model: model || process.env.AUTO_MODEL || PLAN_AGENT_MODEL,
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
                if (onStream) {
                    await onStream(content)
                }
            }

            if (!content) {
                console.log(`[generation change] plan agent failed: no response`)
                throw new Error(`no response from plan agent ${mode}`)
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
