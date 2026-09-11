export type Message = {
    id: number | string
    role: 'user' | 'assistant' | 'error' | 'header'
    text?: string
    cause?: string
    hint?: string
    displayText?: string
    blocks?: any[]
    usage?: { promptTokens: number; completionTokens: number }
}

export type AuthMode =
    | 'none'
    | 'menu'
    | 'subscription_select'
    | 'subscription_provider'
    | 'context_select'
    | 'byok_provider'
    | 'byok_key'
    | 'model_select'
    | 'logout_select'
    | 'switch_select'
    | 'session_select'
    | 'plan_approve'
    | 'grill_question'
    | 'ask_question'
    | 'tool_permission'
    | 'settings_main'
    | 'tasks_mode'
    | 'usage'
    | 'ollama_setup'
    | 'mcp_manager'

export interface GrillQuestion {
    question: string
    options: string[]
    docSource?: string
}

export type PlanWorkflowState =
    | { phase: 'idle' }
    | {
          phase: 'grilling'
          prompt: string
          questions: GrillQuestion[]
          currentIndex: number
          answers: string[]
      }
    | {
          phase: 'reviewing'
          prompt: string
          planText: string
          qaPairs: { question: string; answer: string }[]
      }
    | { phase: 'refining'; prompt: string; previousPlan: string; feedback: string }
    | { phase: 'executing'; prompt: string; planText: string; currentStepIndex?: number }

export type PlanWorkflowPhase = PlanWorkflowState['phase']
