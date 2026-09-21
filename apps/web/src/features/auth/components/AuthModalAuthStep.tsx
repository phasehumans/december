import { Eye, EyeOff } from 'lucide-react'
import React from 'react'

import { AuthModalGithubIcon } from './AuthModalGithubIcon'
import { AuthModalGoogleIcon } from './AuthModalGoogleIcon'

import type { AuthModalAuthStepProps } from '@/features/auth/types'

import { Icons } from '@/shared/components/ui/Icons'
import { getWebUrl } from '@/shared/config/env'

export const AuthModalAuthStep: React.FC<AuthModalAuthStepProps> = ({
    authMode,
    email,
    password,
    errorMessage,
    isAuthPending,
    isGooglePending,
    isGithubPending,
    onEmailChange,
    onPasswordChange,
    onGoogleLogin,
    onGithubLogin,
    onSubmit,
    onToggleAuthMode,
    onForgotPassword,
    onClose,
}) => {
    const [showPassword, setShowPassword] = React.useState(false)
    const isFormFilled = email.trim().length > 0 && password.length > 0

    return (
        <div className="flex flex-col">
            <div className="flex flex-col items-center text-center mb-6">
                <div className="mb-5 text-white">
                    <Icons.DecemberLogo className="w-[42px] h-[42px] text-white" />
                </div>
                <h2 className="text-[22px] sm:text-[24px] font-medium text-white tracking-[-0.025em] leading-snug">
                    {authMode === 'login' ? 'Sign in to continue building' : 'Create an account'}
                </h2>
            </div>

            {/* Social OAuth Buttons with clean sans styling */}
            <div className="flex flex-col gap-2.5 mb-1">
                <button
                    type="button"
                    onClick={onGithubLogin}
                    disabled={isAuthPending || isGithubPending}
                    className="w-full bg-[#1e1e1e] hover:bg-[#252525] text-white font-sans text-xs sm:text-[13px] font-medium h-10 border border-[#2A2A2A] hover:border-[#3A3A3A] rounded-lg flex items-center justify-center gap-2.5 transition-all cursor-pointer disabled:opacity-50"
                >
                    <div className="w-4 h-4 flex items-center justify-center shrink-0">
                        <AuthModalGithubIcon />
                    </div>
                    <span>Continue with GitHub</span>
                </button>

                <button
                    type="button"
                    onClick={onGoogleLogin}
                    disabled={isAuthPending || isGooglePending}
                    className="w-full bg-white hover:bg-[#EDEDED] text-[#090a0f] font-sans text-xs sm:text-[13px] font-medium h-10 rounded-lg flex items-center justify-center gap-2.5 transition-all cursor-pointer disabled:opacity-50"
                >
                    <div className="w-4 h-4 flex items-center justify-center shrink-0">
                        <AuthModalGoogleIcon />
                    </div>
                    <span>Continue with Google</span>
                </button>
            </div>

            {/* Minimal divider */}
            <div className="flex items-center my-4">
                <div className="flex-1 border-t border-[#262626]"></div>
                <span className="px-3 font-sans text-[11px] text-[#737373] uppercase tracking-wider">
                    or continue with email
                </span>
                <div className="flex-1 border-t border-[#262626]"></div>
            </div>

            {/* Form with clean inputs and buttons */}
            <form onSubmit={onSubmit} className="flex flex-col gap-3">
                <input
                    type="email"
                    required
                    placeholder="Enter your email"
                    value={email}
                    onChange={(event) => onEmailChange(event.target.value)}
                    disabled={isAuthPending}
                    className="w-full bg-[#141414] border border-[#2A2A2A] rounded-lg h-10 px-3.5 font-sans text-xs sm:text-[13px] text-white placeholder-[#666666] outline-none focus:border-[#87b2f4] transition-colors"
                />

                <div className="relative w-full">
                    <input
                        type={showPassword ? 'text' : 'password'}
                        required
                        placeholder="Password"
                        value={password}
                        onChange={(event) => onPasswordChange(event.target.value)}
                        disabled={isAuthPending}
                        className="w-full bg-[#141414] border border-[#2A2A2A] rounded-lg h-10 pl-3.5 pr-10 font-sans text-xs sm:text-[13px] text-white placeholder-[#666666] outline-none focus:border-[#87b2f4] transition-colors"
                    />
                    <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#737373] hover:text-[#EDEDED] transition-colors p-1 cursor-pointer"
                        tabIndex={-1}
                    >
                        {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                </div>

                {authMode === 'login' && (
                    <button
                        type="button"
                        onClick={onForgotPassword}
                        disabled={isAuthPending}
                        className="self-end font-sans text-xs text-[#888888] hover:text-[#87b2f4] transition-colors cursor-pointer pr-0.5"
                    >
                        Forgot password?
                    </button>
                )}

                {errorMessage && (
                    <p className="font-sans text-xs text-red-400 px-1 text-center">
                        {errorMessage}
                    </p>
                )}

                <button
                    type="submit"
                    disabled={isAuthPending}
                    className={`w-full font-sans text-xs sm:text-[13px] font-medium h-10 rounded-lg flex items-center justify-center transition-all cursor-pointer disabled:opacity-50 mt-1 border ${
                        isFormFilled
                            ? 'bg-[#EDEDED] hover:bg-white text-[#090a0f] border-transparent'
                            : 'bg-[#202020] hover:bg-[#252525] text-[#888888] border-[#2A2A2A]'
                    }`}
                >
                    {isAuthPending
                        ? 'Please wait...'
                        : authMode === 'login'
                          ? 'Continue with email →'
                          : 'Sign up with email →'}
                </button>
            </form>

            {/* Bottom mode switch */}
            <div className="mt-5 pt-4 border-t border-[#262626] text-center">
                <button
                    type="button"
                    onClick={onToggleAuthMode}
                    className="font-sans text-xs text-[#888888] hover:text-[#EDEDED] transition-colors cursor-pointer"
                >
                    {authMode === 'login' ? (
                        <span>
                            Don't have an account?{' '}
                            <span className="text-[#87b2f4] underline underline-offset-2">
                                Sign up
                            </span>
                        </span>
                    ) : (
                        <span>
                            Already have an account?{' '}
                            <span className="text-[#87b2f4] underline underline-offset-2">
                                Log in
                            </span>
                        </span>
                    )}
                </button>
            </div>

            <p className="mt-4 text-[11px] font-sans text-[#737373] text-center leading-relaxed">
                By continuing, you agree to our{' '}
                <a
                    href={`${getWebUrl()}/terms`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[#a3a3a3] hover:text-white underline underline-offset-2 transition-colors"
                >
                    Terms
                </a>{' '}
                and{' '}
                <a
                    href={`${getWebUrl()}/privacy`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[#a3a3a3] hover:text-white underline underline-offset-2 transition-colors"
                >
                    Privacy Policy
                </a>
                .
            </p>
        </div>
    )
}
