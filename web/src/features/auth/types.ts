import type { ClipboardEvent, FormEvent, KeyboardEvent } from 'react'

export type AuthMode = 'login' | 'signup'
export type AuthStep = 'auth' | 'otp'

export interface AuthModalProps {
    isOpen: boolean
    onClose: () => void
    initialMode?: AuthMode
    onAuthSuccess: (token: string) => void
}

export interface SignupInput {
    email: string
    password: string
}

export interface LoginInput {
    email: string
    password: string
}

export interface VerifyOtpInput {
    email: string
    otp: string
}

export interface GoogleInput {
    code: string
}

export interface AuthModalAuthStepProps {
    authMode: AuthMode
    email: string
    password: string
    errorMessage: string | null
    isAuthPending: boolean
    isGooglePending: boolean
    onEmailChange: (value: string) => void
    onPasswordChange: (value: string) => void
    onGoogleLogin: () => void
    onSubmit: (event: FormEvent) => void
    onToggleAuthMode: () => void
}

export interface AuthModalOtpStepProps {
    email: string
    otp: string[]
    errorMessage: string | null
    isPending: boolean
    onChangeOtp: (index: number, value: string) => void
    onKeyDown: (index: number, event: KeyboardEvent<HTMLInputElement>) => void
    onPaste: (event: ClipboardEvent) => void
    onSubmit: (event: FormEvent) => void
    onBack: () => void
    setOtpInputRef: (index: number, element: HTMLInputElement | null) => void
}
