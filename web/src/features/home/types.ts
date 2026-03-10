import type { ReactNode } from 'react'

export interface PromptSuggestion {
    icon: ReactNode
    label: string
    prompt: string
}

export interface HomeHeroProps {
    onPromptSubmit: (prompt: string) => void
    isGenerating: boolean
    isAuthenticated: boolean
    onOpenAuth: () => void
}

export interface PromptInputProps {
    onSubmit: (prompt: string) => void
    isLoading: boolean
    placeholder?: string
    minimized?: boolean
    onUpload?: () => void
    value?: string
    onChange?: (value: string) => void
    isAuthenticated?: boolean
    onOpenAuth?: () => void
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
