import { applyProjectEdit as applyProjectEditAgent } from '../../agents/edit.agent'
import { applyProjectFix as applyProjectFixAgent } from '../../agents/fix.agent'

export const applyProjectEdit = (input: {
    prompt: string
    selectedElement?: {
        tagName: string
        textContent: string
    }
    project: {
        name: string
        description: string | null
        prompt: string
    }
    recentMessages: Array<{
        role: 'USER' | 'ASSISTANT' | 'SYSTEM'
        content: string
    }>
    files: Record<string, string>
}) => applyProjectEditAgent(input)

export const applyProjectFix = (input: {
    errorMessage: string
    stack?: string
    project: {
        name: string
        description: string | null
        prompt: string
    }
    recentMessages: Array<{
        role: 'USER' | 'ASSISTANT' | 'SYSTEM'
        content: string
    }>
    files: Record<string, string>
}) => applyProjectFixAgent(input)
