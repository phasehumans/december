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
}

export interface UpdateNameInput {
    name: string
}

export interface ChangePasswordInput {
    password: string
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
    onClose: () => void
    onChange: (value: string) => void
    onSave: () => void
}

export interface ProfilePasswordModalProps {
    isOpen: boolean
    isPending: boolean
    currentPassword: string
    newPassword: string
    confirmPassword: string
    showCurrentPass: boolean
    showNewPass: boolean
    onClose: () => void
    onUpdatePassword: () => void
    onCurrentPasswordChange: (value: string) => void
    onNewPasswordChange: (value: string) => void
    onConfirmPasswordChange: (value: string) => void
    onToggleShowCurrentPass: () => void
    onToggleShowNewPass: () => void
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
