import { useQuery } from '@tanstack/react-query'
import React, { useState } from 'react'
import { useLocation } from 'react-router-dom'

import { AuthModal } from '@/features/auth/components/AuthModal'
import { profileAPI } from '@/features/profile/api/profile'
import { apiRequest } from '@/shared/api/client'
import { Icons } from '@/shared/components/ui/Icons'

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
        <div className="flex flex-col items-center justify-center min-h-screen bg-[#141414] font-sans overflow-y-auto p-4 sm:p-6">
            <div className="w-full flex items-center justify-center relative">
                <div className="w-full max-w-[380px] relative z-10 flex flex-col">
                    {status === 'success' ? (
                        /* Clean success confirmation */
                        <div className="flex flex-col items-center text-center py-2 animate-in fade-in duration-200">
                            <div className="w-10 h-10 border border-[#10b981]/40 bg-[#10b981]/10 text-[#10b981] flex items-center justify-center font-mono text-lg mb-4">
                                ✓
                            </div>
                            <span className="font-mono text-[11px] text-[#10b981] bg-[#10b981]/10 border border-[#10b981]/30 px-2 py-0.5 mb-2">
                                STATUS: AUTHORIZED
                            </span>
                            <h2 className="text-xl sm:text-[22px] font-medium text-white tracking-[-0.025em] leading-snug mb-2">
                                CLI Authorized Successfully
                            </h2>
                            <p className="text-xs sm:text-[13px] text-[#A1A1A6] leading-relaxed mb-6">
                                Your session token has been securely transferred to your terminal.
                                You can close this tab and resume coding.
                            </p>
                            <div className="w-full border border-[#262626] bg-[#141414] p-3 text-left font-mono text-xs text-[#a09f9d] flex items-center justify-between">
                                <span className="text-[#87b2f4]">$ december ready</span>
                                <span className="text-[#10b981]">connected</span>
                            </div>
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
                                <p className="text-[13px] text-[#A1A1A6] leading-relaxed">
                                    Link your terminal development environment to your account.
                                </p>
                            </div>

                            {profile && (
                                <div className="mb-5 border border-[#262626] bg-[#141414] p-3 font-mono text-xs flex items-center justify-between">
                                    <div className="flex items-center gap-2 truncate pr-2">
                                        <span className="text-[#87b2f4] font-semibold">//</span>
                                        <span className="text-[#888888]">User:</span>
                                        <span className="text-white font-medium truncate">
                                            {profile.email || profile.name}
                                        </span>
                                    </div>
                                    <span className="text-[#10b981] text-[11px] shrink-0">
                                        ACTIVE
                                    </span>
                                </div>
                            )}

                            <div className="flex flex-col gap-3">
                                {isLoading ? (
                                    <div className="w-full bg-[#141414] border border-[#2A2A2A] text-[#888888] font-mono text-xs h-10 rounded-none flex items-center justify-center animate-pulse">
                                        Checking session...
                                    </div>
                                ) : (
                                    <button
                                        type="button"
                                        onClick={handleAuthorize}
                                        disabled={status === 'authorizing'}
                                        className="w-full font-mono text-xs sm:text-[13px] font-medium h-10 rounded-none flex items-center justify-center transition-all cursor-pointer disabled:opacity-50 shadow-none bg-[#EDEDED] hover:bg-white text-[#090a0f]"
                                    >
                                        {status === 'authorizing'
                                            ? 'Authorizing CLI...'
                                            : profile
                                              ? `Authorize as ${profile.name || profile.email} →`
                                              : 'Sign in to Authorize →'}
                                    </button>
                                )}

                                {status === 'error' && (
                                    <p className="mt-1 font-mono text-xs text-red-400 px-1 text-center">
                                        {errorMessage}
                                    </p>
                                )}
                            </div>
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
