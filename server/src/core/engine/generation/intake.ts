import { extractProjectIntent as extractProjectIntentAgent } from '../../agents/prompt.agent'
import { extractProjectPlan as extractProjectPlanAgent } from '../../agents/plan.agent'
import type { ProjectIntent } from '../../../modules/generation/generation.types'

export const extractProjectIntent = (input: { userPrompt: string }) =>
    extractProjectIntentAgent(input)

export const extractProjectPlan = (intent: ProjectIntent) => extractProjectPlanAgent(intent)
