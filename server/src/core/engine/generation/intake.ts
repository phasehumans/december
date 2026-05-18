import {
    extractProjectChangePlan as extractProjectChangePlanAgent,
    extractProjectPlan as extractProjectPlanAgent,
} from '../../agents/plan.agent'

import type { GenerateWebsiteInput } from '../../../modules/generation/generation.types'

export const extractProjectPlan = (input: {
    userPrompt: string
    canvasState?: GenerateWebsiteInput['canvasState']
}) => extractProjectPlanAgent(input)

export const extractProjectChangePlan = extractProjectChangePlanAgent
