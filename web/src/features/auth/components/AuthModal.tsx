import React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X } from 'lucide-react'
import { AuthModalAuthStep } from './AuthModalAuthStep'
import { AuthModalOtpStep } from './AuthModalOtpStep'
import { useAuthModalController } from '../hooks/useAuthModalController'
import type { AuthModalProps } from '@/features/auth/types'

export const AuthModal: React.FC<AuthModalProps> = ({
    isOpen,
    onClose,
    initialMode = 'login',
    onAuthSuccess,
}) => {
    const {
        authMode,
        step,
        email,
        setEmail,
        password,
        setPassword,
        otp,
        errorMessage,
        googleLogin,
        isAuthPending,
        isGooglePending,
        isOtpPending,
        handleAuthSubmit,
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
    })

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
                            <AuthModalAuthStep
                                authMode={authMode}
                                email={email}
                                password={password}
                                errorMessage={errorMessage}
                                isAuthPending={isAuthPending}
                                isGooglePending={isGooglePending}
                                onEmailChange={setEmail}
                                onPasswordChange={setPassword}
                                onGoogleLogin={googleLogin}
                                onSubmit={handleAuthSubmit}
                                onToggleAuthMode={handleToggleAuthMode}
                            />
                        ) : (
                            <AuthModalOtpStep
                                email={email}
                                otp={otp}
                                errorMessage={errorMessage}
                                isPending={isOtpPending}
                                onChangeOtp={handleOtpChange}
                                onKeyDown={handleOtpKeyDown}
                                onPaste={handleOtpPaste}
                                onSubmit={handleOtpSubmit}
                                onBack={handleBackToAuth}
                                setOtpInputRef={setOtpInputRef}
                            />
                        )}

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
