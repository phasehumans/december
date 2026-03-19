import { extractProjectPlan } from '../../core/agents/plan.agent'
import { extractProjectIntent } from '../../core/agents/prompt.agent'
import { generateProjectFile } from '../../core/agents/build.agent'
import { cleanPrompt } from '../../utils/cleanPrompt'
import { extractProjectPlanSchema, generateProjectFileSchema } from './generation.schema'

type GenerateWebsite = {
    prompt: string
    userId: string
    isDB: boolean
    dbURL?: string
}

const generateWebsite = async (data: GenerateWebsite) => {
    const { prompt, userId, isDB, dbURL } = data

    const userPrompt = cleanPrompt(prompt)
    const projectIntent = await extractProjectIntent({ userPrompt })
    console.log(projectIntent)

    const parseIntent = extractProjectPlanSchema.safeParse(projectIntent)

    if (!parseIntent.success) {
        throw new Error('invalid response | prompt agent')
    }

    const projectPlan = await extractProjectPlan(parseIntent.data)
    console.log(projectPlan)
    // console.log(JSON.stringify(projectPlan, null, 2))

    const parsePlan = generateProjectFileSchema.safeParse(projectPlan)

    if (!parsePlan.success) {
        throw new Error('invalid repsonse | plan agent')
    }

    const projectFiles = await generateProjectFile(parsePlan.data)
    console.log(projectFiles)
    // console.log(JSON.stringify(projectFiles, null, 2))

    return 'all ok'
}

export const generateService = {
    generateWebsite,
}
