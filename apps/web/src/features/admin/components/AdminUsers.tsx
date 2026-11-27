import { useQuery } from '@tanstack/react-query'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import React, { useEffect, useState } from 'react'

import { USERS_PAGE_SIZE, adminAPI, type AdminUserFilter, type AdminUserRow } from '../api/admin'

import {
    AdminButton,
    AdminDialog,
    AdminSkeleton,
    ErrorLine,
    Muted,
    Tag,
    adminInputClass,
    money,
    useAdminAction,
} from './AdminUi'
import { AdminUserCard, CopyEmail, UserTags } from './AdminUserCard'

import { formatRelativeTime } from '@/shared/lib/relativeTime'
import { useIsPhone } from '@/shared/lib/useIsPhone'
import { cn } from '@/shared/lib/utils'

// The Users tab: newest signups first, 25 a page, with search. The only action is adding
// credits, within the daily limits the server checks ($10 a user, $50 in total).

const KEY = ['admin', 'users']

/** A value that settles after the user stops typing for a moment. */
const useSettled = <T,>(value: T, ms: number) => {
    const [settled, setSettled] = useState(value)
    useEffect(() => {
        const timer = setTimeout(() => setSettled(value), ms)
        return () => clearTimeout(timer)
    }, [value, ms])
    return settled
}

/** Up to 7 page buttons: 1 2 3 4 5 … 10, 1 … 4 5 6 … 10, or 1 … 6 7 8 9 10 */
const pageNumbers = (page: number, pages: number): Array<number | 'gap'> => {
    if (pages <= 7) return Array.from({ length: pages }, (_, i) => i + 1)
    if (page <= 4) return [1, 2, 3, 4, 5, 'gap', pages]
    if (page >= pages - 3) return [1, 'gap', pages - 4, pages - 3, pages - 2, pages - 1, pages]
    return [1, 'gap', page - 1, page, page + 1, 'gap', pages]
}

const pageButtonClass =
    'h-7 min-w-7 px-2 flex items-center justify-center gap-1 rounded-md border border-[#2B2A27] text-[12.5px] tabular-nums select-none'

/** "Showing 1–25 of 250 users", then Prev, the page numbers and Next */
const Pagination: React.FC<{
    page: number
    pages: number
    total: number
    onPage: (page: number) => void
}> = ({ page, pages, total, onPage }) => {
    if (total === 0) return null
    const first = (page - 1) * USERS_PAGE_SIZE + 1
    const last = Math.min(page * USERS_PAGE_SIZE, total)
    const edge = 'opacity-30 cursor-not-allowed text-[#7B7A79]'
    const live = 'text-[#B5B4AE] hover:bg-[#1F1F1F] hover:text-white cursor-pointer'

    return (
        <nav
            aria-label="Pages"
            className="flex flex-col sm:flex-row items-center justify-between gap-3 py-1"
        >
            <span className="text-[12.5px] text-[#7B7A79] tabular-nums">
                Showing <span className="text-[#D6D5C9]">{first}</span>–
                <span className="text-[#D6D5C9]">{last}</span> of{' '}
                <span className="text-[#D6D5C9]">{total}</span> users
            </span>
            <div className="flex items-center gap-1.5 shrink-0">
                <button
                    type="button"
                    aria-label="Previous page"
                    disabled={page <= 1}
                    onClick={() => onPage(page - 1)}
                    className={cn(pageButtonClass, page <= 1 ? edge : live)}
                >
                    <ChevronLeft className="w-3.5 h-3.5" strokeWidth={1.75} />
                    <span className="hidden sm:inline">Prev</span>
                </button>
                <span className="sm:hidden text-[12.5px] text-[#9A9998] px-2 tabular-nums">
                    Page <span className="text-[#EDEDED]">{page}</span> of {pages}
                </span>
                <div className="hidden sm:flex items-center gap-1.5">
                    {pageNumbers(page, pages).map((n, i) =>
                        n === 'gap' ? (
                            <span key={`gap-${i}`} className="px-1 text-[#5C5C5C] select-none">
                                …
                            </span>
                        ) : (
                            <button
                                key={n}
                                type="button"
                                aria-current={n === page ? 'page' : undefined}
                                onClick={() => onPage(n)}
                                className={cn(
                                    pageButtonClass,
                                    n === page
                                        ? 'bg-[#EDEDED] border-[#EDEDED] text-[#141414]'
                                        : live
                                )}
                            >
                                {n}
                            </button>
                        )
                    )}
                </div>
                <button
                    type="button"
                    aria-label="Next page"
                    disabled={page >= pages}
                    onClick={() => onPage(page + 1)}
                    className={cn(
                        pageButtonClass,
                        page >= pages ? edge : cn(live, 'bg-white/[0.04]')
                    )}
                >
                    <span className="hidden sm:inline">Next</span>
                    <ChevronRight className="w-3.5 h-3.5" strokeWidth={1.75} />
                </button>
            </div>
        </nav>
    )
}

type CreditTarget = Pick<AdminUserRow, 'id' | 'name' | 'email' | 'creditBalance'>

/** The add-credits popup: the amount only. The user gets an email and an inbox notification. */
const AddCreditsModal: React.FC<{ user: CreditTarget; onClose: () => void }> = ({
    user,
    onClose,
}) => {
    const [amount, setAmount] = useState('')
    const add = useAdminAction(
        (cents: number) => adminAPI.adjustCredits(user.id, cents),
        [KEY, ['admin', 'credit-ledger']]
    )
    const cents = Math.round(Number(amount) * 100)
    const canAdd = Number.isFinite(cents) && cents > 0

    return (
        <AdminDialog
            label={`Add credits for ${user.email}`}
            onClose={onClose}
            className="md:max-w-[340px]"
        >
            <form
                className="p-4 flex flex-col gap-3"
                onSubmit={(e) => {
                    e.preventDefault()
                    if (canAdd) add.mutate([cents], { onSuccess: onClose })
                }}
            >
                <div className="flex flex-col gap-0.5 min-w-0">
                    <span className="text-[15px] text-[#EDEDED]">Add credits</span>
                    <Muted className="truncate">
                        {user.name ? `${user.name} · ` : ''}
                        {user.email}
                    </Muted>
                    <Muted>Balance {money(user.creditBalance)}</Muted>
                </div>
                <input
                    aria-label="Dollars to add"
                    placeholder="$ 5"
                    inputMode="decimal"
                    autoFocus
                    value={amount}
                    onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ''))}
                    className={adminInputClass}
                />
                <ErrorLine error={add.error} />
                <div className="flex justify-end gap-2">
                    <AdminButton onClick={onClose}>Cancel</AdminButton>
                    <AdminButton type="submit" tone="primary" disabled={!canAdd || add.isPending}>
                        {canAdd ? `Add ${money(cents)}` : 'Add'}
                    </AdminButton>
                </div>
            </form>
        </AdminDialog>
    )
}

/** M2: reject a free credit request. Final, and the user reads the reason. */
const RejectModal: React.FC<{ user: AdminUserRow; requestId: string; onClose: () => void }> = ({
    user,
    requestId,
    onClose,
}) => {
    const [reason, setReason] = useState('')
    const reject = useAdminAction(
        (why: string) => adminAPI.rejectCreditRequest(requestId, why),
        [KEY, ['admin', 'overview']]
    )
    return (
        <AdminDialog
            label={`Reject the request of ${user.email}`}
            onClose={onClose}
            className="md:max-w-[380px]"
        >
            <form
                className="p-4 flex flex-col gap-3"
                onSubmit={(e) => {
                    e.preventDefault()
                    if (reason.trim()) reject.mutate([reason.trim()], { onSuccess: onClose })
                }}
            >
                <div className="flex flex-col gap-0.5 min-w-0">
                    <span className="text-[15px] text-[#EDEDED]">Reject request</span>
                    <Muted className="break-all">{user.email}</Muted>
                </div>
                <input
                    aria-label="Reason"
                    placeholder="Reason, the user sees it"
                    autoFocus
                    maxLength={500}
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    className={adminInputClass}
                />
                <ErrorLine error={reject.error} />
                <div className="flex justify-end gap-2">
                    <AdminButton onClick={onClose}>Cancel</AdminButton>
                    <AdminButton
                        type="submit"
                        tone="danger"
                        disabled={!reason.trim() || reject.isPending}
                    >
                        Reject
                    </AdminButton>
                </div>
            </form>
        </AdminDialog>
    )
}

/** M1: approve or reject, in place of Add credits on the Asked for credits view */
const RequestActions: React.FC<{ requestId: string; onReject: () => void }> = ({
    requestId,
    onReject,
}) => {
    const approve = useAdminAction(
        () => adminAPI.approveCreditRequest(requestId),
        [KEY, ['admin', 'credit-ledger'], ['admin', 'overview']]
    )
    return (
        <div className="flex flex-col items-end gap-1">
            <div className="flex justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                <AdminButton onClick={onReject}>Reject</AdminButton>
                <AdminButton
                    tone="primary"
                    disabled={approve.isPending}
                    onClick={() => approve.mutate([])}
                >
                    Approve $5
                </AdminButton>
            </div>
            <ErrorLine error={approve.error} />
        </div>
    )
}

/** The second line of a row: the request on Asked for credits, the message on Feedback. */
const RowDetail: React.FC<{ user: AdminUserRow; filter: AdminUserFilter }> = ({ user, filter }) => {
    const request = user.pendingRequest
    if (filter === 'asked' && request) {
        const { signals } = request
        return (
            <div className="flex flex-col gap-1 min-w-0">
                <span className="text-[13px] text-[#B5B4AE] break-words">{request.buildPlan}</span>
                <div className="flex flex-wrap items-center gap-1.5">
                    <Muted>Heard from: {request.heardFrom}</Muted>
                    <Tag>{signals.signupMethod}</Tag>
                    <Tag tone={signals.accountAgeDays < 1 ? 'warn' : 'plain'}>
                        {signals.accountAgeDays} days old
                    </Tag>
                    {signals.githubUsername && <Tag>@{signals.githubUsername}</Tag>}
                    {signals.otherAccountsSameInbox > 0 && (
                        <Tag tone="warn">
                            {signals.otherAccountsSameInbox} other accounts, same inbox
                        </Tag>
                    )}
                    {signals.otherRequestsSameIp > 0 && (
                        <Tag tone="warn">{signals.otherRequestsSameIp} other requests, same IP</Tag>
                    )}
                    <Muted>Sent {formatRelativeTime(request.createdAt)}</Muted>
                </div>
            </div>
        )
    }
    if (filter === 'feedback' && user.latestFeedback) {
        const note = user.latestFeedback
        return (
            <div className="flex flex-col gap-0.5 min-w-0">
                <span className="text-[13px] text-[#B5B4AE] break-words whitespace-pre-wrap">
                    {note.feedback}
                </span>
                <Muted>
                    {formatRelativeTime(note.createdAt)}
                    {note.rating ? ` · ${note.rating}` : ''}
                </Muted>
            </div>
        )
    }
    return null
}

/** the action of a row: approve or reject on Asked for credits, add credits otherwise */
const RowAction: React.FC<{
    user: AdminUserRow
    filter: AdminUserFilter
    onAdd: (user: AdminUserRow) => void
    onReject: (user: AdminUserRow, requestId: string) => void
}> = ({ user, filter, onAdd, onReject }) =>
    filter === 'asked' && user.pendingRequest ? (
        <RequestActions
            requestId={user.pendingRequest.id}
            onReject={() => onReject(user, user.pendingRequest!.id)}
        />
    ) : (
        <button
            type="button"
            onClick={(e) => {
                e.stopPropagation()
                onAdd(user)
            }}
            className="text-[12.5px] text-[#87B2F4] hover:text-[#A3C7FF] cursor-pointer whitespace-nowrap"
        >
            Add credits
        </button>
    )

/** a user on a phone: name and tags, the email, balance, last active and the action */
const PhoneRow: React.FC<{
    user: AdminUserRow
    filter: AdminUserFilter
    onOpen: (user: AdminUserRow) => void
    onAdd: (user: AdminUserRow) => void
    onReject: (user: AdminUserRow, requestId: string) => void
}> = ({ user, filter, onOpen, onAdd, onReject }) => (
    <li onClick={() => onOpen(user)} className="px-4 py-3 flex flex-col gap-2 cursor-pointer">
        <div className="flex items-start justify-between gap-3">
            <div className="flex flex-col gap-0.5 min-w-0 flex-1">
                <div className="flex items-center gap-1.5 min-w-0">
                    <button
                        type="button"
                        aria-label={`Details for ${user.email}`}
                        onClick={(e) => {
                            e.stopPropagation()
                            onOpen(user)
                        }}
                        className="text-left text-[14px] text-[#EDEDED] truncate cursor-pointer"
                    >
                        {user.name || user.email}
                    </button>
                    <UserTags createdAt={user.createdAt} disposable={user.disposable} />
                </div>
                <div className="flex items-center gap-0.5 min-w-0">
                    <span className="text-[12.5px] text-[#9A9998] truncate">{user.email}</span>
                    <CopyEmail email={user.email} />
                </div>
            </div>
            <span className="text-[13px] text-[#D6D5C9] font-mono shrink-0 pt-0.5">
                {money(user.creditBalance)}
            </span>
        </div>
        <div className="flex items-center justify-between gap-3">
            <Muted>
                {user.lastActiveAt
                    ? `Active ${formatRelativeTime(user.lastActiveAt)}`
                    : 'Never active'}
            </Muted>
            <RowAction user={user} filter={filter} onAdd={onAdd} onReject={onReject} />
        </div>
        <RowDetail user={user} filter={filter} />
    </li>
)

const FILTERS: Array<{ id: AdminUserFilter; label: string }> = [
    { id: 'all', label: 'All' },
    { id: 'active', label: 'Active this week' },
    { id: 'asked', label: 'Asked for credits' },
    { id: 'feedback', label: 'Feedback' },
]

/**
 * A5: copies "name, email, turn-off link" for every person with product emails on, ready to
 * paste into scripts/users.txt for announce.py. Nothing is shown on the page.
 */
const ProductEmailListButton: React.FC = () => {
    const [state, setState] = useState<'idle' | 'busy' | 'done' | 'failed'>('idle')
    const [count, setCount] = useState(0)
    const copy = async () => {
        setState('busy')
        try {
            const list = await adminAPI.getProductEmailList()
            await navigator.clipboard.writeText(list.text)
            setCount(list.count)
            setState('done')
        } catch (error) {
            console.error('[admin] product email list:', error)
            setState('failed')
        }
    }
    return (
        <AdminButton onClick={() => void copy()} disabled={state === 'busy'}>
            {state === 'done'
                ? `Copied ${count} ${count === 1 ? 'person' : 'people'}`
                : state === 'failed'
                  ? 'Could not copy, try again'
                  : 'Copy product-email list'}
        </AdminButton>
    )
}

/** The Users tab. The filter lives in the page address (#users/asked), so links can open it. */
export const AdminUsers: React.FC<{
    filter: AdminUserFilter
    onFilter: (filter: AdminUserFilter) => void
}> = ({ filter, onFilter: setFilter }) => {
    const [query, setQuery] = useState('')
    const [page, setPage] = useState(1)
    const [addingFor, setAddingFor] = useState<CreditTarget | null>(null)
    const [openUser, setOpenUser] = useState<AdminUserRow | null>(null)
    const [rejecting, setRejecting] = useState<{ user: AdminUserRow; requestId: string } | null>(
        null
    )
    const search = useSettled(query.trim(), 250)
    const isPhone = useIsPhone()
    const reject = (user: AdminUserRow, requestId: string) => setRejecting({ user, requestId })

    // a new search or filter starts at page 1
    useEffect(() => setPage(1), [search, filter])

    const { data, error, isLoading } = useQuery({
        queryKey: [...KEY, search, filter, page],
        queryFn: () => adminAPI.listUsers(search, page, filter),
        placeholderData: (previous) => previous,
    })
    // B3: after the last row of the last page is approved or rejected, go back a page
    // instead of showing "No users found" with users still waiting
    const lastPage = data?.pages
    useEffect(() => {
        if (lastPage && page > lastPage) setPage(lastPage)
    }, [lastPage, page])
    const { data: ledger } = useQuery({
        queryKey: ['admin', 'credit-ledger'],
        queryFn: adminAPI.getCreditLedger,
    })
    // the count on the Asked for credits chip, from the overview the page already loads
    const { data: overview } = useQuery({
        queryKey: ['admin', 'overview'],
        queryFn: () => adminAPI.getOverview(),
    })
    const waiting = overview?.needsYou?.pendingRequests ?? 0
    const leftToday = ledger ? Math.max(0, ledger.cap.capCents - ledger.cap.usedCents) : null

    return (
        <div className="flex flex-col gap-3">
            <div className="flex items-center gap-3 flex-wrap">
                <input
                    aria-label="Search users"
                    placeholder="Search by name or email"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    className={cn(adminInputClass, 'w-full md:w-[280px]')}
                />
                {ledger && leftToday !== null && (
                    <Muted className="md:ml-auto">
                        You can add {money(leftToday)} more today · up to{' '}
                        {money(ledger.cap.userCapCents)} a user
                    </Muted>
                )}
                <ProductEmailListButton />
            </div>

            {/* one row that scrolls sideways on a phone */}
            <div
                className="flex gap-1 overflow-x-auto [scrollbar-width:none] -mx-4 px-4 md:mx-0 md:px-0 md:flex-wrap"
                role="tablist"
                aria-label="Show"
            >
                {FILTERS.map((f) => (
                    <button
                        key={f.id}
                        type="button"
                        role="tab"
                        aria-selected={filter === f.id}
                        onClick={() => {
                            // the new filter starts at page 1 in the same click
                            setPage(1)
                            setFilter(f.id)
                        }}
                        className={cn(
                            'shrink-0 whitespace-nowrap px-2.5 py-1 rounded-md text-[12.5px] cursor-pointer',
                            filter === f.id
                                ? 'bg-[#262625] text-[#EDEDED]'
                                : 'text-[#9A9998] hover:text-[#D6D5C9]'
                        )}
                    >
                        {f.label}
                        {f.id === 'asked' && waiting > 0 && (
                            <span className="ml-1.5 text-[11px] px-1.5 rounded-full bg-[#3A2A14] text-[#F2C07B] tabular-nums">
                                {waiting}
                            </span>
                        )}
                    </button>
                ))}
            </div>

            <ErrorLine error={error} />
            {isLoading && !data ? (
                <AdminSkeleton rows={8} />
            ) : isPhone ? (
                <ul className="bg-[#191919] border border-[#242323] rounded-xl flex flex-col divide-y divide-[#242323]">
                    {(data?.items ?? []).length === 0 && (
                        <li className="px-4 py-6 text-[13px] text-[#7B7A79]">No users found</li>
                    )}
                    {(data?.items ?? []).map((user) => (
                        <PhoneRow
                            key={user.id}
                            user={user}
                            filter={filter}
                            onOpen={setOpenUser}
                            onAdd={setAddingFor}
                            onReject={reject}
                        />
                    ))}
                </ul>
            ) : (
                <div className="bg-[#191919] border border-[#242323] rounded-xl overflow-x-auto">
                    <table className="w-full text-[13px]">
                        <thead>
                            <tr className="text-left text-[12px] text-[#7B7A79]">
                                <th className="font-normal px-4 py-2.5">Name</th>
                                <th className="font-normal px-3 py-2.5">Email</th>
                                <th className="font-normal px-3 py-2.5 whitespace-nowrap">
                                    Last active
                                </th>
                                <th className="font-normal px-3 py-2.5 text-right">Balance</th>
                                <th className="px-4 py-2.5" />
                            </tr>
                        </thead>
                        <tbody>
                            {(data?.items ?? []).length === 0 && (
                                <tr>
                                    <td colSpan={5} className="px-4 py-6 text-[#7B7A79]">
                                        No users found
                                    </td>
                                </tr>
                            )}
                            {(data?.items ?? []).map((user) => (
                                <React.Fragment key={user.id}>
                                    <tr
                                        onClick={() => setOpenUser(user)}
                                        className="border-t border-[#242323] text-[#D6D5C9] cursor-pointer hover:bg-[#1D1D1D]"
                                    >
                                        <td className="px-4 py-2.5 whitespace-nowrap max-w-[200px] truncate">
                                            <button
                                                type="button"
                                                aria-label={`Details for ${user.email}`}
                                                onClick={(e) => {
                                                    e.stopPropagation()
                                                    setOpenUser(user)
                                                }}
                                                className="text-left cursor-pointer hover:text-white"
                                            >
                                                {user.name || '-'}
                                            </button>
                                        </td>
                                        <td className="px-3 py-2.5">
                                            <div className="flex items-center gap-1.5 flex-wrap">
                                                <span className="break-all">{user.email}</span>
                                                <CopyEmail email={user.email} />
                                                <UserTags
                                                    createdAt={user.createdAt}
                                                    disposable={user.disposable}
                                                />
                                            </div>
                                        </td>
                                        <td className="px-3 py-2.5 whitespace-nowrap text-[#9A9998]">
                                            {user.lastActiveAt
                                                ? formatRelativeTime(user.lastActiveAt)
                                                : 'never'}
                                        </td>
                                        <td className="px-3 py-2.5 text-right font-mono whitespace-nowrap">
                                            {money(user.creditBalance)}
                                        </td>
                                        <td className="px-4 py-2.5 text-right">
                                            <RowAction
                                                user={user}
                                                filter={filter}
                                                onAdd={setAddingFor}
                                                onReject={reject}
                                            />
                                        </td>
                                    </tr>
                                    {((filter === 'asked' && user.pendingRequest) ||
                                        (filter === 'feedback' && user.latestFeedback)) && (
                                        <tr
                                            onClick={() => setOpenUser(user)}
                                            className="text-[#D6D5C9] cursor-pointer hover:bg-[#1D1D1D]"
                                        >
                                            <td colSpan={5} className="px-4 pb-3 pt-0">
                                                <RowDetail user={user} filter={filter} />
                                            </td>
                                        </tr>
                                    )}
                                </React.Fragment>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {data && (
                <Pagination page={page} pages={data.pages} total={data.total} onPage={setPage} />
            )}
            {openUser && (
                <AdminUserCard
                    userId={openUser.id}
                    email={openUser.email}
                    onClose={() => setOpenUser(null)}
                />
            )}
            {rejecting && (
                <RejectModal
                    user={rejecting.user}
                    requestId={rejecting.requestId}
                    onClose={() => setRejecting(null)}
                />
            )}
            {addingFor && <AddCreditsModal user={addingFor} onClose={() => setAddingFor(null)} />}
        </div>
    )
}
