import type { ReactNode } from 'react'

export interface PromptSuggestion {
    icon: ReactNode
    label: string
    prompt: string
}

export interface PromptInputSubmitOptions {
    repoUrl?: string
    branch?: string
    gitRef?: string
    issueNumber?: number
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
