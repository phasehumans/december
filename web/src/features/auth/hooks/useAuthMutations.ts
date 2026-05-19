import { useGoogleLogin } from '@react-oauth/google'
import { useMutation } from '@tanstack/react-query'

import { authAPI } from '@/features/auth/api/auth'

type UseAuthMutationsOptions = {
    onRequireOtp: () => void
    onRequireForgotOtp: () => void
    onRequireForgotReset: () => void
    onPasswordResetSuccess: () => void
    onAuthSuccess: () => void
    setErrorMessage: (message: string | null) => void
}

const getErrorMessage = (error: unknown) => {
    // Check for ApiError with Zod validation details (fieldErrors object)
    if (
        error &&
        typeof error === 'object' &&
        'details' in error &&
        error.details &&
        typeof error.details === 'object'
    ) {
        const details = error.details as Record<string, string[]>
        const messages: string[] = []
        for (const field of Object.keys(details)) {
            const fieldErrors = details[field]
            if (Array.isArray(fieldErrors)) {
                messages.push(...fieldErrors)
            }
        }
        if (messages.length > 0) {
            return messages.join('. ')
        }
    }

    if (error instanceof Error) {
        if (error.message.toLowerCase() === 'validation failed') {
            return 'Something went wrong. Please try again.'
        }
        return error.message
    }

    return 'Something went wrong. Please try again.'
}

export const useAuthMutations = ({
    onRequireOtp,
    onRequireForgotOtp,
    onRequireForgotReset,
    onPasswordResetSuccess,
    onAuthSuccess,
    setErrorMessage,
}: UseAuthMutationsOptions) => {
    const signupMutation = useMutation({
        mutationFn: authAPI.signup,
        onSuccess: () => {
            setErrorMessage(null)
            onRequireOtp()
        },
        onError: (error) => {
            setErrorMessage(getErrorMessage(error))
        },
    })

    const loginMutation = useMutation({
        mutationFn: authAPI.login,
        onSuccess: () => {
            setErrorMessage(null)
            onAuthSuccess()
        },
        onError: (error) => {
            setErrorMessage(getErrorMessage(error))
        },
    })

    const verifyOtpMutation = useMutation({
        mutationFn: authAPI.verifyOtp,
        onSuccess: () => {
            setErrorMessage(null)
            onAuthSuccess()
        },
        onError: (error) => {
            setErrorMessage(getErrorMessage(error))
        },
    })

    const googleMutation = useMutation({
        mutationFn: authAPI.google,
        onSuccess: () => {
            setErrorMessage(null)
            onAuthSuccess()
        },
        onError: (error) => {
            setErrorMessage(getErrorMessage(error))
        },
    })

    const requestPasswordResetMutation = useMutation({
        mutationFn: authAPI.requestPasswordReset,
        onSuccess: () => {
            setErrorMessage(null)
            onRequireForgotOtp()
        },
        onError: (error) => {
            setErrorMessage(getErrorMessage(error))
        },
    })

    const verifyPasswordResetOtpMutation = useMutation({
        mutationFn: authAPI.verifyPasswordResetOtp,
        onSuccess: () => {
            setErrorMessage(null)
            onRequireForgotReset()
        },
        onError: (error) => {
            setErrorMessage(getErrorMessage(error))
        },
    })

    const resetPasswordMutation = useMutation({
        mutationFn: authAPI.resetPassword,
        onSuccess: () => {
            setErrorMessage(null)
            onPasswordResetSuccess()
        },
        onError: (error) => {
            setErrorMessage(getErrorMessage(error))
        },
    })

    const googleLogin = useGoogleLogin({
        flow: 'auth-code',
        onSuccess: (codeResponse) => {
            googleMutation.mutate({ code: codeResponse.code })
        },
        onError: () => {
            setErrorMessage('Google Login Failed')
        },
    })

    const isAuthPending =
        signupMutation.isPending || loginMutation.isPending || googleMutation.isPending

    return {
        signupMutation,
        loginMutation,
        verifyOtpMutation,
        requestPasswordResetMutation,
        verifyPasswordResetOtpMutation,
        resetPasswordMutation,
        googleMutation,
        googleLogin,
        isAuthPending,
    }
}
