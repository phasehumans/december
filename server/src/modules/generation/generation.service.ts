import { extractProjectPlan } from '../../core/agents/plan.agent'
import { extractProjectIntent } from '../../core/agents/prompt.agent'
import { cleanPrompt } from '../../utils/cleanPrompt'

type GenerateWebsite = {
    prompt: string
    userId: string
    isDB : boolean
    dbURL?: string
}

const generateWebsite = async (data: GenerateWebsite) => {
    const { prompt, userId, isDB, dbURL } = data

    const userPrompt = cleanPrompt(prompt)
    console.log(userPrompt)
    const projectIntent = await extractProjectIntent(userPrompt)
    console.log(projectIntent)
    const projectPlan = await extractProjectPlan(projectIntent)
    console.log(projectPlan)
    return projectPlan
}

export const generateService = {
    generateWebsite,
}
