import type { ReactNode } from 'react'

export interface PromptSuggestion {
    icon: ReactNode
    label: string
    prompt: string
}

export interface ModelOption {
    id: string
    name: string
    provider: string
    badge?: string
}

export const DEFAULT_MODEL_OPTIONS: ModelOption[] = [
    { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro', provider: 'gemini', badge: 'Default' },
    { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', provider: 'gemini', badge: 'Fast' },
    { id: 'claude-3-7-sonnet-latest', name: 'Claude 3.7 Sonnet', provider: 'anthropic' },
    { id: 'gpt-4o', name: 'GPT-4o', provider: 'openai' },
    { id: 'deepseek/deepseek-r1', name: 'DeepSeek R1', provider: 'openrouter' },
]

export interface PromptInputSubmitOptions {
    repoUrl?: string
    branch?: string
    gitRef?: string
    issueNumber?: number
    model?: string
    provider?: string
}

export interface HomeHeroProps {
    onPromptSubmit: (prompt: string, options?: PromptInputSubmitOptions) => void
    onOpenAuth: () => void
    onOpenProject?: (projectId: string) => void
    onResetImportState?: () => void
}

export interface PromptInputProps {
    onSubmit: (prompt: string, options?: PromptInputSubmitOptions) => void
    isLoading: boolean
    placeholder?: string
    minimized?: boolean
    onUpload?: () => void
    value?: string
    onChange?: (value: string) => void
    isAuthenticated?: boolean
    onOpenAuth?: () => void
    isThinkingMode?: boolean
    onToggleThinking?: (enabled: boolean) => void
    selectedModel?: string
    selectedProvider?: string
    onModelChange?: (model: string, provider?: string) => void
}

export interface SuggestionButtonProps {
    label: string
    onClick: () => void
}

export interface SuggestionsListProps {
    onSuggestionClick: (prompt: string) => void
    isAuthenticated: boolean
    onOpenAuth: () => void
}

export interface UseTypewriterProps {
    minimized: boolean
    placeholder?: string
}
