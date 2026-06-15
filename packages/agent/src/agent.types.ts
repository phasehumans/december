import type {
    PlannedProjectFile,
    ProjectPatchOperation,
    ProjectIntent,
    ProjectPlan,
    GenerateWebsiteInput,
} from '../../../apps/server/src/modules/generation/generation.types'

export type GenerateProjectFile = {
    brief: ProjectIntent
    plan: ProjectPlan
    targetFile: PlannedProjectFile
    generatedFiles: Record<string, string>
    model?: string
    projectId?: string
    userId?: string
}

export type GenerateProjectPatchFile = {
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
    projectId?: string
    userId?: string
}

export type ExtractProjectPlan = {
    userPrompt: string
    canvasState?: GenerateWebsiteInput['canvasState']
    model?: string
    onStream?: (fullContent: string) => Promise<void>
    projectId?: string
    userId?: string
}

export type ExtractProjectChangePlan = {
    mode: 'edit' | 'fix'
    prompt?: string
    selectedElement?: {
        tagName: string
        textContent: string
    }
    runtimeError?: {
        message: string
        stack?: string
    }
    project: {
        id: string
        name: string
        description?: string | null
        prompt: string
    }
    baseVersion: {
        id: string
        versionNumber: number
        summary?: string | null
        sourcePrompt: string
        intentJson?: unknown
        planJson?: unknown
    }
    canvasState?: unknown
    fileTree: Array<{
        path: string
        excerpt: string
    }>
    recentMessages: Array<{
        role: string
        content: string
    }>
    model?: string
    onStream?: (fullContent: string) => Promise<void>
    userId?: string
}
