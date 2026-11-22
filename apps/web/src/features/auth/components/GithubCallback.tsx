import { X } from 'lucide-react'
import React, { useEffect, useRef, useState } from 'react'

import { authAPI } from '@/features/auth/api/auth'
import { githubOAuth } from '@/features/auth/githubOAuth'
import { Icons } from '@/shared/components/ui/Icons'
import { LogoLoader } from '@/shared/components/ui/LogoLoader'
import { clearPersistedQueryCache } from '@/shared/lib/query-cache'

export const GithubCallback = () => {
    const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')
    const [errorMsg, setErrorMsg] = useState<string | null>(null)
    const [backPath, setBackPath] = useState('/login')
    // the code is single use: never exchange it twice (StrictMode runs effects twice)
    const hasStarted = useRef(false)

    useEffect(() => {
        if (hasStarted.current) return
        hasStarted.current = true

        const urlParams = new URLSearchParams(window.location.search)
        const code = urlParams.get('code')
        const error = urlParams.get('error')
        const errorDescription = urlParams.get('error_description')
        const { isStateValid, returnPath } = githubOAuth.complete(urlParams.get('state'))
        // keep where the user started (cli login, device activation) for the retry
        if (returnPath !== '/') {
            setBackPath(`/login?redirect=${encodeURIComponent(returnPath)}`)
        }

        const fail = (message: string) => {
            setStatus('error')
            setErrorMsg(message)
        }

        if (error || errorDescription) {
            fail(errorDescription || error || 'GitHub authorization was cancelled or failed.')
            return
        }

        if (!code) {
            fail('No authorization code found in URL.')
            return
        }

        if (!isStateValid) {
            fail('This GitHub sign-in link is not valid or has expired. Please try again.')
            return
        }

        const exchangeCode = async () => {
            try {
                await authAPI.github({ code })
                // the next page load must not restore a previous account's cached profile
                clearPersistedQueryCache()
                setStatus('success')
                window.location.href = returnPath
            } catch (err: any) {
                fail(err?.message || 'Failed to authenticate with GitHub.')
            }
        }

        exchangeCode()
    }, [])

    if (status === 'error') {
        return (
            <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-[#141414] font-sans p-4 sm:p-6 overflow-y-auto">
                <button
                    type="button"
                    onClick={() => {
                        window.location.href = backPath
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
                                window.location.href = backPath
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

    return <LogoLoader />
}
