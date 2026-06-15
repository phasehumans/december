import {
    extractProjectChangePlan as extractProjectChangePlanAgent,
    extractProjectPlan as extractProjectPlanAgent,
} from './plan.agent'

import type { GenerateWebsiteInput } from '../generation/generation.types'

export const extractProjectPlan = (input: {
    userPrompt: string
    canvasState?: GenerateWebsiteInput['canvasState']
    model?: string
    onStream?: (fullContent: string) => Promise<void>
    projectId?: string
    userId?: string
}) => extractProjectPlanAgent(input)

export const extractProjectChangePlan = extractProjectChangePlanAgent
