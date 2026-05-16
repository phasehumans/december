import {
    generateProjectFile as generateProjectFileAgent,
    generateProjectPatchFile as generateProjectPatchFileAgent,
} from '../../agents/build.agent'

import type {
    PlannedProjectFile,
    ProjectPatchOperation,
    ProjectIntent,
    ProjectPlan,
} from '../../../modules/generation/generation.types'

export const generateProjectFile = (input: {
    intent: ProjectIntent
    plan: ProjectPlan
    targetFile: PlannedProjectFile
    generatedFiles: Record<string, string>
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
}) => generateProjectPatchFileAgent(input)
