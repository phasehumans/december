import React, { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useLocation } from 'react-router-dom'
import { Icons } from '@/shared/components/ui/Icons'
import { profileAPI } from '@/features/profile/api/profile'
import { AuthModal } from '@/features/auth/components/AuthModal'
import { apiRequest } from '@/shared/api/client'

export const CliLogin: React.FC = () => {
    const location = useLocation()
    const searchParams = new URLSearchParams(location.search)
    const redirectUri = searchParams.get('redirect_uri')

    const [showAuthModal, setShowAuthModal] = useState(false)
    const [status, setStatus] = useState<'idle' | 'authorizing' | 'success' | 'error'>('idle')
    const [errorMessage, setErrorMessage] = useState('')

    // Check if user is logged in
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
            setErrorMessage('Missing redirect URI')
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
                // Redirect back to CLI server
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
        <div className="flex flex-col items-center justify-center min-h-screen bg-[#141414] font-roboto overflow-y-auto">
            <div className="w-full flex items-center justify-center p-6 md:p-10 lg:p-12 relative bg-[#141414]">
                <div className="w-full max-w-[380px] relative z-10 flex flex-col">
                    <div className="flex flex-col items-center text-center mb-6">
                        <div className="w-[42px] h-[42px] mb-6">
                            <Icons.DecemberLogo
                                className="w-full h-full"
                                stroke="white"
                                strokeWidth={1}
                            />
                        </div>
                        <h2 className="text-[22px] font-normal text-white tracking-tight mb-1">
                            Authorize December CLI
                        </h2>
                        <p className="text-[13px] text-[#A3A3A3]">
                            securely sync your environment and generate code.
                        </p>
                    </div>

                    <div className="flex flex-col gap-3">
                        {isLoading ? (
                            <div className="w-full bg-[#141414] border border-[#2A2A2A] text-[#888888] font-medium h-[42px] rounded-full flex items-center justify-center text-[14px] animate-pulse">
                                Checking session...
                            </div>
                        ) : (
                            <button
                                onClick={handleAuthorize}
                                disabled={status === 'authorizing' || status === 'success'}
                                className={`w-full font-medium h-[42px] rounded-full flex items-center justify-center text-[14px] transition-all duration-200 active:scale-[0.98] disabled:opacity-50 shadow-none
                                    ${
                                        status === 'success'
                                            ? 'bg-[#222222] text-white'
                                            : 'bg-[#EDEDED] hover:bg-white text-[#111111]'
                                    }`}
                            >
                                {status === 'authorizing'
                                    ? 'Authorizing...'
                                    : status === 'success'
                                      ? 'Authorized!'
                                      : profile
                                        ? 'Authorize as ' + profile.name
                                        : 'Sign in to Authorize'}
                            </button>
                        )}

                        {status === 'error' && (
                            <p className="mt-1 text-[13px] text-red-500 px-1 text-center">
                                {errorMessage}
                            </p>
                        )}
                    </div>
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
