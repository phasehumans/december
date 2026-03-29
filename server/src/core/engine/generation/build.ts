import { generateProjectFile as generateProjectFileAgent } from '../../agents/build.agent'
import type {
    PlannedProjectFile,
    ProjectIntent,
    ProjectPlan,
} from '../../../modules/generation/generation.types'

export const generateProjectFile = (input: {
    intent: ProjectIntent
    plan: ProjectPlan
    targetFile: PlannedProjectFile
    generatedFiles: Record<string, string>
}) => generateProjectFileAgent(input)
