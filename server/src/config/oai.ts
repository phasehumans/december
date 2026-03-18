import OpenAI from 'openai'

export const openai = new OpenAI({
    baseURL: 'https://openrouter.ai/api/v1',
    apiKey: process.env.OPENROUTER_API_KEY,
    defaultHeaders: {
        'HTTP-Referer': 'http://localhost:4000',
        'X-OpenRouter-Title': 'phasehumans',
    },
})