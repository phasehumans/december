import React from 'react'

import { useAuthMutations } from './useAuthMutations'

import type { AuthMode, AuthStep } from '@/features/auth/types'

interface UseAuthModalControllerArgs {
    isOpen: boolean
    initialMode: AuthMode
    onAuthSuccess: () => void
}

export const useAuthModalController = ({
    isOpen,
    initialMode,
    onAuthSuccess,
}: UseAuthModalControllerArgs) => {
    const [authMode, setAuthMode] = React.useState<AuthMode>(initialMode)
    const [step, setStep] = React.useState<AuthStep>('auth')
    const [email, setEmail] = React.useState('')
    const [password, setPassword] = React.useState('')
    const [otp, setOtp] = React.useState(['', '', '', '', '', ''])
    const [newPassword, setNewPassword] = React.useState('')
    const [confirmPassword, setConfirmPassword] = React.useState('')
    const [errorMessage, setErrorMessage] = React.useState<string | null>(null)
    const inputRefs = React.useRef<(HTMLInputElement | null)[]>([])

    React.useEffect(() => {
        if (isOpen) {
            setAuthMode(initialMode)
            setStep('auth')
            setEmail('')
            setPassword('')
            setNewPassword('')
            setConfirmPassword('')
            setErrorMessage(null)
            setOtp(['', '', '', '', '', ''])
        }
    }, [isOpen, initialMode])

    const {
        signupMutation,
        loginMutation,
        verifyOtpMutation,
        requestPasswordResetMutation,
        verifyPasswordResetOtpMutation,
        resetPasswordMutation,
        googleMutation,
        googleLogin,
        isAuthPending,
    } = useAuthMutations({
        onRequireOtp: () => setStep('otp'),
        onRequireForgotOtp: () => setStep('forgot-otp'),
        onRequireForgotReset: () => setStep('forgot-reset'),
        onPasswordResetSuccess: () => {
            setPassword('')
            setNewPassword('')
            setConfirmPassword('')
            setOtp(['', '', '', '', '', ''])
            setStep('auth')
            setAuthMode('login')
        },
        onAuthSuccess,
        setErrorMessage,
    })

    const handleAuthSubmit = (event: React.FormEvent) => {
        event.preventDefault()
        setErrorMessage(null)

        if (authMode === 'signup') {
            signupMutation.mutate({ email, password })
            return
        }

        loginMutation.mutate({ email, password })
    }

    const handleOtpChange = (index: number, value: string) => {
        if (isNaN(Number(value))) {
            return
        }

        const nextOtp = [...otp]
        nextOtp[index] = value.substring(value.length - 1)
        setOtp(nextOtp)

        if (value && index < 5) {
            inputRefs.current[index + 1]?.focus()
        }
    }

    const handleOtpKeyDown = (index: number, event: React.KeyboardEvent<HTMLInputElement>) => {
        if (event.key === 'Backspace' && !otp[index] && index > 0) {
            inputRefs.current[index - 1]?.focus()
        }
    }

    const handleOtpPaste = (event: React.ClipboardEvent) => {
        event.preventDefault()
        const pastedDigits = event.clipboardData.getData('text').slice(0, 6).split('')

        if (pastedDigits.every((char) => !isNaN(Number(char)))) {
            const nextOtp = [...otp]
            pastedDigits.forEach((char, index) => {
                if (index < 6) {
                    nextOtp[index] = char
                }
            })
            setOtp(nextOtp)
            inputRefs.current[Math.min(pastedDigits.length, 5)]?.focus()
        }
    }

    const handleOtpSubmit = (event: React.FormEvent) => {
        event.preventDefault()
        setErrorMessage(null)
        verifyOtpMutation.mutate({
            email,
            otp: otp.join(''),
        })
    }

    const handleForgotPasswordStart = () => {
        setErrorMessage(null)
        setPassword('')
        setOtp(['', '', '', '', '', ''])
        setStep('forgot-email')
    }

    const handleForgotEmailSubmit = (event: React.FormEvent) => {
        event.preventDefault()
        setErrorMessage(null)
        requestPasswordResetMutation.mutate({ email })
    }

    const handleForgotOtpSubmit = (event: React.FormEvent) => {
        event.preventDefault()
        setErrorMessage(null)
        verifyPasswordResetOtpMutation.mutate({
            email,
            otp: otp.join(''),
        })
    }

    const handleForgotResetSubmit = (event: React.FormEvent) => {
        event.preventDefault()

        if (!newPassword.trim()) {
            setErrorMessage('Please enter a new password')
            return
        }

        if (newPassword !== confirmPassword) {
            setErrorMessage('New password and confirm password do not match')
            return
        }

        setErrorMessage(null)
        resetPasswordMutation.mutate({
            email,
            otp: otp.join(''),
            newPassword,
        })
    }

    const handleToggleAuthMode = () => {
        setErrorMessage(null)
        setAuthMode((prevMode) => (prevMode === 'login' ? 'signup' : 'login'))
    }

    const handleBackToAuth = () => {
        setErrorMessage(null)
        setStep('auth')
    }

    const handleBackToForgotEmail = () => {
        setErrorMessage(null)
        setOtp(['', '', '', '', '', ''])
        setStep('forgot-email')
    }

    const handleBackToForgotOtp = () => {
        setErrorMessage(null)
        setStep('forgot-otp')
    }

    const setOtpInputRef = (index: number, element: HTMLInputElement | null) => {
        inputRefs.current[index] = element
    }

    return {
        authMode,
        step,
        email,
        setEmail,
        password,
        setPassword,
        newPassword,
        setNewPassword,
        confirmPassword,
        setConfirmPassword,
        otp,
        errorMessage,
        googleLogin,
        isAuthPending,
        isGooglePending: googleMutation.isPending,
        isOtpPending: verifyOtpMutation.isPending,
        isForgotEmailPending: requestPasswordResetMutation.isPending,
        isForgotOtpPending: verifyPasswordResetOtpMutation.isPending,
        isForgotResetPending: resetPasswordMutation.isPending,
        handleAuthSubmit,
        handleOtpChange,
        handleOtpKeyDown,
        handleOtpPaste,
        handleOtpSubmit,
        handleForgotPasswordStart,
        handleForgotEmailSubmit,
        handleForgotOtpSubmit,
        handleForgotResetSubmit,
        handleToggleAuthMode,
        handleBackToAuth,
        handleBackToForgotEmail,
        handleBackToForgotOtp,
        setOtpInputRef,
    }
}
