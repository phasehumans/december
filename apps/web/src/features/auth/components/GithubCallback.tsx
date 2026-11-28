import React, { useEffect, useRef, useState } from 'react'

import { authPrimaryButtonClass } from './authModalStyles'
import { AuthPageShell } from './AuthPageShell'

import { authAPI } from '@/features/auth/api/auth'
import { githubOAuth } from '@/features/auth/githubOAuth'
import { LogoLoader } from '@/shared/components/ui/LogoLoader'
import { getApiBaseUrl } from '@/shared/config/env'
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

        // an install of the GitHub App with user authorization (V1) comes back to this page
        // too: the server's install callback checks the code and links the install
        if (urlParams.has('installation_id')) {
            const query = new URLSearchParams()
            for (const key of ['installation_id', 'setup_action', 'state', 'code']) {
                const value = urlParams.get(key)
                if (value) query.set(key, value)
            }
            window.location.replace(`${getApiBaseUrl()}/githubapp/callback?${query.toString()}`)
            return
        }

        const code = urlParams.get('code')
        const error = urlParams.get('error')
        const errorDescription = urlParams.get('error_description')
        const { isStateValid, returnPath } = githubOAuth.complete(urlParams.get('state'))
        // keep where the user started (device activation) for the retry
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
        // the look of the sign-up page: the logo, one red line, one button
        return (
            <AuthPageShell tone="red" line={errorMsg || 'GitHub sign-in failed. Try again.'}>
                <button
                    type="button"
                    onClick={() => {
                        window.location.href = backPath
                    }}
                    className={authPrimaryButtonClass}
                >
                    Try again
                </button>
            </AuthPageShell>
        )
    }

    return <LogoLoader />
}
