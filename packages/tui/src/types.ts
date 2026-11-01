export type MessageBlock =
    | { type: 'text'; content: string; color?: string }
    | { type: 'thinking'; content: string; isStreaming?: boolean; durationMs?: number }
    | { type: 'compaction'; summary: string }
    | { type: 'error'; error: string; cause?: string; hint?: string }
    | { type: 'interrupt' }
    | {
          type: 'command'
          toolCallId?: string
          toolName?: string
          toolInput?: string
          command: string
          status: 'running' | 'success' | 'error'
          output?: string
      }
    | {
          type: 'file_change'
          filePath: string
          action: 'created' | 'modified' | 'deleted'
          diff?: string
      }
    | { type: 'code'; language: string; filename?: string; code: string }
    | { type: 'status'; label: string; success: boolean; hidePill?: boolean }

export type Message = {
    id: number | string
    role: 'user' | 'assistant' | 'error' | 'header'
    text?: string
    cause?: string
    hint?: string
    displayText?: string
    blocks?: MessageBlock[]
    usage?: {
        promptTokens: number
        completionTokens: number
        cacheReadInputTokens?: number
        cacheCreationInputTokens?: number
    }
}

export type AuthMode =
    | 'none'
    | 'menu'
    | 'help'
    | 'subscription_select'
    | 'subscription_provider'
    | 'context_select'
    | 'byok_provider'
    | 'byok_key'
    | 'model_select'
    | 'switch_select'
    | 'session_select'
    | 'plan_approve'
    | 'ask_question'
    | 'tool_permission'
    | 'settings_main'
    | 'tasks_mode'
    | 'usage'
    | 'diff_view'
    | 'rewind_select'
    | 'reasoning_select'
    | 'code_search'
    | 'file_view'
    | 'skills'
    | 'skills_menu'
    | 'memory_view'
    | 'memory'

export interface CodeSearchResultItem {
    file: string
    line: number
    content: string
}

export interface CodeSearchGroupItem {
    file: string
    matchCount: number
    firstLine: number
    firstSnippet: string
    lineNumbers: number[]
    matches: CodeSearchResultItem[]
}

export type PlanWorkflowState =
    | { phase: 'idle' }
    | {
          phase: 'reviewing'
          prompt: string
          planText: string
          qaPairs: { question: string; answer: string }[]
      }
    | { phase: 'refining'; prompt: string; previousPlan: string; feedback: string }
    | { phase: 'executing'; prompt: string; planText: string; currentStepIndex?: number }

export type PlanWorkflowPhase = PlanWorkflowState['phase']

export interface BtwState {
    question: string
    answer: string
    status: 'loading' | 'streaming' | 'complete' | 'error'
    error?: string
    isExpanded?: boolean
}
