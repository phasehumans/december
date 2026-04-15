import React from 'react'

import { AuthModalGoogleIcon } from './AuthModalGoogleIcon'
import { Icons } from '@/shared/components/ui/Icons'

import { Logo } from '@/shared/components/Logo'
import { Button } from '@/shared/components/ui/Button'
import { Input } from '@/shared/components/ui/Input'
import type { AuthModalAuthStepProps } from '@/features/auth/types'

export const AuthModalAuthStep: React.FC<AuthModalAuthStepProps> = ({
    authMode,
    email,
    password,
    errorMessage,
    isAuthPending,
    isGooglePending,
    onEmailChange,
    onPasswordChange,
    onGoogleLogin,
    onSubmit,
    onToggleAuthMode,
}) => {
    const isFormFilled = email.trim().length > 0 && password.length > 0

    return (
        <div className="flex flex-col">
            <div className="flex flex-col items-center mb-[22px]">
                <div className="mb-[18px] opacity-90 hover:opacity-100 transition-opacity text-[#D6D5D4]">
                    <Icons.CanvasIcon className="w-[32px] h-[32px]" />
                </div>
                <h2 className="text-[20px] font-medium text-[#f5f5f5] text-center tracking-tight mb-1.5">
                    Sign in or create an account
                </h2>
            </div>

            <div className="flex flex-col mb-[18px]">
                <button
                    type="button"
                    onClick={onGoogleLogin}
                    disabled={isAuthPending}
                    className="w-full bg-[#E5E5E5] hover:bg-white text-black font-medium h-[44px] rounded-[10px] flex items-center justify-center gap-2.5 transition-colors disabled:opacity-50"
                >
                    <AuthModalGoogleIcon />
                    <span className="text-[15px]">Continue with Google</span>
                </button>
            </div>

            <div className="w-full border-t border-[#333333] mb-[18px]"></div>

            <form onSubmit={onSubmit} className="flex flex-col gap-2.5">
                <input
                    type="email"
                    required
                    placeholder="Enter your email"
                    value={email}
                    onChange={(event) => onEmailChange(event.target.value)}
                    disabled={isAuthPending}
                    className="w-full bg-[#1A1A1A] border border-[#333333] focus:border-[#555] rounded-[10px] h-[44px] px-3.5 text-[15px] text-white placeholder-[#737373] focus:outline-none transition-colors"
                />

                <input
                    type="password"
                    required
                    placeholder="Password"
                    value={password}
                    onChange={(event) => onPasswordChange(event.target.value)}
                    disabled={isAuthPending}
                    className="w-full bg-[#1A1A1A] border border-[#333333] focus:border-[#555] rounded-[10px] h-[44px] px-3.5 text-[15px] text-white placeholder-[#737373] focus:outline-none transition-colors"
                />

                {errorMessage && <p className="text-[13px] text-red-500 px-1">{errorMessage}</p>}

                <button
                    type="submit"
                    disabled={isAuthPending}
                    className={`w-full font-medium h-[44px] rounded-[10px] flex items-center justify-center transition-colors disabled:opacity-50 mt-1 mt-1.5 ${
                        isFormFilled
                            ? 'bg-[#E5E5E5] hover:bg-white text-[#111111]'
                            : 'bg-[#2A2A2A] hover:bg-[#333333] text-[#E5E5E5]'
                    }`}
                >
                    {isAuthPending
                        ? 'Please wait...'
                        : authMode === 'login'
                          ? 'Continue with email'
                          : 'Sign up with email'}
                </button>
            </form>

            <div className="mt-[22px] flex justify-center">
                <button
                    type="button"
                    onClick={onToggleAuthMode}
                    className="text-[13px] text-[#A3A3A3] hover:text-white transition-colors underline decoration-transparent hover:decoration-white/50 underline-offset-2"
                >
                    {authMode === 'login'
                        ? "Don't have an account? Sign up"
                        : 'Already have an account? Log in'}
                </button>
            </div>
        </div>
    )
}
