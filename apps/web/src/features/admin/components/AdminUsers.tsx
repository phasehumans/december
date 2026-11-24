import { useQuery } from '@tanstack/react-query'
import React, { useState } from 'react'

import { adminAPI, type AdminUserRow } from '../api/admin'

import {
    AdminBox,
    AdminButton,
    AdminList,
    AdminRow,
    AdminSection,
    ErrorLine,
    Muted,
    Tag,
    adminInputClass,
    money,
    shortDate,
    useAdminAction,
} from './AdminUi'

const UserDetail: React.FC<{ userId: string }> = ({ userId }) => {
    const detailKey = ['admin', 'user', userId]
    const { data: user, error } = useQuery({
        queryKey: detailKey,
        queryFn: () => adminAPI.getUser(userId),
    })
    const [amount, setAmount] = useState('')
    const [reason, setReason] = useState('')
    const adjust = useAdminAction(
        (cents: number, why: string) => adminAPI.adjustCredits(userId, cents, why),
        [detailKey, ['admin', 'users']]
    )
    const restore = useAdminAction(
        () => adminAPI.restoreUser(userId),
        [detailKey, ['admin', 'users']]
    )

    if (error) return <ErrorLine error={error} />
    if (!user) return null

    const cents = Math.round(Number(amount) * 100)
    const canAdjust = Number.isFinite(cents) && cents !== 0 && reason.trim().length > 0

    return (
        <AdminBox className="mt-2">
            <div className="flex flex-wrap gap-1.5">
                <Tag>{user.notifyProductUpdates ? 'product emails on' : 'product emails off'}</Tag>
                <Tag>{user.githubAppInstall ? 'github app installed' : 'no github app'}</Tag>
                {user.providerCredentials.map((key) => (
                    <Tag key={key.provider}>
                        {key.provider} {key.keyHint}
                    </Tag>
                ))}
                {user.creditRequests.map((request) => (
                    <Tag key={request.id} tone={request.status === 'APPROVED' ? 'ok' : 'plain'}>
                        $5 request {request.status.toLowerCase()}
                    </Tag>
                ))}
            </div>

            <form
                className="flex items-center gap-2 flex-wrap"
                onSubmit={(e) => {
                    e.preventDefault()
                    if (!canAdjust) return
                    adjust.mutate([cents, reason.trim()], {
                        onSuccess: () => {
                            setAmount('')
                            setReason('')
                        },
                    })
                }}
            >
                <input
                    aria-label="Amount in dollars"
                    placeholder="$ +5 or -2"
                    inputMode="decimal"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className={`${adminInputClass} w-[120px]`}
                />
                <input
                    aria-label="Reason"
                    placeholder="Reason"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    className={`${adminInputClass} flex-1 min-w-[160px]`}
                />
                <AdminButton type="submit" disabled={!canAdjust || adjust.isPending}>
                    Change credits
                </AdminButton>
                {user.isDeleted && (
                    <AdminButton
                        tone="primary"
                        disabled={restore.isPending}
                        onClick={() => restore.mutate([])}
                    >
                        Restore account
                    </AdminButton>
                )}
            </form>
            <ErrorLine error={adjust.error || restore.error} />

            <div className="flex flex-col gap-1">
                {user.walletTransactions.length === 0 ? (
                    <Muted>No wallet history</Muted>
                ) : (
                    user.walletTransactions.map((tx) => (
                        <div
                            key={tx.id}
                            className="flex items-center justify-between gap-3 text-[13px]"
                        >
                            <span className="text-[#B5B4AE] truncate">
                                {tx.provider.toLowerCase()}
                                {typeof tx.metadata?.reason === 'string'
                                    ? ` · ${tx.metadata.reason}`
                                    : ''}
                                {tx.status !== 'SUCCESS' ? ` · ${tx.status.toLowerCase()}` : ''}
                            </span>
                            <span className="flex items-center gap-3 shrink-0">
                                <Muted>{shortDate(tx.createdAt)}</Muted>
                                <span className="font-mono text-[#D6D5C9]">
                                    {money(tx.amountInCents)}
                                </span>
                            </span>
                        </div>
                    ))
                )}
            </div>
        </AdminBox>
    )
}

const UserRow: React.FC<{ user: AdminUserRow; open: boolean; onToggle: () => void }> = ({
    user,
    open,
    onToggle,
}) => (
    <AdminRow className="flex-col !items-stretch">
        <button
            type="button"
            onClick={onToggle}
            className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1 text-left cursor-pointer"
        >
            <div className="flex flex-col gap-0.5 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[14px] text-[#D6D5C9] break-all">{user.email}</span>
                    {user.isDeleted && <Tag tone="warn">deleted</Tag>}
                </div>
                <Muted>
                    {user.signupMethod} · {user.accountAgeDays} days ·{' '}
                    {user.defaultModelSource === 'OWN_KEY' ? 'own key' : 'credits'} · {user.ownKeys}{' '}
                    keys · {user.sessions} sessions
                </Muted>
            </div>
            <div className="flex flex-col items-end gap-0.5">
                <span className="font-mono text-[14px] text-[#D6D5C9]">
                    {money(user.creditBalance)}
                </span>
                <Muted>
                    used {money(user.usage.creditsCents)} credits, {money(user.usage.ownKeyCents)}{' '}
                    own key
                </Muted>
            </div>
        </button>
        {open && <UserDetail userId={user.id} />}
    </AdminRow>
)

export const AdminUsers: React.FC = () => {
    const [query, setQuery] = useState('')
    const [openId, setOpenId] = useState<string | null>(null)
    const { data, error, isLoading } = useQuery({
        queryKey: ['admin', 'users', query],
        queryFn: () => adminAPI.listUsers(query.trim()),
    })

    return (
        <AdminSection
            title="Users"
            action={
                <input
                    aria-label="Search users"
                    placeholder="Email, name or GitHub"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    className={`${adminInputClass} w-[240px] max-w-full`}
                />
            }
        >
            <ErrorLine error={error} />
            {!isLoading && (
                <AdminList empty="No users">
                    {(data?.items ?? []).map((user) => (
                        <UserRow
                            key={user.id}
                            user={user}
                            open={openId === user.id}
                            onToggle={() => setOpenId(openId === user.id ? null : user.id)}
                        />
                    ))}
                </AdminList>
            )}
        </AdminSection>
    )
}
