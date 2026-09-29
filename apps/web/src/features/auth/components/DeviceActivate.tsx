import { useQuery } from '@tanstack/react-query'
import { ChevronLeft } from 'lucide-react'
import React, { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'

import { AuthModal } from '@/features/auth/components/AuthModal'
import { profileAPI } from '@/features/profile/api/profile'
import { apiRequest } from '@/shared/api/client'
import { Icons } from '@/shared/components/ui/Icons'
import { getWebUrl } from '@/shared/config/env'

const formatCode = (raw: string) => {
    let val = raw.replace(/[^A-Za-z0-9]/g, '').toUpperCase()
    if (val.length > 4) {
        val = val.substring(0, 4) + '-' + val.substring(4, 8)
    }
    return val
}

const persistDeviceActivation = (code?: string) => {
    if (typeof window === 'undefined') return
    if (code) {
        window.localStorage.setItem(`december_device_code_${code}`, 'true')
    }
    window.localStorage.setItem('december_device_activated', 'true')
}

const isDeviceActivatedInStorage = (code?: string): boolean => {
    if (typeof window === 'undefined') return false
    if (code && window.localStorage.getItem(`december_device_code_${code}`) === 'true') {
        return true
    }
    if (!code && window.localStorage.getItem('december_device_activated') === 'true') {
        return true
    }
    return false
}

export const DeviceActivate: React.FC = () => {
    const [searchParams] = useSearchParams()

    const rawCode = searchParams.get('code') || searchParams.get('user_code') || ''
    const initialUserCode = formatCode(rawCode)
    const hasUrlCode = Boolean(rawCode)

    const [userCode, setUserCode] = useState(initialUserCode)
    const [showAuthModal, setShowAuthModal] = useState(false)

    // Check if previously activated in this browser
    const [status, setStatus] = useState<
        'idle' | 'verifying' | 'success' | 'already_activated' | 'error'
    >(() => (isDeviceActivatedInStorage(initialUserCode) ? 'already_activated' : 'idle'))
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

    // check if device or code is already activated
    const { data: deviceStatus } = useQuery({
        queryKey: ['device-status', initialUserCode],
        queryFn: () =>
            apiRequest<{ activated: boolean; status: string }>(
                `/auth/device/status${initialUserCode ? `?code=${encodeURIComponent(initialUserCode)}` : ''}`
            ),
        enabled: Boolean(profile),
        retry: false,
    })

    useEffect(() => {
        if (deviceStatus?.activated || deviceStatus?.status === 'already_activated') {
            setStatus('already_activated')
            persistDeviceActivation(initialUserCode)
        }
    }, [deviceStatus, initialUserCode])

    useEffect(() => {
        if (rawCode) {
            const formatted = formatCode(rawCode)
            setUserCode(formatted)
            if (isDeviceActivatedInStorage(formatted)) {
                setStatus('already_activated')
            }
        }
    }, [rawCode])

    const handleCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = formatCode(e.target.value)
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
            const res = await apiRequest<{ status?: string }>('/auth/device/verify', {
                method: 'POST',
                body: JSON.stringify({ userCode }),
            })

            persistDeviceActivation(userCode)

            if (res?.status === 'already_activated') {
                setStatus('already_activated')
            } else {
                setStatus('success')
            }
        } catch (err: any) {
            const msg = (err.message || '').toLowerCase()
            if (
                msg.includes('no longer pending') ||
                msg.includes('already') ||
                (hasUrlCode && msg.includes('invalid code'))
            ) {
                persistDeviceActivation(userCode)
                setStatus('already_activated')
                return
            }

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

    const isReady = userCode.length === 9
    const isSuccess = status === 'success' || status === 'already_activated'

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
                    {isSuccess ? (
                        <div className="flex flex-col items-center text-center py-2 animate-in fade-in duration-200">
                            <div className="mb-5 text-white">
                                <Icons.DecemberLogo className="w-[42px] h-[42px] text-white" />
                            </div>

                            <h2 className="text-[22px] sm:text-[24px] font-medium text-white tracking-[-0.025em] leading-snug mb-2">
                                {status === 'already_activated'
                                    ? 'Device Already Activated'
                                    : 'Device Authorized'}
                            </h2>
                            <p className="text-xs sm:text-[13px] text-[#888888] font-sans leading-relaxed mb-6">
                                {status === 'already_activated'
                                    ? 'Your terminal session has already been linked. You can close this window and return to your terminal.'
                                    : 'Your terminal session has been linked. You can close this window and return to your terminal.'}
                            </p>

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
                                Return to Dashboard
                            </a>
                        </div>
                    ) : (
                        <div className="flex flex-col">
                            <div className="flex flex-col items-center text-center mb-6">
                                <div className="mb-5 text-white">
                                    <Icons.DecemberLogo className="w-[42px] h-[42px] text-white" />
                                </div>
                                <h2 className="text-[22px] sm:text-[24px] font-medium text-white tracking-[-0.025em] leading-snug mb-1.5">
                                    {profile ? 'Authorize Device' : 'Activate Device'}
                                </h2>
                                <p className="text-xs sm:text-[13px] text-[#888888] font-sans leading-relaxed">
                                    {profile
                                        ? profile.email
                                            ? `Connect your terminal session to ${profile.email}.`
                                            : 'Connect your terminal session to your December account.'
                                        : 'Sign in to link your terminal session to December.'}
                                </p>
                            </div>

                            <div className="flex flex-col gap-3">
                                {!hasUrlCode && (
                                    <div className="flex flex-col gap-1.5">
                                        <input
                                            type="text"
                                            value={userCode}
                                            onChange={handleCodeChange}
                                            placeholder="ABCD-EFGH"
                                            maxLength={9}
                                            disabled={status === 'verifying'}
                                            autoFocus
                                            spellCheck={false}
                                            autoComplete="off"
                                            className="w-full bg-[#141414] border border-[#2A2A2A] rounded-lg text-white text-center tracking-[0.25em] font-mono h-11 px-4 text-base outline-none focus:border-[#87b2f4] transition-colors placeholder-[#444444]"
                                        />
                                    </div>
                                )}

                                <button
                                    type="button"
                                    onClick={handleVerify}
                                    disabled={status === 'verifying' || !isReady || isLoading}
                                    className={`w-full font-sans text-xs sm:text-[13px] font-medium h-10 rounded-lg flex items-center justify-center transition-all cursor-pointer disabled:opacity-50 shadow-none border ${
                                        isReady
                                            ? 'bg-[#EDEDED] hover:bg-white text-[#090a0f] border-transparent'
                                            : 'bg-[#202020] hover:bg-[#252525] text-[#888888] border-[#2A2A2A]'
                                    }`}
                                >
                                    {isLoading
                                        ? 'Checking session...'
                                        : status === 'verifying'
                                          ? 'Authorizing...'
                                          : profile
                                            ? 'Authorize'
                                            : 'Sign in to Authorize'}
                                </button>

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
