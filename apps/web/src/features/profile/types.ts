export interface Profile {
    id: string
    name: string
    email: string
    createdAt: string
    updatedAt: string
    emailVerified: boolean
    githubConnected: boolean
    githubUsername?: string
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
