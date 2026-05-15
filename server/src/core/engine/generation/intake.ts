import {
    extractProjectChangePlan as extractProjectChangePlanAgent,
    extractProjectIntent as extractProjectIntentAgent,
    extractProjectPlan as extractProjectPlanAgent,
} from '../../agents/plan.agent'
import type { ProjectIntent } from '../../../modules/generation/generation.types'

export const extractProjectIntent = (input: { userPrompt: string }) =>
    extractProjectIntentAgent(input)

export const extractProjectPlan = (intent: ProjectIntent) => extractProjectPlanAgent(intent)

export const extractProjectChangePlan = extractProjectChangePlanAgent
