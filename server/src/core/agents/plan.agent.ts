import { z } from 'zod'

import { openai } from '../../config/oai'
import {
    extractProjectPlanSchema,
    projectChangePlanResponseSchema,
    planAgentResponseSchema,
    promptAgentResponseSchema,
} from '../../modules/generation/generation.schema'
import { parseModelJson } from '../../utils/parseModelJson'
import { readChatCompletionText } from '../../utils/readChatCompletionText'
import { retryAsync } from '../../utils/retry'
import { PLAN_INTENT_PROMPT } from '../prompts/plan-intent.prompt'
import { PLAN_AGENT_PROMPT } from '../prompts/plan.prompt'

type ExtractProjectPlan = z.infer<typeof extractProjectPlanSchema>
type ExtractProjectPlanResponse = z.infer<typeof planAgentResponseSchema>
type ExtractProjectIntentResponse = z.infer<typeof promptAgentResponseSchema>
type ExtractProjectChangePlanResponse = z.infer<typeof projectChangePlanResponseSchema>

type ExtractProjectIntent = {
    userPrompt: string
}

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
const PLAN_AGENT_MAX_TOKENS = 1600
const PLAN_AGENT_CHANGE_MAX_TOKENS = 1800

const validatePlanAgentResponse = (payload: unknown): ExtractProjectPlanResponse => {
    const parsed = planAgentResponseSchema.safeParse(payload)

    if (!parsed.success) {
        throw new Error(`invalid response | plan agent | ${parsed.error.message}`)
    }

    return parsed.data
}

const validateIntentResponse = (payload: unknown): ExtractProjectIntentResponse => {
    const parsed = promptAgentResponseSchema.safeParse(payload)

    if (!parsed.success) {
        throw new Error(`invalid response | plan agent intent | ${parsed.error.message}`)
    }

    return parsed.data
}

const validateChangePlanResponse = (payload: unknown): ExtractProjectChangePlanResponse => {
    const parsed = projectChangePlanResponseSchema.safeParse(payload)

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

export const extractProjectIntent = async (data: ExtractProjectIntent) => {
    return retryAsync({
        label: 'plan agent intent',
        maxAttempts: 2,
        task: async (attempt, lastError) => {
            const completion = await openai.chat.completions.create({
                model: PLAN_AGENT_MODEL,
                temperature: 0,
                messages: [
                    {
                        role: 'system',
                        content: PLAN_INTENT_PROMPT,
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
                throw new Error('plan agent returned empty intent response')
            }

            return validateIntentResponse(parseModelJson(content, 'plan agent intent'))
        },
    })
}

const CHANGE_PLAN_AGENT_PROMPT = `You are the Plan Agent for December follow-up edits and runtime fixes.

Your job is to inspect the current generated project context and return a targeted patch plan for the Build Agent.
You do not write code. You only decide which existing frontend files should be created, updated, or deleted.

Return ONLY valid JSON.
No markdown.
No code fences.
No extra text.

Hard rules:
- Stay browser-only Bun React TypeScript.
- Stay inside approved frontend files: root config files, src/, and public/.
- Do not plan backend, API, database, Prisma, env, Docker, or server files.
- Prefer the smallest reliable patch.
- For follow-up edits, update only files needed for the requested visible change.
- For runtime fixes, target the smallest set of files that can plausibly fix the error.
- Do not rewrite the whole project unless the current file tree is fundamentally unrunnable.
- Use action "delete" only when removal is necessary.
- Each operation path must be unique.
- The Build Agent will receive one operation at a time plus the current file content.

The user-visible message should be 4 to 8 short lines separated by newline characters.
Each line should describe a concrete planning decision without mentioning prompts, schemas, retries, or hidden mechanics.

Return exactly this JSON shape:
{
  "message": "string",
  "summary": "string",
  "plan": {
    "success": true,
    "message": "Patch plan generated successfully",
    "data": {
      "summary": "string",
      "operations": [
        {
          "path": "src/App.tsx",
          "action": "update",
          "purpose": "What this file change accomplishes",
          "instructions": "Precise instructions for the Build Agent"
        }
      ]
    },
    "errors": []
  }
}

If the request cannot be safely planned, return the same shape with success false, data null, and errors populated.`

const toCompactChangePlanInput = (data: ExtractProjectChangePlan) => ({
    mode: data.mode,
    prompt: data.prompt,
    selectedElement: data.selectedElement,
    runtimeError: data.runtimeError,
    project: data.project,
    baseVersion: data.baseVersion,
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
                                  content: `Retry attempt ${attempt}. The previous change plan could not be used: ${lastError?.message ?? 'unknown error'}. Return only one valid JSON object in the exact required shape with unique frontend paths.`,
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
