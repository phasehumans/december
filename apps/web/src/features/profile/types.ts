import type { ReactNode } from 'react'

export interface Profile {
    id: string
    name: string
    email: string
    createdAt: string
    updatedAt: string
    emailVerified: boolean
    receiveNotification: boolean
    googleId: string | null
    githubConnected: boolean
    githubUsername?: string
    supportAccessUntil?: string | null
}

export interface UpdateNameInput {
    name: string
}

export interface UpdateNotificationInput {
    receiveNotification: boolean
}

export interface ProfileSettingsProps {
    onSignOut: () => void
    onBack?: () => void
}

export interface ProfileNameModalProps {
    isOpen: boolean
    value: string
    isPending: boolean
    title?: string
    label?: string
    errorMessage?: string | null
    onClose: () => void
    onChange: (value: string) => void
    onSave: () => void
}

export interface SettingsRowProps {
    label: string
    description?: string
    action: ReactNode
    className?: string
}

export interface SettingsSectionProps {
    title: string
    children: ReactNode
}
