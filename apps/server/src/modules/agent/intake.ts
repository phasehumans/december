import {
    extractProjectChangePlan as extractProjectChangePlanAgent,
    extractProjectPlan as extractProjectPlanAgent,
} from './plan.agent'

import type { ExtractProjectPlan } from '@december/shared'

export const extractProjectPlan = (data: ExtractProjectPlan) => extractProjectPlanAgent(data)

export const extractProjectChangePlan = extractProjectChangePlanAgent
