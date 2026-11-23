import React from 'react'

import { useAuthMutations } from './useAuthMutations'

import type { AuthMode, AuthStep } from '@/features/auth/types'

import { useBackToClose } from '@/shared/lib/useBackToClose'

interface UseAuthModalControllerArgs {
    isOpen: boolean
    initialMode: AuthMode
    onAuthSuccess: () => void
    onClose?: () => void
}

export const useAuthModalController = ({
    isOpen,
    initialMode,
    onAuthSuccess,
    onClose,
}: UseAuthModalControllerArgs) => {
    const [authMode, setAuthMode] = React.useState<AuthMode>(initialMode)
    const [step, setStep] = React.useState<AuthStep>('auth')
    const [email, setEmail] = React.useState('')
    const [otp, setOtp] = React.useState(['', '', '', '', '', ''])
    const [errorMessage, setErrorMessage] = React.useState<string | null>(null)
    const inputRefs = React.useRef<(HTMLInputElement | null)[]>([])
    // back button and back swipe close the modal instead of leaving the page
    const closeModal = React.useCallback(() => onClose?.(), [onClose])
    useBackToClose({ isOpen, onClose: closeModal })

    React.useEffect(() => {
        if (isOpen) {
            setAuthMode(initialMode)
            setStep('auth')
            setEmail('')
            setErrorMessage(null)
            setOtp(['', '', '', '', '', ''])
        }
    }, [isOpen, initialMode])

    const {
        emailStartMutation,
        emailVerifyMutation,
        googleMutation,
        googleLogin,
        githubMutation,
        githubLogin,
        isAuthPending,
    } = useAuthMutations({
        onCodeSent: () => {
            setOtp(['', '', '', '', '', ''])
            setStep('otp')
        },
        onAuthSuccess,
        setErrorMessage,
    })

    const handleAuthSubmit = (event: React.FormEvent) => {
        event.preventDefault()
        setErrorMessage(null)
        emailStartMutation.mutate({ email })
    }

    const handleResendCode = () => {
        setErrorMessage(null)
        emailStartMutation.mutate({ email })
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
        emailVerifyMutation.mutate({
            email,
            otp: otp.join(''),
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

    const setOtpInputRef = (index: number, element: HTMLInputElement | null) => {
        inputRefs.current[index] = element
    }

    return {
        authMode,
        step,
        email,
        setEmail,
        otp,
        errorMessage,
        googleLogin,
        githubLogin,
        isAuthPending,
        isGooglePending: googleMutation.isPending,
        isGithubPending: githubMutation.isPending,
        isOtpPending: emailVerifyMutation.isPending,
        isResendPending: emailStartMutation.isPending,
        handleAuthSubmit,
        handleResendCode,
        handleOtpChange,
        handleOtpKeyDown,
        handleOtpPaste,
        handleOtpSubmit,
        handleToggleAuthMode,
        handleBackToAuth,
        setOtpInputRef,
    }
}
