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
    /** the model and provider of the user's own key. on December credits the server picks */
    model?: string
    provider?: string
    billingSource?: 'CREDITS' | 'OWN_KEY'
    /** session configuration sent with the prompt (#632) */
    runConfig?: PromptRunConfig
    /** the files of this prompt. the prompt box stored them before it sent the prompt (#634) */
    attachments?: UploadedAttachment[]
    /** the session the prompt box made to store the files of a first prompt */
    session?: { id: string }
}

/** a file the server stored for a prompt that is not sent yet */
export interface UploadedAttachment {
    id: string
    name: string
}

/**
 * Plan first and effort hold for this message and the next ones; open pull request is
 * read only when a session starts. On December credits the effort is also the tier.
 */
export interface PromptRunConfig {
    planFirst?: boolean
    effort?: 'fast' | 'deep'
    openPullRequest?: boolean
    /** skills picked with /name, for this message only */
    skills?: string[]
    /** plugins and MCP servers switched off in the + menu, for this session only */
    disabledPlugins?: string[]
    disabledMcps?: string[]
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
