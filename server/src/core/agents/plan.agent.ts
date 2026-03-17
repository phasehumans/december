import OpenAI from 'openai'
import { PLAN_AGENT_PROMPT } from '../prompts/plan.prompts'

const openai = new OpenAI({
    baseURL: 'https://openrouter.ai/api/v1',
    apiKey: process.env.OPENROUTER_API_KEY,
    defaultHeaders: {
        'HTTP-Referer': 'http://localhost:4000',
        'X-OpenRouter-Title': 'phasehumans',
    },
})

export const extractProjectPlan = async (structureIntent: any) => {
    const completion = await openai.chat.completions.create({
        model: 'openai/gpt-oss-20b:free',
        temperature: 0,
        messages: [
            {
                role: 'system',
                content: PLAN_AGENT_PROMPT,
            },
            {
                role: 'user',
                content: JSON.stringify(structureIntent),
            },
        ],
    })

    const content = completion.choices[0]?.message?.content

    if (!content) {
        throw new Error('no response from planner agent')
    }

    return JSON.parse(content)
}
