import { useQuery, useQueryClient } from '@tanstack/react-query'
import React, { useEffect, useState, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'

import { authPrimaryButtonClass } from './authModalStyles'
import { AuthPageShell } from './AuthPageShell'

import { AuthModal } from '@/features/auth/components/AuthModal'
import { profileAPI } from '@/features/profile/api/profile'
import { turnOffBrowserPushOnSignOut } from '@/features/profile/hooks/useBrowserPush'
import { apiRequest } from '@/shared/api/client'
import { LogoLoader } from '@/shared/components/ui/LogoLoader'
import { resetUserQueryCache } from '@/shared/lib/query-cache'
import { clearLoggedInCookie } from '@/shared/utils/logged-in-cookie'

// the page behind the link that `december login` prints: /activate?code=ABCD-EFGH.
// it follows the sign-up page: the logo, one grey line, then the controls.
//
// the user always sees the code and selects Authorize. the page never approves a code by
// itself, also not right after sign-in: a link from another person must not sign their
// terminal in to this account without a click.

const CODE_LENGTH = 9

const formatCode = (raw: string) => {
    let val = raw.replace(/[^A-Za-z0-9]/g, '').toUpperCase()
    if (val.length > 4) {
        val = val.substring(0, 4) + '-' + val.substring(4, 8)
    }
    return val
}

const storageKey = (code: string) => `december_device_code_${code}`

/** remembers that this browser approved the code, so a reload shows the done page */
const rememberApproved = (code: string) => {
    if (!code) return
    try {
        window.localStorage.setItem(storageKey(code), 'true')
    } catch {
        // Intentionally swallowed: storage can be blocked, a reload then asks the server
    }
}

const wasApprovedHere = (code: string): boolean => {
    if (!code) return false
    try {
        return window.localStorage.getItem(storageKey(code)) === 'true'
    } catch {
        // Intentionally swallowed: storage can be blocked, the server status is used
        return false
    }
}

type Status = 'idle' | 'verifying' | 'success' | 'used' | 'error'

const BAD_CODE_MESSAGE = 'This code is not valid or has expired.'

const codeInputClass =
    'w-full h-11 bg-[#141414] border border-[#2A2A2A] rounded-md text-white text-center tracking-[0.25em] font-mono text-base outline-none focus:border-[#87b2f4] transition-colors placeholder-[#444444]'

export const DeviceActivate: React.FC = () => {
    const queryClient = useQueryClient()
    const [searchParams] = useSearchParams()

    const rawCode = searchParams.get('code') || searchParams.get('user_code') || ''
    const urlCode = formatCode(rawCode)
    const hasUrlCode = Boolean(rawCode)

    const [userCode, setUserCode] = useState(urlCode)
    const [showAuthModal, setShowAuthModal] = useState(false)
    const [status, setStatus] = useState<Status>(() =>
        wasApprovedHere(urlCode) ? 'success' : 'idle'
    )
    const [errorMessage, setErrorMessage] = useState('')

    const {
        data: profile,
        isLoading,
        refetch,
    } = useQuery({
        queryKey: ['profile'],
        queryFn: profileAPI.getProfile,
        retry: false,
    })

    // a code that is used, expired or unknown goes straight to its own page
    const { data: deviceStatus } = useQuery({
        queryKey: ['device-status', urlCode],
        queryFn: () =>
            apiRequest<{ activated: boolean; status: string }>(
                `/auth/device/status?code=${encodeURIComponent(urlCode)}`
            ),
        enabled: Boolean(profile) && Boolean(urlCode),
        retry: false,
    })

    useEffect(() => {
        if (!urlCode || !deviceStatus) return
        const isUsed =
            deviceStatus.activated ||
            deviceStatus.status === 'already_activated' ||
            deviceStatus.status === 'expired' ||
            deviceStatus.status === 'invalid'
        if (isUsed) {
            setStatus((current) => (current === 'success' ? current : 'used'))
        }
    }, [deviceStatus, urlCode])

    useEffect(() => {
        if (!rawCode) return
        const formatted = formatCode(rawCode)
        setUserCode(formatted)
        if (wasApprovedHere(formatted)) setStatus('success')
    }, [rawCode])

    const handleCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setUserCode(formatCode(e.target.value))
        setStatus('idle')
        setErrorMessage('')
    }

    const verifyCode = useCallback(async () => {
        setStatus('verifying')
        setErrorMessage('')
        try {
            const res = await apiRequest<{ status?: string }>('/auth/device/verify', {
                method: 'POST',
                body: JSON.stringify({ userCode }),
            })

            if (res?.status === 'already_activated') {
                setStatus('used')
                return
            }
            rememberApproved(userCode)
            setStatus('success')
        } catch (err: any) {
            const msg = (err.message || '').toLowerCase()
            const isAuthError =
                err?.status === 401 ||
                err?.status === 403 ||
                msg.includes('unauthorized') ||
                msg.includes('unauthenticated') ||
                msg.includes('session expired') ||
                msg.includes('invalid token')

            if (isAuthError) {
                // the session ended: sign in again, then the user selects Authorize again
                queryClient.setQueryData(['profile'], null)
                setStatus('idle')
                setShowAuthModal(true)
                return
            }

            const isSpent = msg.includes('no longer pending') || msg.includes('already')
            const isBad = msg.includes('invalid code') || msg.includes('expired')
            // a code from the link cannot be fixed on this page, so it gets the "run it again" page
            if (isSpent || (hasUrlCode && isBad)) {
                setStatus('used')
                return
            }

            setStatus('error')
            setErrorMessage(isBad ? BAD_CODE_MESSAGE : err.message || BAD_CODE_MESSAGE)
        }
    }, [userCode, hasUrlCode, queryClient])

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault()
        if (userCode.length !== CODE_LENGTH) {
            setStatus('error')
            setErrorMessage('Enter the 8-character code from your terminal.')
            return
        }
        void verifyCode()
    }

    // signing in does not approve the code: the user selects Authorize after it
    const handleAuthSuccess = async () => {
        setShowAuthModal(false)
        await refetch()
    }

    const handleSwitchAccount = async () => {
        clearLoggedInCookie()
        // before the sign out: it needs the session. the next account starts with push off
        await turnOffBrowserPushOnSignOut()
        try {
            await profileAPI.signout()
        } catch {
            // Intentionally swallowed: the sign-in page opens even when the network fails
        }
        // also clears localStorage, so the next account never starts with this one's profile
        resetUserQueryCache(queryClient)
        queryClient.setQueryData(['profile'], null)
        setStatus('idle')
        setErrorMessage('')
        setShowAuthModal(true)
    }

    // a signed-out user who came from the terminal link gets the sign-in page at once
    const hasOpenedAuthRef = React.useRef(false)
    useEffect(() => {
        if (hasOpenedAuthRef.current) return
        if (hasUrlCode && !profile && !isLoading && status === 'idle') {
            hasOpenedAuthRef.current = true
            setShowAuthModal(true)
        }
    }, [hasUrlCode, profile, isLoading, status])

    const authModal = (
        <AuthModal
            isOpen={showAuthModal}
            onClose={() => setShowAuthModal(false)}
            onAuthSuccess={handleAuthSuccess}
            initialMode="login"
        />
    )

    if (status === 'success') {
        return <AuthPageShell line="December CLI is signed in. You can close this tab." />
    }

    if (status === 'used') {
        return (
            <AuthPageShell
                line={
                    <>
                        This code is used or expired. If the terminal still waits, run{' '}
                        <code className="font-mono text-[12px] text-white">december login</code>{' '}
                        again.
                    </>
                }
            />
        )
    }

    if (isLoading) return <LogoLoader />

    if (!profile) {
        return (
            <>
                <AuthPageShell line="Log in to continue to December CLI">
                    <button
                        type="button"
                        onClick={() => setShowAuthModal(true)}
                        className={authPrimaryButtonClass}
                    >
                        Log in
                    </button>
                </AuthPageShell>
                {authModal}
            </>
        )
    }

    const isVerifying = status === 'verifying'
    const isReady = userCode.length === CODE_LENGTH

    return (
        <>
            <AuthPageShell
                line={
                    !hasUrlCode ? (
                        'Enter the code from your terminal'
                    ) : profile.email ? (
                        <>
                            Sign in to December CLI as{' '}
                            <span className="text-white font-medium break-all">
                                {profile.email}
                            </span>
                        </>
                    ) : (
                        'Sign in to December CLI'
                    )
                }
            >
                <form onSubmit={handleSubmit} className="flex flex-col gap-2.5">
                    <input
                        id="device-code"
                        aria-label="Code from your terminal"
                        type="text"
                        value={userCode}
                        onChange={handleCodeChange}
                        placeholder="ABCD-EFGH"
                        maxLength={CODE_LENGTH}
                        readOnly={hasUrlCode}
                        disabled={isVerifying}
                        autoFocus={!hasUrlCode}
                        spellCheck={false}
                        autoComplete="off"
                        className={codeInputClass}
                    />

                    {status === 'error' && (
                        <p role="alert" className="font-sans text-xs text-red-400 px-1 text-center">
                            {errorMessage}
                        </p>
                    )}

                    <button
                        type="submit"
                        disabled={isVerifying || !isReady}
                        className={authPrimaryButtonClass}
                    >
                        {isVerifying ? 'Authorizing...' : 'Authorize'}
                    </button>
                </form>

                <div className="mt-4 flex justify-center font-sans text-xs text-[#888888]">
                    <button
                        type="button"
                        onClick={() => void handleSwitchAccount()}
                        disabled={isVerifying}
                        className="hover:text-white transition-colors cursor-pointer disabled:opacity-50"
                    >
                        Use a different account
                    </button>
                </div>
            </AuthPageShell>
            {authModal}
        </>
    )
}
