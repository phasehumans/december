import { useQuery } from '@tanstack/react-query'
import React, { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'

import { AuthModal } from '@/features/auth/components/AuthModal'
import { profileAPI } from '@/features/profile/api/profile'
import { apiRequest } from '@/shared/api/client'
import { Icons } from '@/shared/components/ui/Icons'

export const DeviceActivate: React.FC = () => {
    const [searchParams] = useSearchParams()
    const [userCode, setUserCode] = useState('')
    const [showAuthModal, setShowAuthModal] = useState(false)
    const [status, setStatus] = useState<'idle' | 'verifying' | 'success' | 'error'>('idle')
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

    useEffect(() => {
        const rawCode = searchParams.get('code') || searchParams.get('user_code')
        if (rawCode) {
            let val = rawCode.replace(/[^A-Za-z0-9]/g, '').toUpperCase()
            if (val.length > 4) {
                val = val.substring(0, 4) + '-' + val.substring(4, 8)
            }
            setUserCode(val)
        }
    }, [searchParams])

    const handleCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        // format as abcd-efgh automatically
        let val = e.target.value.replace(/[^A-Za-z0-9]/g, '').toUpperCase()
        if (val.length > 4) {
            val = val.substring(0, 4) + '-' + val.substring(4, 8)
        }
        setUserCode(val)
        setStatus('idle')
        setErrorMessage('')
    }

    const handleVerify = async () => {
        if (userCode.length !== 9) {
            setStatus('error')
            setErrorMessage('Please enter a valid 8-character code')
            return
        }

        if (!profile) {
            setShowAuthModal(true)
            return
        }

        verifyCode()
    }

    const verifyCode = async () => {
        setStatus('verifying')
        try {
            await apiRequest('/auth/device/verify', {
                method: 'POST',
                body: JSON.stringify({ userCode }),
            })

            setStatus('success')
        } catch (err: any) {
            setStatus('error')
            setErrorMessage(
                err.message || 'Verification failed. The code may be invalid or expired.'
            )
        }
    }

    const handleAuthSuccess = async () => {
        setShowAuthModal(false)
        await refetch()
        verifyCode()
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
                                STATUS: DEVICE_PAIRED
                            </span>
                            <h2 className="text-xl sm:text-[22px] font-medium text-white tracking-[-0.025em] leading-snug mb-2">
                                Device Authorized!
                            </h2>
                            <p className="text-xs sm:text-[13px] text-[#A1A1A6] leading-relaxed mb-6">
                                Your terminal session has been linked. You can close this window and
                                return to your terminal.
                            </p>
                            <div className="w-full border border-[#262626] bg-[#141414] p-3 text-left font-mono text-xs text-[#a09f9d] flex items-center justify-between">
                                <span className="text-[#87b2f4]">{userCode}</span>
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
                                    Activate Device
                                </h2>
                                <p className="text-[13px] text-[#A1A1A6] leading-relaxed">
                                    Enter the 8-character code displayed on your terminal.
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

                            <div className="flex flex-col gap-4">
                                <input
                                    type="text"
                                    value={userCode}
                                    onChange={handleCodeChange}
                                    placeholder="ABCD-EFGH"
                                    className="w-full bg-[#141414] border border-[#2A2A2A] rounded-none text-white text-center tracking-[0.25em] font-mono h-11 px-4 text-base outline-none focus:border-[#87b2f4] transition-colors"
                                    maxLength={9}
                                    disabled={status === 'verifying'}
                                />

                                <button
                                    type="button"
                                    onClick={handleVerify}
                                    disabled={
                                        status === 'verifying' || userCode.length !== 9 || isLoading
                                    }
                                    className="w-full font-mono text-xs sm:text-[13px] font-medium h-10 rounded-none flex items-center justify-center transition-all cursor-pointer disabled:opacity-50 shadow-none bg-[#EDEDED] hover:bg-white text-[#090a0f]"
                                >
                                    {isLoading
                                        ? 'Checking session...'
                                        : status === 'verifying'
                                          ? 'Verifying code...'
                                          : profile
                                            ? `Authorize as ${profile.name || profile.email} →`
                                            : 'Sign in to Authorize →'}
                                </button>

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
