import type { ClipboardEvent, FormEvent, KeyboardEvent } from 'react'

export type AuthMode = 'login' | 'signup'
export type AuthStep =
    | 'auth'
    | 'otp'
    | 'forgot-email'
    | 'forgot-otp'
    | 'forgot-reset'
    | 'google-merge'

export interface AuthModalProps {
    isOpen: boolean
    onClose: () => void
    initialMode?: AuthMode
    onAuthSuccess: () => void
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

export interface ForgotPasswordRequestInput {
    email: string
}

export interface ForgotPasswordVerifyInput {
    email: string
    otp: string
}

export interface ForgotPasswordResetInput extends ForgotPasswordVerifyInput {
    newPassword: string
}

export interface AuthModalAuthStepProps {
    authMode: AuthMode
    email: string
    password: string
    errorMessage: string | null
    isAuthPending: boolean
    isGooglePending: boolean
    isGithubPending: boolean
    onEmailChange: (value: string) => void
    onPasswordChange: (value: string) => void
    onGoogleLogin: () => void
    onGithubLogin: () => void
    onSubmit: (event: FormEvent) => void
    onToggleAuthMode: () => void
    onForgotPassword: () => void
    onClose: () => void
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

export interface AuthModalForgotEmailStepProps {
    email: string
    errorMessage: string | null
    isPending: boolean
    onEmailChange: (value: string) => void
    onSubmit: (event: FormEvent) => void
    onBack: () => void
}

export interface AuthModalForgotOtpStepProps {
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

export interface AuthModalForgotResetStepProps {
    newPassword: string
    confirmPassword: string
    errorMessage: string | null
    isPending: boolean
    onNewPasswordChange: (value: string) => void
    onConfirmPasswordChange: (value: string) => void
    onSubmit: (event: FormEvent) => void
    onBack: () => void
}
