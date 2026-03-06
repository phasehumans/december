import React from 'react'

export interface Message {
    id: string
    role: 'user' | 'assistant' | 'system'
    content: string
    type?: 'text' | 'code_preview'
    code?: string // If it's a generated website
    status?: 'thinking' | 'done' | 'error'
}

export interface PromptSuggestion {
    icon: React.ReactNode
    label: string
    prompt: string
}

export interface GeneratedCode {
    html: string
    css: string
    js: string
}

export interface CanvasItem {
    id: string
    type:
        | 'note'
        | 'image'
        | 'link'
        | 'frame'
        | 'square'
        | 'circle'
        | 'line'
        | 'arrow'
        | 'pen'
        | 'text'
    x: number
    y: number
    width?: number
    height?: number
    content?: string
    color?: string
    points?: { x: number; y: number }[]
    parentId?: string // ID of the container frame if this item is grouped
}

export interface CanvasConnection {
    id: string
    from: string // Item ID
    to: string // Item ID
    fromSide: 'left' | 'right'
    toSide: 'left' | 'right'
}

export interface Project {
    id: string
    title: string
    description: string
    updatedAt: string
    isStarred: boolean
}
