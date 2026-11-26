import { useMutation, useQueryClient } from '@tanstack/react-query'
import React, { useState } from 'react'

import { adminAPI, type AdminMe } from '../api/admin'

import { AdminButton, ErrorLine, Muted, adminInputClass } from './AdminUi'

import { ApiError } from '@/shared/api/client'
import { cn } from '@/shared/lib/utils'

// the admin's authenticator app (S1): setup, the code on each visit, and a fresh code
// before risky actions (a mass email, a credit change over $100)

export const ME_KEY = ['admin', 'me']

const codeOf = (err: unknown) =>
    err instanceof ApiError ? (err.details as { code?: string } | undefined)?.code : undefined

/** the server wants an authenticator code first (its 12 hours ran out, or it was reset) */
export const isCodeError = (err: unknown) =>
    codeOf(err) === 'admin_code_required' || codeOf(err) === 'admin_code_fresh'

const CodeInput: React.FC<{
    id: string
    value: string
    onChange: (value: string) => void
    autoFocus?: boolean
}> = ({ id, value, onChange, autoFocus }) => (
    <input
        id={id}
        aria-label="6-digit code"
        autoComplete="one-time-code"
        inputMode="numeric"
        autoFocus={autoFocus}
        maxLength={7}
        placeholder="123456"
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/[^\d ]/g, ''))}
        className={cn(
            adminInputClass,
            'w-[132px] text-center font-mono text-[16px] tracking-[0.2em]'
        )}
    />
)

const isSixDigits = (code: string) => /^\d{6}$/.test(code.replace(/\s+/g, ''))

/** One code form: setup (first time), or the code on each visit. */
export const AdminCodeGate: React.FC<{ me: AdminMe }> = ({ me }) => {
    const queryClient = useQueryClient()
    const [code, setCode] = useState('')
    const setup = useMutation({ mutationFn: adminAPI.startTotpSetup })
    const submit = useMutation({
        mutationFn: (value: string) =>
            me.totp.enabled ? adminAPI.verifyTotp(value) : adminAPI.enableTotp(value),
        onSuccess: async () => {
            setCode('')
            await queryClient.invalidateQueries({ queryKey: ['admin'] })
        },
    })

    const locked = me.totp.lockedUntil && new Date(me.totp.lockedUntil).getTime() > Date.now()

    const form = (
        <form
            className="flex items-center gap-2 flex-wrap"
            onSubmit={(e) => {
                e.preventDefault()
                if (isSixDigits(code)) submit.mutate(code)
            }}
        >
            <CodeInput id="admin-code" value={code} onChange={setCode} autoFocus />
            <AdminButton
                type="submit"
                tone="primary"
                disabled={!isSixDigits(code) || submit.isPending}
            >
                {me.totp.enabled ? 'Continue' : 'Turn on'}
            </AdminButton>
        </form>
    )

    return (
        <div className="max-w-[420px] flex flex-col gap-4 pt-4">
            {me.totp.enabled ? (
                <>
                    <div className="flex flex-col gap-1">
                        <h2 className="text-[16px] text-[#EDEDED]">Enter your code</h2>
                        <Muted>The 6-digit code from your authenticator app.</Muted>
                    </div>
                    {locked ? (
                        <Muted>
                            Too many wrong codes. Try again after{' '}
                            {new Date(me.totp.lockedUntil!).toLocaleTimeString()}.
                        </Muted>
                    ) : (
                        form
                    )}
                </>
            ) : (
                <>
                    <div className="flex flex-col gap-1">
                        <h2 className="text-[16px] text-[#EDEDED]">Set up authenticator</h2>
                        <Muted>
                            Scan the code with your authenticator app, or type the key. Then enter
                            the 6-digit code it shows.
                        </Muted>
                    </div>
                    {setup.data ? (
                        <>
                            <img
                                src={setup.data.qrDataUrl}
                                alt="QR code for your authenticator app"
                                width={176}
                                height={176}
                                className="rounded-lg bg-white p-1"
                            />
                            <code className="font-mono text-[13px] text-[#D6D5C9] bg-[#1C1C1C] border border-[#2B2A27] rounded-lg px-3 py-2 break-all select-all">
                                {setup.data.key}
                            </code>
                            {form}
                        </>
                    ) : (
                        <AdminButton
                            tone="primary"
                            disabled={setup.isPending}
                            onClick={() => setup.mutate()}
                        >
                            Set up authenticator
                        </AdminButton>
                    )}
                    <ErrorLine error={setup.error} />
                </>
            )}
            <ErrorLine error={submit.error} />
        </div>
    )
}
