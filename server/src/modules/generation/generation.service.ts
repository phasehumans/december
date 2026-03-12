import { extractProjectIntent } from '../../core/agents/prompt.agent'
import { cleanPrompt } from '../../utils/cleanPrompt'

type generateWebsite = {
    prompt: string
    userId: string
}

const generateWebsite = async (data: generateWebsite) => {
    const { prompt, userId } = data

    const userPrompt = cleanPrompt(prompt)
    const result = await extractProjectIntent(userPrompt)

    return result
}

export const generateService = {
    generateWebsite,
}
