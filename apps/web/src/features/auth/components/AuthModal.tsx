import { motion, AnimatePresence } from 'framer-motion'
import { X } from 'lucide-react'
import React from 'react'

import authPng from '../../../../public/auth.png'

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
                <motion.div
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 15 }}
                    transition={{ duration: 0.3, ease: 'easeOut' }}
                    className="fixed inset-0 z-[100] bg-[#171615] flex flex-col md:flex-row font-roboto overflow-y-auto"
                >
                    <div className="w-full md:w-[60%] flex items-center justify-center min-h-[300px] md:min-h-screen relative bg-[#171615] md:border-r border-[#232323] overflow-hidden">
                        <img
                            src={authPng}
                            alt="Authentication background"
                            className="w-full h-full object-cover absolute inset-0 opacity-95"
                        />
                    </div>

                    <div className="w-full md:w-[40%] flex items-center justify-center p-6 md:p-12 lg:p-16 relative bg-[#171615]">
                        <button
                            onClick={onClose}
                            className="absolute top-6 right-6 text-[#737373] hover:text-[#E5E5E5] transition-colors p-2 rounded-full hover:bg-white/10 z-20"
                        >
                            <X size={20} />
                        </button>
                        <div className="w-full max-w-[420px] relative z-10">
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
                        </div>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    )
}
