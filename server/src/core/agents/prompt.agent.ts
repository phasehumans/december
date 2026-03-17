import OpenAI from 'openai'
import { FEATURE_EXTRACTION_PROMPT } from '../prompts/prompt.prompts'

const openai = new OpenAI({
    baseURL: 'https://openrouter.ai/api/v1',
    apiKey: process.env.OPENROUTER_API_KEY,
    defaultHeaders: {
        'HTTP-Referer': 'http://localhost:4000',
        'X-OpenRouter-Title': 'phasehumans',
    },
})

export const extractProjectIntent = async (userPrompt: string) => {
    const completion = await openai.chat.completions.create({
        model: 'openai/gpt-oss-20b:free',
        temperature: 0,
        messages: [
            {
                role: 'system',
                content: FEATURE_EXTRACTION_PROMPT,
            },
            {
                role: 'user',
                content: userPrompt,
            },
        ],
    })

    const content = completion.choices[0]?.message?.content

    if (!content) {
        throw new Error('prompt agent returned empty response')
    }

    return JSON.parse(content)
}
