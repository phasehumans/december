import { useGoogleLogin } from '@react-oauth/google'
import { useMutation } from '@tanstack/react-query'

import { authAPI } from '@/features/auth/api/auth'

type UseAuthMutationsOptions = {
    onRequireOtp: () => void
    onAuthSuccess: () => void
    setErrorMessage: (message: string | null) => void
}

const getErrorMessage = (error: unknown) => {
    if (error instanceof Error) {
        return error.message
    }

    return 'Something went wrong. Please try again.'
}

export const useAuthMutations = ({
    onRequireOtp,
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
        googleMutation,
        googleLogin,
        isAuthPending,
    }
}
