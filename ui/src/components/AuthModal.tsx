import React, { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import { X } from 'lucide-react'
import { Logo } from './Logo'
import { Button } from './ui/Button'
import { Input } from './ui/Input'
import { useGoogleLogin } from '@react-oauth/google'
import { authAPI } from '@/api/auth'

// Google Icon Component (Standard Colored)
const GoogleIcon = () => (
    <svg viewBox="0 0 24 24" width="18" height="18" xmlns="http://www.w3.org/2000/svg">
        <path
            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            fill="#4285F4"
        />
        <path
            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            fill="#34A853"
        />
        <path
            d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.26.81-.58z"
            fill="#FBBC05"
        />
        <path
            d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
            fill="#EA4335"
        />
    </svg>
)

interface AuthModalProps {
    isOpen: boolean
    onClose: () => void
    initialMode?: 'login' | 'signup'
    onAuthSuccess: (token: string) => void
}

const getErrorMessage = (error: unknown) => {
    if (error instanceof Error) {
        return error.message
    }

    return 'Something went wrong. Please try again.'
}

export const AuthModal: React.FC<AuthModalProps> = ({
    isOpen,
    onClose,
    initialMode = 'login',
    onAuthSuccess,
}) => {
    const [authMode, setAuthMode] = useState<'login' | 'signup'>(initialMode)
    const [step, setStep] = useState<'auth' | 'otp'>('auth')
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [otp, setOtp] = useState(['', '', '', '', '', ''])
    const [errorMessage, setErrorMessage] = useState<string | null>(null)
    const inputRefs = React.useRef<(HTMLInputElement | null)[]>([])

    React.useEffect(() => {
        if (isOpen) {
            setAuthMode(initialMode)
            setStep('auth')
            setEmail('')
            setPassword('')
            setErrorMessage(null)
            setOtp(['', '', '', '', '', ''])
        }
    }, [isOpen, initialMode])

    const signupMutation = useMutation({
        mutationFn: authAPI.signup,
        onSuccess: () => {
            setStep('otp')
            setErrorMessage(null)
        },
        onError: (error) => {
            setErrorMessage(getErrorMessage(error))
        },
    })

    const loginMutation = useMutation({
        mutationFn: authAPI.login,
        onSuccess: (token) => {
            setErrorMessage(null)
            onAuthSuccess(token)
        },
        onError: (error) => {
            setErrorMessage(getErrorMessage(error))
        },
    })

    const verifyOtpMutation = useMutation({
        mutationFn: authAPI.verifyOtp,
        onSuccess: (token) => {
            setErrorMessage(null)
            onAuthSuccess(token)
        },
        onError: (error) => {
            setErrorMessage(getErrorMessage(error))
        },
    })

    const googleMutation = useMutation({
        mutationFn: authAPI.google,
        onSuccess: (token) => {
            setErrorMessage(null)
            onAuthSuccess(token)
        },
        onError: (error) => {
            setErrorMessage(getErrorMessage(error))
        },
    })

    const handleAuthSubmit = (e: React.FormEvent) => {
        e.preventDefault()

        setErrorMessage(null)

        if (authMode === 'signup') {
            signupMutation.mutate({ email, password })
            return
        }

        loginMutation.mutate({ email, password })
    }

    const handleOtpChange = (index: number, value: string) => {
        if (isNaN(Number(value))) return

        const newOtp = [...otp]
        newOtp[index] = value.substring(value.length - 1)
        setOtp(newOtp)

        // Focus next
        if (value && index < 5) {
            inputRefs.current[index + 1]?.focus()
        }
    }

    const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Backspace' && !otp[index] && index > 0) {
            inputRefs.current[index - 1]?.focus()
        }
    }

    const handlePaste = (e: React.ClipboardEvent) => {
        e.preventDefault()
        const pastedData = e.clipboardData.getData('text').slice(0, 6).split('')
        if (pastedData.every((char) => !isNaN(Number(char)))) {
            const newOtp = [...otp]
            pastedData.forEach((char, index) => {
                if (index < 6) newOtp[index] = char
            })
            setOtp(newOtp)
            inputRefs.current[Math.min(pastedData.length, 5)]?.focus()
        }
    }

    const handleOtpSubmit = (e: React.FormEvent) => {
        e.preventDefault()

        setErrorMessage(null)
        verifyOtpMutation.mutate({
            email,
            otp: otp.join(''),
        })
    }

    const googleLogin = useGoogleLogin({
        flow: 'auth-code',
        onSuccess: async (codeResponse) => {
            googleMutation.mutate({ code: codeResponse.code })
        },
        onError: () => {
            setErrorMessage('Google Login Failed')
        },
    })

    const isAuthPending =
        signupMutation.isPending || loginMutation.isPending || googleMutation.isPending

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 font-roboto">
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-all duration-300"
                        onClick={onClose}
                    />
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 10 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 10 }}
                        transition={{ type: 'spring', duration: 0.5, bounce: 0.2 }}
                        className="relative w-full max-w-[360px] bg-[#171615] border border-white/10 rounded-xl p-6 shadow-2xl shadow-black/50"
                    >
                        {step === 'auth' ? (
                            <>
                                {/* Header */}
                                <div className="flex flex-col items-center mb-6">
                                    <div className="mb-4 scale-90 opacity-90 hover:opacity-100 transition-opacity">
                                        <Logo />
                                    </div>
                                    <h2 className="text-lg font-medium text-white text-center tracking-tight">
                                        {authMode === 'login'
                                            ? 'Welcome back'
                                            : 'Create an account'}
                                    </h2>
                                </div>

                                {/* Social Logins */}
                                <div className="flex flex-col gap-3 mb-6">
                                    <Button
                                        variant="secondary"
                                        onClick={() => googleLogin()}
                                        className="w-full bg-[#E5E5E5] hover:bg-white text-black border-transparent"
                                        leftIcon={<GoogleIcon />}
                                        isLoading={googleMutation.isPending}
                                        disabled={isAuthPending}
                                    >
                                        Continue with Google
                                    </Button>
                                </div>

                                {/* Divider */}
                                <div className="relative flex items-center justify-center mb-6">
                                    <div className="absolute inset-0 flex items-center">
                                        <div className="w-full border-t border-white/5"></div>
                                    </div>
                                    <div className="relative bg-[#171615] px-3 text-[10px] uppercase tracking-widest text-neutral-500 font-medium">
                                        Or
                                    </div>
                                </div>

                                {/* Form */}
                                <form onSubmit={handleAuthSubmit} className="space-y-3">
                                    <Input
                                        label="Email address"
                                        type="email"
                                        required
                                        placeholder="name@example.com"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        disabled={isAuthPending}
                                    />
                                    <Input
                                        label="Password"
                                        type="password"
                                        required
                                        placeholder="********"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        disabled={isAuthPending}
                                    />

                                    {errorMessage && (
                                        <p className="text-xs text-red-400 pt-1">{errorMessage}</p>
                                    )}

                                    <Button
                                        type="submit"
                                        className="w-full mt-2"
                                        isLoading={isAuthPending}
                                    >
                                        <span>{authMode === 'login' ? 'Sign In' : 'Sign Up'}</span>
                                    </Button>
                                </form>

                                {/* Footer */}
                                <div className="mt-6 text-center">
                                    <p className="text-xs text-neutral-500 font-medium">
                                        {authMode === 'login'
                                            ? "Don't have an account? "
                                            : 'Already have an account? '}
                                        <button
                                            onClick={() => {
                                                setErrorMessage(null)
                                                setAuthMode(
                                                    authMode === 'login' ? 'signup' : 'login'
                                                )
                                            }}
                                            className="text-white hover:text-neutral-300 transition-colors font-medium ml-1 underline decoration-transparent hover:decoration-white/50 underline-offset-2"
                                        >
                                            {authMode === 'login' ? 'Sign up' : 'Log in'}
                                        </button>
                                    </p>
                                </div>
                            </>
                        ) : (
                            <>
                                {/* OTP Header */}
                                <div className="flex flex-col items-center mb-6">
                                    <div className="mb-4 scale-90 opacity-90 hover:opacity-100 transition-opacity">
                                        <Logo />
                                    </div>
                                    <h2 className="text-lg font-medium text-white text-center tracking-tight">
                                        Verify your email
                                    </h2>
                                    <p className="text-xs text-neutral-400 text-center mt-2 max-w-[280px]">
                                        We sent a verification code to{' '}
                                        <span className="text-white font-medium">{email}</span>.
                                        Enter it below to create your account.
                                    </p>
                                </div>

                                {/* OTP Form */}
                                <form onSubmit={handleOtpSubmit} className="space-y-4">
                                    <div className="flex gap-2 justify-center mb-2">
                                        {otp.map((digit, index) => (
                                            <input
                                                key={index}
                                                ref={(el) => (inputRefs.current[index] = el)}
                                                type="text"
                                                maxLength={1}
                                                value={digit}
                                                onChange={(e) =>
                                                    handleOtpChange(index, e.target.value)
                                                }
                                                onKeyDown={(e) => handleKeyDown(index, e)}
                                                onPaste={index === 0 ? handlePaste : undefined}
                                                disabled={verifyOtpMutation.isPending}
                                                className="w-10 h-12 text-center text-xl font-medium bg-[#242322] border border-white/10 rounded-lg focus:border-white/30 focus:outline-none text-white transition-all caret-white"
                                            />
                                        ))}
                                    </div>

                                    {errorMessage && (
                                        <p className="text-xs text-red-400 text-center">
                                            {errorMessage}
                                        </p>
                                    )}

                                    <Button
                                        type="submit"
                                        className="w-full mt-2"
                                        disabled={otp.some((d) => !d)}
                                        isLoading={verifyOtpMutation.isPending}
                                    >
                                        <span>Verify & Create Account</span>
                                    </Button>

                                    <button
                                        type="button"
                                        onClick={() => {
                                            setErrorMessage(null)
                                            setStep('auth')
                                        }}
                                        className="w-full text-xs text-neutral-500 hover:text-neutral-300 transition-colors mt-4"
                                        disabled={verifyOtpMutation.isPending}
                                    >
                                        Back to Sign Up
                                    </button>
                                </form>
                            </>
                        )}

                        {/* Close Button */}
                        <button
                            onClick={onClose}
                            className="absolute top-3 right-3 text-neutral-600 hover:text-white transition-colors p-1.5 rounded-md hover:bg-white/5"
                        >
                            <X size={16} />
                        </button>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    )
}
