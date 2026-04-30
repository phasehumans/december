import { openai } from '../../config/oai'
import { parseModelJson } from '../../utils/parseModelJson'
import { readChatCompletionText } from '../../utils/readChatCompletionText'
import { retryAsync } from '../../utils/retry'
import { CONTEXT_AGENT_PROMPT } from '../prompts/context.prompt'

type ExtractProjectIntent = {
    userPrompt: string
}

const CONTEXT_AGENT_MAX_ATTEMPTS = 2
const CONTEXT_AGENT_MODEL = 'openai/gpt-oss-20b:free' //model: 'openai/gpt-5.1-codex-mini',
// const PROMPT_AGENT_MAX_TOKENS = 1200

export const extractProjectIntent = async (data: ExtractProjectIntent) => {
    return retryAsync({
        label: 'context agent',
        maxAttempts: CONTEXT_AGENT_MAX_ATTEMPTS,
        task: async (attempt, lastError) => {
            const completion = await openai.chat.completions.create({
                model: CONTEXT_AGENT_MODEL,
                temperature: 0,
                messages: [
                    {
                        role: 'system',
                        content: CONTEXT_AGENT_PROMPT,
                    },
                    {
                        role: 'user',
                        content: data.userPrompt,
                    },
                    ...(attempt > 1
                        ? [
                              {
                                  role: 'system' as const,
                                  content: `Retry attempt ${attempt}. The previous response could not be used: ${lastError?.message ?? 'unknown error'}. Return only one valid JSON object in the exact required shape.`,
                              },
                          ]
                        : []),
                ],
            })

            const content = readChatCompletionText(completion)

            if (!content) {
                throw new Error('context agent returned empty response')
            }

            return parseModelJson(content, 'context agent')
        },
    })
}
