import React from 'react'

import { AuthModalBrand } from './AuthModalBrand'
import { AuthModalGithubIcon } from './AuthModalGithubIcon'
import { AuthModalGoogleIcon } from './AuthModalGoogleIcon'
import { AuthModalOpenAIIcon } from './AuthModalOpenAIIcon'
import {
    authButtonClass,
    authInputClass,
    authPrimaryButtonClass,
    authTextLinkClass,
} from './authModalStyles'

import type { AuthModalAuthStepProps } from '@/features/auth/types'

import { getWebUrl } from '@/shared/config/env'

const CHATGPT_SOON_MS = 2500

const legalLinkClass = 'text-white hover:text-[#EDEDED] transition-colors'

export const AuthModalAuthStep: React.FC<AuthModalAuthStepProps> = ({
    authMode,
    email,
    errorMessage,
    isAuthPending,
    isGooglePending,
    isGithubPending,
    onEmailChange,
    onGoogleLogin,
    onGithubLogin,
    onSubmit,
    onToggleAuthMode,
}) => {
    const [showChatgptSoon, setShowChatgptSoon] = React.useState(false)
    const isSignup = authMode === 'signup'

    // ChatGPT sign-in is not live yet: the button only shows a short "coming soon" note.
    React.useEffect(() => {
        if (!showChatgptSoon) return
        const timer = window.setTimeout(() => setShowChatgptSoon(false), CHATGPT_SOON_MS)
        return () => window.clearTimeout(timer)
    }, [showChatgptSoon])

    return (
        <div className="flex flex-col">
            <div className="flex flex-col items-center text-center mb-6">
                <AuthModalBrand />
                <p className="mt-3 font-sans text-xs sm:text-[13px] text-[#888888]">
                    {isSignup ? 'Already have an account?' : "Don't have an account?"}{' '}
                    <button type="button" onClick={onToggleAuthMode} className={authTextLinkClass}>
                        {isSignup ? 'Log in' : 'Sign up'}
                    </button>
                </p>
            </div>

            <div className="flex flex-col gap-2">
                <button
                    type="button"
                    onClick={onGithubLogin}
                    disabled={isAuthPending || isGithubPending}
                    className={authButtonClass}
                >
                    <div className="absolute left-3.5 w-4 h-4 flex items-center justify-center">
                        <AuthModalGithubIcon />
                    </div>
                    <span>Continue with GitHub</span>
                </button>

                <button
                    type="button"
                    onClick={() => setShowChatgptSoon(true)}
                    disabled={isAuthPending}
                    className={authButtonClass}
                >
                    <div className="absolute left-3.5 w-4 h-4 flex items-center justify-center">
                        <AuthModalOpenAIIcon />
                    </div>
                    <span aria-live="polite">
                        {showChatgptSoon
                            ? 'ChatGPT sign-in is coming soon'
                            : 'Continue with ChatGPT'}
                    </span>
                </button>

                <button
                    type="button"
                    onClick={onGoogleLogin}
                    disabled={isAuthPending || isGooglePending}
                    className={authButtonClass}
                >
                    <div className="absolute left-3.5 w-4 h-4 flex items-center justify-center">
                        <AuthModalGoogleIcon />
                    </div>
                    <span>Continue with Google</span>
                </button>
            </div>

            <div className="flex items-center my-4">
                <div className="flex-1 border-t border-[#262626]"></div>
                <span className="px-3 font-sans text-[11px] text-[#737373] uppercase tracking-wider">
                    or
                </span>
                <div className="flex-1 border-t border-[#262626]"></div>
            </div>

            <form onSubmit={onSubmit} className="flex flex-col gap-2.5">
                <input
                    id="auth-email"
                    aria-label="Email address"
                    type="email"
                    required
                    autoComplete="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(event) => onEmailChange(event.target.value)}
                    disabled={isAuthPending}
                    className={authInputClass}
                />

                {errorMessage && (
                    <p className="font-sans text-xs text-red-400 px-1 text-center">
                        {errorMessage}
                    </p>
                )}

                <button
                    type="submit"
                    disabled={isAuthPending || email.trim().length === 0}
                    className={`${authPrimaryButtonClass} mt-0.5`}
                >
                    {isAuthPending ? 'Please wait...' : isSignup ? 'Sign up' : 'Log in'}
                </button>
            </form>

            <p className="mt-5 text-[11px] font-sans text-[#737373] text-center leading-relaxed">
                By continuing, you agree to our{' '}
                <a
                    href={`${getWebUrl()}/terms`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={legalLinkClass}
                >
                    Terms
                </a>{' '}
                and{' '}
                <a
                    href={`${getWebUrl()}/privacy`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={legalLinkClass}
                >
                    Privacy Policy
                </a>
                .
            </p>
        </div>
    )
}
