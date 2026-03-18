import { openai } from '../../config/oai'
import { FEATURE_EXTRACTION_PROMPT } from '../prompts/prompt.prompt'

type UserPrompt = {
    
}

export const extractProjectIntent = async (data: string) => {
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
                content: data,
            },
        ],
    })

    const content = completion.choices[0]?.message?.content

    if (!content) {
        throw new Error('prompt agent returned empty response')
    }

    return JSON.parse(content)
}
