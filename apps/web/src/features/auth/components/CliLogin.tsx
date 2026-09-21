import { useQuery } from '@tanstack/react-query'
import { Check, ChevronLeft } from 'lucide-react'
import React, { useState } from 'react'
import { useLocation } from 'react-router-dom'

import { AuthModal } from '@/features/auth/components/AuthModal'
import { profileAPI } from '@/features/profile/api/profile'
import { apiRequest } from '@/shared/api/client'
import { Icons } from '@/shared/components/ui/Icons'
import { getWebUrl } from '@/shared/config/env'

export const CliLogin: React.FC = () => {
    const location = useLocation()
    const searchParams = new URLSearchParams(location.search)
    const redirectUri = searchParams.get('redirect_uri')

    const [showAuthModal, setShowAuthModal] = useState(false)
    const [status, setStatus] = useState<'idle' | 'authorizing' | 'success' | 'error'>('idle')
    const [errorMessage, setErrorMessage] = useState('')

    // check if user is logged in
    const {
        data: profile,
        isLoading,
        refetch,
    } = useQuery({
        queryKey: ['profile'],
        queryFn: profileAPI.getProfile,
        retry: false,
    })

    const handleAuthorize = async () => {
        if (!redirectUri) {
            setStatus('error')
            setErrorMessage('Missing redirect URI from CLI')
            return
        }

        if (!profile) {
            setShowAuthModal(true)
            return
        }

        authorize()
    }

    const authorize = async () => {
        setStatus('authorizing')
        try {
            const { token, email } = await apiRequest<{ token: string; email?: string }>(
                '/auth/cli-token',
                {
                    method: 'GET',
                }
            )

            if (token) {
                setStatus('success')
                // redirect back to cli server
                let redirectUrl = `${redirectUri}?token=${token}`
                if (email) {
                    redirectUrl += `&email=${encodeURIComponent(email)}`
                }
                window.location.href = redirectUrl
            } else {
                setStatus('error')
                setErrorMessage('Failed to generate token')
            }
        } catch (err: any) {
            setStatus('error')
            setErrorMessage(err.message || 'Authorization failed')
        }
    }

    const handleAuthSuccess = async () => {
        setShowAuthModal(false)
        await refetch()
        authorize()
    }

    return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-[#141414] font-sans overflow-y-auto p-4 sm:p-6 relative selection:bg-[#87b2f4]/30 selection:text-white">
            <a
                href="/"
                className="absolute top-5 left-5 text-[#888888] hover:text-[#EDEDED] p-2 rounded-lg hover:bg-white/5 transition-colors z-50 flex items-center gap-1.5 font-sans text-xs"
            >
                <ChevronLeft size={16} strokeWidth={1.75} />
                <span>Home</span>
            </a>

            <div className="w-full flex items-center justify-center relative">
                <div className="w-full max-w-[380px] relative z-10 flex flex-col">
                    {status === 'success' ? (
                        <div className="flex flex-col items-center text-center py-2 animate-in fade-in duration-200">
                            <div className="w-12 h-12 rounded-full bg-[#10b981]/10 border border-[#10b981]/25 flex items-center justify-center text-[#10b981] mb-4">
                                <Check className="w-6 h-6" strokeWidth={2} />
                            </div>

                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium bg-[#10b981]/10 text-[#10b981] border border-[#10b981]/25 mb-3">
                                <span className="w-1.5 h-1.5 rounded-full bg-[#10b981]" />
                                Authorized
                            </span>

                            <h2 className="text-[22px] sm:text-[24px] font-medium text-white tracking-[-0.025em] leading-snug mb-2">
                                CLI Authorized Successfully
                            </h2>
                            <p className="text-xs sm:text-[13px] text-[#888888] font-sans leading-relaxed mb-6">
                                Your session token has been securely transferred to your terminal.
                                You can close this tab and resume coding.
                            </p>

                            <div className="w-full rounded-lg border border-[#2A2A2A] bg-[#181818] p-3.5 font-mono text-xs text-[#a09f9d] flex items-center justify-between mb-5">
                                <div className="flex items-center gap-2">
                                    <span className="text-[#87b2f4]">$</span>
                                    <span className="text-[#EDEDED]">december ready</span>
                                </div>
                                <span className="inline-flex items-center gap-1.5 text-[11px] text-[#10b981]">
                                    <span className="w-1.5 h-1.5 rounded-full bg-[#10b981]" />
                                    connected
                                </span>
                            </div>

                            <button
                                type="button"
                                onClick={() => window.close()}
                                className="w-full font-sans text-xs sm:text-[13px] font-medium h-10 rounded-lg flex items-center justify-center transition-all cursor-pointer bg-[#EDEDED] hover:bg-white text-[#090a0f] border border-transparent shadow-none"
                            >
                                Close Window
                            </button>

                            <a
                                href="/"
                                className="mt-3 font-sans text-xs text-[#888888] hover:text-[#EDEDED] transition-colors"
                            >
                                Return to Dashboard →
                            </a>
                        </div>
                    ) : (
                        <div className="flex flex-col">
                            <div className="flex flex-col items-center text-center mb-6">
                                <div className="mb-5 text-white">
                                    <Icons.DecemberLogo className="w-[42px] h-[42px] text-white" />
                                </div>
                                <h2 className="text-[22px] sm:text-[24px] font-medium text-white tracking-[-0.025em] leading-snug mb-1.5">
                                    Authorize December CLI
                                </h2>
                                <p className="text-xs sm:text-[13px] text-[#888888] font-sans leading-relaxed">
                                    Link your terminal development environment to your account.
                                </p>
                            </div>

                            {profile && (
                                <div className="mb-5 rounded-lg border border-[#2A2A2A] bg-[#181818] p-3 flex items-center justify-between">
                                    <div className="flex items-center gap-2.5 min-w-0 pr-2">
                                        <div className="w-7 h-7 rounded-full bg-[#262626] border border-[#333333] flex items-center justify-center text-white text-xs font-medium shrink-0">
                                            {(profile.name ||
                                                profile.email ||
                                                'U')[0].toUpperCase()}
                                        </div>
                                        <div className="flex flex-col min-w-0 text-left">
                                            <span className="text-white text-xs font-medium truncate">
                                                {profile.name || profile.email}
                                            </span>
                                            {profile.name && profile.email && (
                                                <span className="text-[#888888] text-[11px] truncate">
                                                    {profile.email}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium bg-[#10b981]/10 text-[#10b981] border border-[#10b981]/25 shrink-0">
                                        <span className="w-1.5 h-1.5 rounded-full bg-[#10b981]" />
                                        Active
                                    </span>
                                </div>
                            )}

                            <div className="flex flex-col gap-3">
                                {isLoading ? (
                                    <div className="w-full bg-[#141414] border border-[#2A2A2A] text-[#888888] font-sans text-xs sm:text-[13px] h-10 rounded-lg flex items-center justify-center animate-pulse">
                                        Checking session...
                                    </div>
                                ) : (
                                    <button
                                        type="button"
                                        onClick={handleAuthorize}
                                        disabled={status === 'authorizing'}
                                        className="w-full font-sans text-xs sm:text-[13px] font-medium h-10 rounded-lg flex items-center justify-center transition-all cursor-pointer disabled:opacity-50 shadow-none bg-[#EDEDED] hover:bg-white text-[#090a0f] border border-transparent"
                                    >
                                        {status === 'authorizing'
                                            ? 'Authorizing CLI...'
                                            : profile
                                              ? `Authorize as ${profile.name || profile.email} →`
                                              : 'Sign in to Authorize →'}
                                    </button>
                                )}

                                {profile && (
                                    <button
                                        type="button"
                                        onClick={() => setShowAuthModal(true)}
                                        className="text-center font-sans text-xs text-[#888888] hover:text-[#EDEDED] transition-colors cursor-pointer mt-0.5"
                                    >
                                        Want to use a different account?{' '}
                                        <span className="text-[#87b2f4] underline underline-offset-2">
                                            Switch account
                                        </span>
                                    </button>
                                )}

                                {status === 'error' && (
                                    <p className="mt-1 font-sans text-xs text-red-400 px-1 text-center">
                                        {errorMessage}
                                    </p>
                                )}
                            </div>

                            <p className="mt-6 text-[11px] font-sans text-[#737373] text-center leading-relaxed">
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
                    )}
                </div>
            </div>

            <AuthModal
                isOpen={showAuthModal}
                onClose={() => setShowAuthModal(false)}
                onAuthSuccess={handleAuthSuccess}
                initialMode="login"
            />
        </div>
    )
}
