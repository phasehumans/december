import { z } from 'zod'
import { openai } from '../../config/oai'
import { parseModelJson } from '../../utils/parseModelJson'
import { retryAsync } from '../../utils/retry'
import { projectIntentSchema } from '../../modules/generation/generation.schema'
import { PLAN_AGENT_PROMPT } from '../prompts/plan.prompt'

type ExtractProjectPlan = z.infer<typeof projectIntentSchema>

const PLAN_AGENT_MAX_ATTEMPTS = 3

export const extractProjectPlan = async (data: ExtractProjectPlan) => {
    return retryAsync({
        label: 'plan agent',
        maxAttempts: PLAN_AGENT_MAX_ATTEMPTS,
        task: async (attempt, lastError) => {
            const completion = await openai.chat.completions.create({
                // model: 'openai/gpt-oss-20b:free',
                model: 'openai/gpt-5.1-codex-mini',
                max_tokens: 6000,
                temperature: 0,
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
                                  content: `Retry attempt ${attempt}. The previous plan could not be used: ${lastError?.message ?? 'unknown error'}. Return only one valid JSON object in the exact required shape, with deterministic file paths and generationOrder.`,
                              },
                          ]
                        : []),
                ],
            })

            const content = completion.choices[0]?.message?.content

            if (!content) {
                throw new Error('no response from plan agent')
            }

            return parseModelJson(content, 'plan agent')
        },
    })
}
