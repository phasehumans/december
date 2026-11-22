import { motion, AnimatePresence } from 'framer-motion'
import { X } from 'lucide-react'
import React from 'react'

import { useAuthModalController } from '../hooks/useAuthModalController'

import { AuthModalAuthStep } from './AuthModalAuthStep'
import { AuthModalOtpStep } from './AuthModalOtpStep'

import type { AuthMode, AuthModalProps } from '@/features/auth/types'

// Most visitors are new, so the modal opens on sign up.
const DEFAULT_MODE: AuthMode = 'signup'

export const AuthModal: React.FC<AuthModalProps> = ({
    isOpen,
    onClose,
    initialMode = DEFAULT_MODE,
    onAuthSuccess,
}) => {
    const {
        authMode,
        step,
        email,
        setEmail,
        otp,
        errorMessage,
        googleLogin,
        githubLogin,
        isAuthPending,
        isGooglePending,
        isGithubPending,
        isOtpPending,
        isResendPending,
        handleAuthSubmit,
        handleResendCode,
        handleOtpChange,
        handleOtpKeyDown,
        handleOtpPaste,
        handleOtpSubmit,
        handleToggleAuthMode,
        handleBackToAuth,
        setOtpInputRef,
    } = useAuthModalController({
        isOpen,
        initialMode,
        onAuthSuccess,
        onClose,
    })

    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    initial={{ opacity: 1 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="fixed inset-0 z-[100] bg-[#141414] flex flex-col items-center justify-center font-sans overflow-y-auto"
                >
                    <button
                        type="button"
                        onClick={onClose}
                        className="flex items-center justify-center absolute top-5 right-5 text-[#888888] hover:text-[#EDEDED] p-2 rounded-lg hover:bg-white/5 transition-colors z-50 outline-none cursor-pointer"
                        aria-label="Close"
                        title="Close"
                    >
                        <X size={16} strokeWidth={1.75} />
                    </button>
                    <div className="w-full flex items-center justify-center p-6 md:p-10 lg:p-12 relative bg-[#141414]">
                        <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.25, ease: 'easeOut' }}
                            className="w-full max-w-[340px] relative z-10"
                        >
                            {step === 'auth' ? (
                                <AuthModalAuthStep
                                    authMode={authMode}
                                    email={email}
                                    errorMessage={errorMessage}
                                    isAuthPending={isAuthPending}
                                    isGooglePending={isGooglePending}
                                    isGithubPending={isGithubPending}
                                    onEmailChange={setEmail}
                                    onGoogleLogin={googleLogin}
                                    onGithubLogin={githubLogin}
                                    onSubmit={handleAuthSubmit}
                                    onToggleAuthMode={handleToggleAuthMode}
                                />
                            ) : (
                                <AuthModalOtpStep
                                    email={email}
                                    otp={otp}
                                    errorMessage={errorMessage}
                                    isPending={isOtpPending}
                                    isResendPending={isResendPending}
                                    onChangeOtp={handleOtpChange}
                                    onKeyDown={handleOtpKeyDown}
                                    onPaste={handleOtpPaste}
                                    onSubmit={handleOtpSubmit}
                                    onResend={handleResendCode}
                                    onBack={handleBackToAuth}
                                    setOtpInputRef={setOtpInputRef}
                                />
                            )}
                        </motion.div>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    )
}
