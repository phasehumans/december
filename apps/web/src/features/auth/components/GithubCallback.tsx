import { X } from 'lucide-react'
import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { authAPI } from '@/features/auth/api/auth'
import { Icons } from '@/shared/components/ui/Icons'

export const GithubCallback = () => {
    const navigate = useNavigate()
    const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')
    const [errorMsg, setErrorMsg] = useState<string | null>(null)

    useEffect(() => {
        const urlParams = new URLSearchParams(window.location.search)
        const code = urlParams.get('code')
        const error = urlParams.get('error')
        const errorDescription = urlParams.get('error_description')

        const isRealPopup = Boolean(
            window.opener && window.opener !== window && !window.opener.closed
        )

        if (error || errorDescription) {
            const message =
                errorDescription || error || 'GitHub authorization was cancelled or failed.'
            if (isRealPopup) {
                try {
                    window.opener.postMessage(
                        { type: 'GITHUB_LOGIN_FAILED', error: message },
                        window.location.origin
                    )
                    window.close()
                } catch {
                    // Intentionally swallowed: fallback handled below
                }
            }
            setStatus('error')
            setErrorMsg(message)
            return
        }

        if (!code) {
            const message = 'No authorization code found in URL.'
            if (isRealPopup) {
                try {
                    window.opener.postMessage(
                        { type: 'GITHUB_LOGIN_FAILED', error: message },
                        window.location.origin
                    )
                    window.close()
                } catch {
                    // Intentionally swallowed: fallback handled below
                }
            }
            setStatus('error')
            setErrorMsg(message)
            return
        }

        let openerHandled = false
        if (isRealPopup) {
            try {
                window.opener.postMessage(
                    { type: 'GITHUB_LOGIN_SUCCESS', code },
                    window.location.origin
                )
                window.close()
                openerHandled = true
            } catch {
                openerHandled = false
            }
        }

        const handleDirectAuth = async () => {
            try {
                setStatus('loading')
                await authAPI.github({ code })
                setStatus('success')
                window.location.href = '/'
            } catch (err: any) {
                setStatus('error')
                setErrorMsg(err?.message || 'Failed to authenticate with GitHub.')
            }
        }

        if (openerHandled) {
            const timer = setTimeout(() => {
                window.location.href = '/'
            }, 500)
            return () => clearTimeout(timer)
        } else {
            handleDirectAuth()
        }
    }, [navigate])

    if (status === 'error') {
        return (
            <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-[#141414] font-sans p-4 sm:p-6 overflow-y-auto">
                <button
                    type="button"
                    onClick={() => {
                        window.location.href = '/login'
                    }}
                    className="flex items-center justify-center absolute top-5 right-5 text-[#888888] hover:text-[#EDEDED] p-2 rounded-lg hover:bg-white/5 transition-colors z-50 outline-none cursor-pointer"
                    aria-label="Close"
                    title="Close"
                >
                    <X size={16} strokeWidth={1.75} />
                </button>

                <div className="w-full max-w-[380px] relative z-10 flex flex-col animate-in fade-in duration-200">
                    <div className="flex flex-col items-center text-center mb-6">
                        <div className="mb-5 text-white">
                            <Icons.DecemberLogo className="w-[42px] h-[42px] text-white" />
                        </div>
                        <h2 className="text-[22px] sm:text-[24px] font-medium text-white tracking-[-0.025em] leading-snug mb-2">
                            Authentication Failed
                        </h2>
                        <p className="text-[13px] text-[#A1A1A6] leading-relaxed max-w-sm">
                            {errorMsg ||
                                'An error occurred while authenticating with GitHub. Please return to login and try again.'}
                        </p>
                    </div>

                    <div className="flex flex-col gap-3">
                        <button
                            type="button"
                            onClick={() => {
                                window.location.href = '/login'
                            }}
                            className="w-full bg-white hover:bg-[#EDEDED] text-[#090a0f] font-sans text-xs sm:text-[13px] font-medium h-10 rounded-lg flex items-center justify-center transition-all cursor-pointer"
                        >
                            Back to Login
                        </button>
                    </div>
                </div>
            </div>
        )
    }

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#141414]">
            <div className="flex items-center justify-center animate-pulse">
                <Icons.DecemberLogo
                    className="w-10 h-10 md:w-14 md:h-14 text-[#212121]"
                    strokeWidth={1.2}
                />
            </div>
        </div>
    )
}
