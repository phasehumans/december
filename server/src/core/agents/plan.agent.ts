import { z } from 'zod'
import { openai } from '../../config/oai'
import {
    extractProjectPlanSchema,
    planAgentResponseSchema,
} from '../../modules/generation/generation.schema'
import { parseModelJson } from '../../utils/parseModelJson'
import { readChatCompletionText } from '../../utils/readChatCompletionText'
import { retryAsync } from '../../utils/retry'
import { PLAN_AGENT_PROMPT } from '../prompts/plan.prompt'

type ExtractProjectPlan = z.infer<typeof extractProjectPlanSchema>
type ExtractProjectPlanResponse = z.infer<typeof planAgentResponseSchema>

type ChatCompletionWithFinishReason = {
    choices?: Array<{
        finish_reason?: string | null
    }>
}

const PLAN_AGENT_MAX_ATTEMPTS = 3
const PLAN_AGENT_MODEL = 'openai/gpt-5.1-codex-mini'
const PLAN_AGENT_MAX_TOKENS = 6000

const validatePlanAgentResponse = (payload: unknown): ExtractProjectPlanResponse => {
    const parsed = planAgentResponseSchema.safeParse(payload)

    if (!parsed.success) {
        throw new Error(`invalid response | plan agent | ${parsed.error.message}`)
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
    return retryAsync({
        label: 'plan agent',
        maxAttempts: PLAN_AGENT_MAX_ATTEMPTS,
        task: async (attempt, lastError) => {
            const completion = await openai.chat.completions.create({
                model: PLAN_AGENT_MODEL,
                max_tokens: PLAN_AGENT_MAX_TOKENS,
                temperature: 0,
                response_format: { type: 'json_object' },
                messages: [
                    {
                        role: 'system',
                        content: PLAN_AGENT_PROMPT,
                    },
                    {
                        role: 'user',
                        content: JSON.stringify(data),
                    },
                    ...(attempt > 1
                        ? [
                              {
                                  role: 'system' as const,
                                  content: `Retry attempt ${attempt}. The previous plan could not be used: ${lastError?.message ?? 'unknown error'}. Return only one valid JSON object in the exact required shape, with deterministic file paths and generationOrder. Keep the response compact and complete.`,
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
