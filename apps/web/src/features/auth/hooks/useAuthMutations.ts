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
    onRequireGoogleMerge: () => void
}

const getErrorMessage = (error: unknown) => {
    // check for apierror with zod validation details (fielderrors object)
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
    onRequireGoogleMerge,
}: UseAuthMutationsOptions) => {
    const signupMutation = useMutation({
        mutationFn: authAPI.signup,
        onSuccess: () => {
            setErrorMessage(null)
            onRequireOtp()
        },
        onError: (error: any) => {
            if (
                error?.message === 'google_account_exists' ||
                error?.details === 'google_account_exists'
            ) {
                onRequireGoogleMerge()
            } else {
                setErrorMessage(getErrorMessage(error))
            }
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

    const githubMutation = useMutation({
        mutationFn: authAPI.github,
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

    const githubLogin = () => {
        const clientId =
            (typeof process !== 'undefined' ? process.env.GITHUB_CLIENT_ID : undefined) ||
            'Ov23liFGkTAwCW7E8gtk'
        const url = `https://github.com/login/oauth/authorize?client_id=${clientId}&state=auth&scope=user:email%20repo`

        const popup = window.open(url, 'github-login', 'width=500,height=600')

        const handleMessage = (event: MessageEvent) => {
            if (event.origin !== window.location.origin) return

            if (event.data.type === 'GITHUB_LOGIN_SUCCESS') {
                const { code } = event.data
                githubMutation.mutate({ code })
                popup?.close()
                window.removeEventListener('message', handleMessage)
            } else if (event.data.type === 'GITHUB_LOGIN_FAILED') {
                setErrorMessage('GitHub Login Failed')
                popup?.close()
                window.removeEventListener('message', handleMessage)
            }
        }

        window.addEventListener('message', handleMessage)
    }

    const isAuthPending =
        signupMutation.isPending ||
        loginMutation.isPending ||
        googleMutation.isPending ||
        githubMutation.isPending

    return {
        signupMutation,
        loginMutation,
        verifyOtpMutation,
        requestPasswordResetMutation,
        verifyPasswordResetOtpMutation,
        resetPasswordMutation,
        googleMutation,
        googleLogin,
        githubMutation,
        githubLogin,
        isAuthPending,
    }
}
