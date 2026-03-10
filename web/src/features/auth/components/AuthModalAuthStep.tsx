import React from 'react'
import { Logo } from '@/shared/components/Logo'
import { Button } from '@/shared/components/ui/Button'
import { Input } from '@/shared/components/ui/Input'
import type { AuthModalAuthStepProps } from '@/features/auth/types'
import { AuthModalGoogleIcon } from './AuthModalGoogleIcon'

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
    return (
        <>
            <div className="flex flex-col items-center mb-6">
                <div className="mb-4 scale-90 opacity-90 hover:opacity-100 transition-opacity">
                    <Logo />
                </div>
                <h2 className="text-lg font-medium text-white text-center tracking-tight">
                    {authMode === 'login' ? 'Welcome back' : 'Create an account'}
                </h2>
            </div>

            <div className="flex flex-col gap-3 mb-6">
                <Button
                    variant="secondary"
                    onClick={onGoogleLogin}
                    className="w-full bg-[#E5E5E5] hover:bg-white text-black border-transparent"
                    leftIcon={<AuthModalGoogleIcon />}
                    isLoading={isGooglePending}
                    disabled={isAuthPending}
                >
                    Continue with Google
                </Button>
            </div>

            <div className="relative flex items-center justify-center mb-6">
                <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-white/5"></div>
                </div>
                <div className="relative bg-[#171615] px-3 text-[10px] uppercase tracking-widest text-neutral-500 font-medium">
                    Or
                </div>
            </div>

            <form onSubmit={onSubmit} className="space-y-3">
                <Input
                    label="Email address"
                    type="email"
                    required
                    placeholder="name@example.com"
                    value={email}
                    onChange={(event) => onEmailChange(event.target.value)}
                    disabled={isAuthPending}
                />
                <Input
                    label="Password"
                    type="password"
                    required
                    placeholder="********"
                    value={password}
                    onChange={(event) => onPasswordChange(event.target.value)}
                    disabled={isAuthPending}
                />

                {errorMessage && <p className="text-xs text-red-400 pt-1">{errorMessage}</p>}

                <Button type="submit" className="w-full mt-2" isLoading={isAuthPending}>
                    <span>{authMode === 'login' ? 'Sign In' : 'Sign Up'}</span>
                </Button>
            </form>

            <div className="mt-6 text-center">
                <p className="text-xs text-neutral-500 font-medium">
                    {authMode === 'login' ? "Don't have an account? " : 'Already have an account? '}
                    <button
                        onClick={onToggleAuthMode}
                        className="text-white hover:text-neutral-300 transition-colors font-medium ml-1 underline decoration-transparent hover:decoration-white/50 underline-offset-2"
                    >
                        {authMode === 'login' ? 'Sign up' : 'Log in'}
                    </button>
                </p>
            </div>
        </>
    )
}
