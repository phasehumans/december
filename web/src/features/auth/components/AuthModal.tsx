import { motion, AnimatePresence } from 'framer-motion'
import { X } from 'lucide-react'
import React from 'react'

import { useAuthModalController } from '../hooks/useAuthModalController'

import { AuthModalAuthStep } from './AuthModalAuthStep'
import { AuthModalForgotEmailStep } from './AuthModalForgotEmailStep'
import { AuthModalForgotOtpStep } from './AuthModalForgotOtpStep'
import { AuthModalForgotResetStep } from './AuthModalForgotResetStep'
import { AuthModalGoogleMergeStep } from './AuthModalGoogleMergeStep'
import { AuthModalOtpStep } from './AuthModalOtpStep'

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
        newPassword,
        setNewPassword,
        confirmPassword,
        setConfirmPassword,
        otp,
        errorMessage,
        googleLogin,
        isAuthPending,
        isGooglePending,
        isOtpPending,
        isForgotEmailPending,
        isForgotOtpPending,
        isForgotResetPending,
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
        handleCreatePassword,
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
                        className="relative w-full max-w-[332px] bg-[#202020] border border-[#333333] rounded-[20px] p-8"
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
                                onForgotPassword={handleForgotPasswordStart}
                            />
                        ) : step === 'google-merge' ? (
                            <AuthModalGoogleMergeStep
                                email={email}
                                isPending={isForgotEmailPending}
                                onGoogleLogin={googleLogin}
                                onCreatePassword={handleCreatePassword}
                                onBack={handleBackToAuth}
                            />
                        ) : step === 'otp' ? (
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
                        ) : step === 'forgot-email' ? (
                            <AuthModalForgotEmailStep
                                email={email}
                                errorMessage={errorMessage}
                                isPending={isForgotEmailPending}
                                onEmailChange={setEmail}
                                onSubmit={handleForgotEmailSubmit}
                                onBack={handleBackToAuth}
                            />
                        ) : step === 'forgot-otp' ? (
                            <AuthModalForgotOtpStep
                                email={email}
                                otp={otp}
                                errorMessage={errorMessage}
                                isPending={isForgotOtpPending}
                                onChangeOtp={handleOtpChange}
                                onKeyDown={handleOtpKeyDown}
                                onPaste={handleOtpPaste}
                                onSubmit={handleForgotOtpSubmit}
                                onBack={handleBackToForgotEmail}
                                setOtpInputRef={setOtpInputRef}
                            />
                        ) : (
                            <AuthModalForgotResetStep
                                newPassword={newPassword}
                                confirmPassword={confirmPassword}
                                errorMessage={errorMessage}
                                isPending={isForgotResetPending}
                                onNewPasswordChange={setNewPassword}
                                onConfirmPasswordChange={setConfirmPassword}
                                onSubmit={handleForgotResetSubmit}
                                onBack={handleBackToForgotOtp}
                            />
                        )}

                        <button
                            onClick={onClose}
                            className="absolute top-4 right-4 text-[#737373] hover:text-[#E5E5E5] transition-colors p-1.5 rounded-md hover:bg-white/5"
                        >
                            <X size={18} />
                        </button>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    )
}
