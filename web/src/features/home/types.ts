import type { ReactNode } from 'react'

import type { CanvasDocument } from '@/features/canvas/types'

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
    canvasState: CanvasDocument
    onCanvasStateChange: (document: CanvasDocument) => void
    projectId?: string | null
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
