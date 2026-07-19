import OpenAI from 'openai'

import { env } from '../env'

export const openai = new OpenAI({
    baseURL: 'https://openrouter.ai/api/v1',
    apiKey: env.OPENROUTER_API_KEY,
    defaultHeaders: {
        'HTTP-Referer': env.SERVER_URL,
        'X-OpenRouter-Title': 'december',
        // 'x-title': 'december',
    },
})
