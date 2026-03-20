export interface Message {
    id: string
    role: 'user' | 'assistant' | 'system'
    content: string
    type?: 'text' | 'code_preview'
    code?: string
    status?: 'thinking' | 'planning' | 'done' | 'error'
}

export interface SelectedElement {
    tagName: string
    textContent: string
}

export interface ChatMessageProps {
    role: 'user' | 'assistant'
    content: string
    isGenerating: boolean
    executionTime: number
    index: number
    status?: 'thinking' | 'planning' | 'done' | 'error'
}

export interface ChatPromptInputProps {
    value: string
    onChange: (value: string) => void
    onSubmit: () => void
    isVisualMode: boolean
    onToggleVisualMode: () => void
    selectedElement: SelectedElement | null
    onClearSelection: () => void
    isApplyingEdit: boolean
}

export interface ChatSidebarProps {
    messages: Message[]
    onPromptSubmit: (prompt: string) => void
    onBack: () => void
    isGenerating: boolean
    steps: string[]
    executionTime: number
    isThoughtsOpen: boolean
    setIsThoughtsOpen: (value: boolean) => void
    editPrompt: string
    setEditPrompt: (value: string) => void
    handleApplyEdit: () => void
    isVisualMode: boolean
    setIsVisualMode: (value: boolean) => void
    selectedElement: SelectedElement | null
    handleClearSelection: () => void
    isApplyingEdit: boolean
    isCollapsed: boolean
    onClose?: () => void
    mode?: 'sidebar' | 'mobile'
}

export interface ThoughtProcessProps {
    isGenerating: boolean
    steps: string[]
    executionTime: number
    isOpen: boolean
    setIsOpen: (isOpen: boolean) => void
}
