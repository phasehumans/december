import { openai } from '../../config/oai'
import { PLAN_AGENT_PROMPT } from '../prompts/plan.prompt'

export const extractProjectPlan = async (data: any) => {
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
                content: JSON.stringify(data),
            },
        ],
    })

    const content = completion.choices[0]?.message?.content

    if (!content) {
        throw new Error('no response from planner agent')
    }

    return JSON.parse(content)
}
