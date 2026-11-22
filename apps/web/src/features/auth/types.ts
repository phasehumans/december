import type { ClipboardEvent, FormEvent, KeyboardEvent } from 'react'

export type AuthMode = 'login' | 'signup'
export type AuthStep = 'auth' | 'otp'

export interface AuthModalProps {
    isOpen: boolean
    onClose: () => void
    initialMode?: AuthMode
    onAuthSuccess: () => void
}

export interface AuthModalAuthStepProps {
    authMode: AuthMode
    email: string
    errorMessage: string | null
    isAuthPending: boolean
    isGooglePending: boolean
    isGithubPending: boolean
    onEmailChange: (value: string) => void
    onGoogleLogin: () => void
    onGithubLogin: () => void
    onSubmit: (event: FormEvent) => void
    onToggleAuthMode: () => void
}

export interface AuthModalOtpStepProps {
    email: string
    otp: string[]
    errorMessage: string | null
    isPending: boolean
    isResendPending: boolean
    onChangeOtp: (index: number, value: string) => void
    onKeyDown: (index: number, event: KeyboardEvent<HTMLInputElement>) => void
    onPaste: (event: ClipboardEvent) => void
    onSubmit: (event: FormEvent) => void
    onResend: () => void
    onBack: () => void
    setOtpInputRef: (index: number, element: HTMLInputElement | null) => void
}
