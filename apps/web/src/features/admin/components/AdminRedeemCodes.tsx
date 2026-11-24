import { useQuery } from '@tanstack/react-query'
import React, { useState } from 'react'

import { adminAPI } from '../api/admin'

import {
    AdminBox,
    AdminButton,
    AdminList,
    AdminRow,
    AdminSection,
    ErrorLine,
    Muted,
    adminInputClass,
    money,
    shortDate,
    useAdminAction,
} from './AdminUi'

const KEY = ['admin', 'redeem-codes']

export const AdminRedeemCodes: React.FC = () => {
    const { data, error, isLoading } = useQuery({
        queryKey: KEY,
        queryFn: adminAPI.listRedeemCodes,
    })
    const [code, setCode] = useState('')
    const [amount, setAmount] = useState('')
    const [maxUses, setMaxUses] = useState('')
    const [expiresAt, setExpiresAt] = useState('')
    const create = useAdminAction(
        (input: Parameters<typeof adminAPI.createRedeemCode>[0]) =>
            adminAPI.createRedeemCode(input),
        [KEY]
    )

    const cents = Math.round(Number(amount) * 100)
    const canCreate = Number.isFinite(cents) && cents > 0

    return (
        <AdminSection title="Redeem codes">
            <AdminBox>
                <form
                    className="flex items-center gap-2 flex-wrap"
                    onSubmit={(e) => {
                        e.preventDefault()
                        if (!canCreate) return
                        create.mutate(
                            [
                                {
                                    ...(code.trim() ? { code: code.trim() } : {}),
                                    amountInCents: cents,
                                    ...(maxUses ? { maxRedemptions: Number(maxUses) } : {}),
                                    ...(expiresAt
                                        ? { expiresAt: new Date(expiresAt).toISOString() }
                                        : {}),
                                },
                            ],
                            {
                                onSuccess: () => {
                                    setCode('')
                                    setAmount('')
                                    setMaxUses('')
                                    setExpiresAt('')
                                },
                            }
                        )
                    }}
                >
                    <input
                        aria-label="Code"
                        placeholder="Code (empty: random)"
                        value={code}
                        onChange={(e) => setCode(e.target.value.toUpperCase())}
                        className={`${adminInputClass} font-mono w-[180px]`}
                    />
                    <input
                        aria-label="Amount in dollars"
                        placeholder="$ amount"
                        inputMode="decimal"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        className={`${adminInputClass} w-[100px]`}
                    />
                    <input
                        aria-label="Max uses"
                        placeholder="Max uses"
                        inputMode="numeric"
                        value={maxUses}
                        onChange={(e) => setMaxUses(e.target.value.replace(/\D/g, ''))}
                        className={`${adminInputClass} w-[100px]`}
                    />
                    <input
                        aria-label="Expires"
                        type="date"
                        value={expiresAt}
                        onChange={(e) => setExpiresAt(e.target.value)}
                        className={`${adminInputClass} [color-scheme:dark]`}
                    />
                    <AdminButton
                        type="submit"
                        tone="primary"
                        disabled={!canCreate || create.isPending}
                    >
                        Create
                    </AdminButton>
                </form>
                <ErrorLine error={create.error} />
            </AdminBox>

            <ErrorLine error={error} />
            {!isLoading && (
                <AdminList empty="No codes">
                    {(data?.items ?? []).map((item) => (
                        <AdminRow key={item.id}>
                            <div className="flex flex-col gap-0.5 min-w-0">
                                <span className="font-mono text-[14px] text-[#D6D5C9] select-all">
                                    {item.code ?? '(hidden)'}
                                </span>
                                <Muted>
                                    {money(item.amountInCents)} · {item.redemptionCount}
                                    {item.maxRedemptions ? ` of ${item.maxRedemptions}` : ''} used
                                    {item.expiresAt ? ` · ends ${shortDate(item.expiresAt)}` : ''}
                                </Muted>
                                {item.claims.length > 0 && (
                                    <Muted className="break-all">
                                        {item.claims.map((claim) => claim.email).join(', ')}
                                    </Muted>
                                )}
                            </div>
                            <Muted>{shortDate(item.createdAt)}</Muted>
                        </AdminRow>
                    ))}
                </AdminList>
            )}
        </AdminSection>
    )
}
