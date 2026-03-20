import { openai } from '../../config/oai'
import { parseModelJson } from '../../utils/parseModelJson'
import { FEATURE_EXTRACTION_PROMPT } from '../prompts/prompt.prompt'

type ExtractProjectIntent = {
    userPrompt: string
}

export const extractProjectIntent = async (data: ExtractProjectIntent) => {
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
                content: data.userPrompt,
            },
        ],
    })

    const content = completion.choices[0]?.message?.content

    if (!content) {
        throw new Error('prompt agent returned empty response')
    }

    return parseModelJson(content, 'prompt agent')
}
