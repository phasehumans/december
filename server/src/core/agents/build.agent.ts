import { openai } from '../../config/oai'
import { BUILD_AGENT_PROMPT } from '../prompts/build.prompt'

export const generateProjectFile = async (data: any) => {
    const completion = await openai.chat.completions.create({
        model: 'openai/gpt-oss-20b:free',
        temperature: 0,
        messages: [
            {
                role: 'system',
                content: BUILD_AGENT_PROMPT,
            },
            {
                role: 'user',
                content: JSON.stringify(data),
            },
        ],
    })

    const content = completion.choices[0]?.message?.content

    if (!content) {
        throw new Error('no response from build agent')
    }

    return content
}
