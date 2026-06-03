import {
    generateProjectFile as generateProjectFileAgent,
    generateProjectPatchFile as generateProjectPatchFileAgent,
} from './build.agent'

import type {
    PlannedProjectFile,
    ProjectPatchOperation,
    ProjectIntent,
    ProjectPlan,
} from '../generation/generation.types'

export const generateProjectFile = (input: {
    brief: ProjectIntent
    plan: ProjectPlan
    targetFile: PlannedProjectFile
    generatedFiles: Record<string, string>
    model?: string
}) => generateProjectFileAgent(input)

export const generateProjectPatchFile = (input: {
    operation: ProjectPatchOperation
    currentFiles: Record<string, string>
    projectContext: {
        projectName: string
        sourcePrompt: string
        summary?: string | null
    }
    request: {
        mode: 'edit' | 'fix'
        prompt?: string
        runtimeError?: {
            message: string
            stack?: string
        }
        selectedElement?: {
            tagName: string
            textContent: string
        }
    }
    model?: string
}) => generateProjectPatchFileAgent(input)

export { generateWorkDoneSummary } from './build.agent'
