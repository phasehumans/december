import React from 'react'
import { Eye, EyeOff } from 'lucide-react'

import { AuthModalGoogleIcon } from './AuthModalGoogleIcon'

import type { AuthModalAuthStepProps } from '@/features/auth/types'

import { Icons } from '@/shared/components/ui/Icons'

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
    onForgotPassword,
}) => {
    const [showPassword, setShowPassword] = React.useState(false)
    const isFormFilled = email.trim().length > 0 && password.length > 0

    return (
        <div className="flex flex-col">
            <div className="flex flex-col items-center mb-7">
                <div className="mb-5 opacity-95 hover:opacity-100 transition-opacity text-white">
                    <Icons.DecemberLogo className="w-[44px] h-[44px]" />
                </div>
                <h2 className="text-[24px] font-semibold text-white text-center tracking-tight mb-2">
                    {authMode === 'login' ? 'Sign in to continue building' : 'Create an account'}
                </h2>
                <p className="text-[15px] text-[#A3A3A3] text-center max-w-[280px] mx-auto">
                    Turn an idea into a working website
                </p>
            </div>

            <div className="flex flex-col mb-2">
                <button
                    type="button"
                    onClick={onGoogleLogin}
                    disabled={isAuthPending}
                    className="w-full bg-[#EDEDED] hover:bg-white text-[#111111] font-medium h-[46px] rounded-[12px] flex items-center justify-center gap-3 transition-all duration-200 active:scale-[0.98] shadow-sm disabled:opacity-50"
                >
                    <AuthModalGoogleIcon />
                    <span className="text-[15px]">Continue with Google</span>
                </button>
            </div>

            <div className="flex items-center my-6">
                <div className="flex-1 border-t border-[#2A2A2A]"></div>
                <span className="px-4 text-[13px] text-[#737373] font-medium uppercase tracking-wider">
                    or continue with email
                </span>
                <div className="flex-1 border-t border-[#2A2A2A]"></div>
            </div>

            <form onSubmit={onSubmit} className="flex flex-col gap-3.5">
                <input
                    type="email"
                    required
                    placeholder="Enter your email"
                    value={email}
                    onChange={(event) => onEmailChange(event.target.value)}
                    disabled={isAuthPending}
                    className="w-full bg-[#141414] border border-[#2A2A2A] hover:border-[#3A3A3A] focus:border-[#5A4A3A] focus:shadow-[0_0_12px_rgba(90,74,58,0.15)] focus:bg-[#1A1A1A] rounded-[12px] h-[46px] px-4 text-[15px] text-white placeholder-[#666666] focus:outline-none transition-all duration-200"
                />

                <div className="relative w-full">
                    <input
                        type={showPassword ? 'text' : 'password'}
                        required
                        placeholder="Password"
                        value={password}
                        onChange={(event) => onPasswordChange(event.target.value)}
                        disabled={isAuthPending}
                        className="w-full bg-[#141414] border border-[#2A2A2A] hover:border-[#3A3A3A] focus:border-[#5A4A3A] focus:shadow-[0_0_12px_rgba(90,74,58,0.15)] focus:bg-[#1A1A1A] rounded-[12px] h-[46px] pl-4 pr-11 text-[15px] text-white placeholder-[#666666] focus:outline-none transition-all duration-200"
                    />
                    <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#666666] hover:text-[#EDEDED] transition-colors p-1 rounded-md hover:bg-white/5"
                        tabIndex={-1}
                    >
                        {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                </div>

                {authMode === 'login' && (
                    <button
                        type="button"
                        onClick={onForgotPassword}
                        disabled={isAuthPending}
                        className="self-end text-[13px] text-[#A3A3A3] hover:text-white transition-colors underline decoration-transparent hover:decoration-white/50 underline-offset-2"
                    >
                        Forgot password?
                    </button>
                )}

                {errorMessage && <p className="text-[13px] text-red-500 px-1">{errorMessage}</p>}

                <button
                    type="submit"
                    disabled={isAuthPending}
                    className={`w-full font-medium h-[46px] rounded-[12px] flex items-center justify-center transition-all duration-200 active:scale-[0.98] disabled:opacity-50 mt-1 shadow-sm ${
                        isFormFilled
                            ? 'bg-[#EDEDED] hover:bg-white text-[#111111]'
                            : 'bg-[#222222] hover:bg-[#2A2A2A] text-[#888888]'
                    }`}
                >
                    {isAuthPending
                        ? 'Please wait...'
                        : authMode === 'login'
                          ? 'Continue with email'
                          : 'Sign up with email'}
                </button>
            </form>

            <div className="mt-8 flex justify-center">
                <button
                    type="button"
                    onClick={onToggleAuthMode}
                    className="text-[14px] text-[#888888] hover:text-white transition-colors"
                >
                    {authMode === 'login' ? (
                        <span>
                            Don't have an account?{' '}
                            <span className="text-[#EDEDED] underline underline-offset-4 hover:text-white font-medium">
                                Sign up
                            </span>
                        </span>
                    ) : (
                        <span>
                            Already have an account?{' '}
                            <span className="text-[#EDEDED] underline underline-offset-4 hover:text-white font-medium">
                                Log in
                            </span>
                        </span>
                    )}
                </button>
            </div>
        </div>
    )
}
