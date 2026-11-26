import { useQuery, useQueryClient } from '@tanstack/react-query'
import React, { Component, useEffect, useState } from 'react'

import { adminAPI, type AdminUserFilter } from '../api/admin'

import { AdminAnalytics } from './AdminAnalytics'
import { AdminCodeGate, ME_KEY, isCodeError } from './AdminCode'
import { AdminOverview, type AdminOpen, type AdminTabId } from './AdminOverview'
import { AdminSystem } from './AdminSystem'
import { AdminButton } from './AdminUi'
import { AdminUsers } from './AdminUsers'

import { pageTitleClass } from '@/features/profile/components/settingsStyles'
import { ApiError } from '@/shared/api/client'
import { cn } from '@/shared/lib/utils'

const TABS: Array<{ id: AdminTabId; label: string }> = [
    { id: 'overview', label: 'Overview' },
    { id: 'users', label: 'Users' },
    { id: 'analytics', label: 'Analytics' },
    { id: 'system', label: 'System' },
]

const FILTERS: AdminUserFilter[] = ['all', 'active', 'asked', 'feedback']

/**
 * The tab and the Users filter from the address: #users/asked. The old #credits and
 * #feedback links (inbox notices sent before M5) open the matching Users filter.
 */
const readHash = (): { tab: AdminTabId; filter: AdminUserFilter } => {
    const [head = '', rest = ''] = window.location.hash.replace('#', '').split('/')
    if (head === 'credits') return { tab: 'users', filter: 'asked' }
    if (head === 'feedback') return { tab: 'users', filter: 'feedback' }
    const tab = TABS.find((t) => t.id === head)?.id ?? 'overview'
    const filter = FILTERS.find((f) => f === rest) ?? 'all'
    return { tab, filter }
}

const TabBody: React.FC<{
    tab: AdminTabId
    filter: AdminUserFilter
    onOpen: AdminOpen
}> = ({ tab, filter, onOpen }) => {
    switch (tab) {
        case 'users':
            return <AdminUsers filter={filter} onFilter={(next) => onOpen('users', next)} />
        case 'analytics':
            return <AdminAnalytics />
        case 'system':
            return <AdminSystem />
        default:
            return <AdminOverview onOpen={onOpen} />
    }
}

/** B7: one section that fails to draw shows a short line, not a blank admin page */
class SectionBoundaryClass extends Component<{ children: React.ReactNode }, { failed: boolean }> {
    declare readonly props: Readonly<{ children: React.ReactNode }>
    state = { failed: false }

    static getDerivedStateFromError() {
        return { failed: true }
    }

    componentDidCatch(error: unknown) {
        console.error('[admin] a section failed to draw', error)
    }

    render() {
        if (!this.state.failed) return this.props.children
        return (
            <p role="alert" className="text-[13px] text-red-400">
                This section could not be shown. Refresh the page to try again.
            </p>
        )
    }
}

// two copies of the React types are installed (the app's 18 and the repo root's 19), and
// they disagree about class components in JSX; this one is plain React 18 at runtime
const SectionBoundary = SectionBoundaryClass as unknown as React.FC<{ children: React.ReactNode }>

/**
 * B4: when the server says the code is needed again (its 12 hours ran out, or it was reset),
 * reload /me so the code screen comes back, instead of errors on every tab. Also reload it the
 * moment the 12 hours end, by the server's time.
 */
const useCodeExpiry = (verifiedUntil: Date | null) => {
    const queryClient = useQueryClient()
    useEffect(() => {
        const recheck = (error: unknown) => {
            if (isCodeError(error)) void queryClient.invalidateQueries({ queryKey: ME_KEY })
        }
        const stopQueries = queryClient.getQueryCache().subscribe((event) => {
            if (event.type === 'updated' && event.action.type === 'error') {
                recheck(event.action.error)
            }
        })
        const stopMutations = queryClient.getMutationCache().subscribe((event) => {
            if (event.type === 'updated' && event.action.type === 'error') {
                recheck(event.action.error)
            }
        })
        return () => {
            stopQueries()
            stopMutations()
        }
    }, [queryClient])

    const until = verifiedUntil?.getTime() ?? null
    useEffect(() => {
        if (until === null) return
        const wait = until - Date.now() + 1000
        if (wait <= 0 || wait > 2 ** 31 - 1) return
        const timer = setTimeout(
            () => void queryClient.invalidateQueries({ queryKey: ME_KEY }),
            wait
        )
        return () => clearTimeout(timer)
    }, [until, queryClient])
}

/** the server answers 404 to anyone who is not the admin */
const isHidden = (error: unknown) => error instanceof ApiError && error.status === 404

/**
 * The admin panel, full screen. Only the admin is told its path (profile.adminPath); the
 * server checks the sign-in, ADMIN_EMAILS and the authenticator code on every call.
 */
export const AdminPage: React.FC = () => {
    const [{ tab, filter }, setView] = useState(readHash)
    const {
        data: me,
        error,
        isLoading,
        isFetching: meFetching,
        refetch: refetchMe,
    } = useQuery({
        queryKey: ME_KEY,
        queryFn: adminAPI.getMe,
        // B5: the 404 means "not the admin" and is final; a network or server error is tried
        // again before it shows
        retry: (count, err) => !isHidden(err) && count < 2,
    })
    const verifiedUntil = me?.totp.verifiedUntil ? new Date(me.totp.verifiedUntil) : null
    const isVerified = Boolean(verifiedUntil && verifiedUntil.getTime() > Date.now())
    useCodeExpiry(verifiedUntil)

    const { data: overview } = useQuery({
        queryKey: ['admin', 'overview'],
        queryFn: () => adminAPI.getOverview(),
        enabled: isVerified,
    })
    const badges: Partial<Record<AdminTabId, number>> = {
        users: overview?.needsYou?.pendingRequests,
    }

    const selectTab: AdminOpen = (id, nextFilter = 'all') => {
        setView({ tab: id, filter: nextFilter })
        const suffix = id === 'users' && nextFilter !== 'all' ? `/${nextFilter}` : ''
        // the full path: index.html has <base href="/">, so a bare "#users" would become
        // "/#users", the home page. Keep the router's history state as well
        const { pathname, search } = window.location
        window.history.replaceState(window.history.state, '', `${pathname}${search}#${id}${suffix}`)
    }

    return (
        <div className="fixed inset-0 overflow-y-auto bg-[#141414] text-[#D6D5C9] font-sans">
            <div className="mx-auto w-full max-w-[1040px] px-4 md:px-6 py-5 md:py-8 flex flex-col gap-5">
                <div className="flex items-center gap-2">
                    <h1 className={cn(pageTitleClass, 'mb-0')}>Admin</h1>
                </div>

                {isLoading ? null : !me && isHidden(error) ? (
                    <p className="text-[13px] text-[#9A9998]">This page is for admins only.</p>
                ) : !me ? (
                    // B5: a server or network error is not "you are not the admin"
                    <div className="flex items-center gap-3 flex-wrap">
                        <p role="alert" className="text-[13px] text-red-400">
                            {(error as Error)?.message || 'Could not load the admin panel'}
                        </p>
                        <AdminButton disabled={meFetching} onClick={() => void refetchMe()}>
                            Try again
                        </AdminButton>
                    </div>
                ) : !isVerified ? (
                    <AdminCodeGate me={me} />
                ) : (
                    <>
                        {/* U3: the tabs stay at the top while a long tab scrolls */}
                        <nav
                            aria-label="Admin sections"
                            className="sticky top-0 z-20 flex gap-1 overflow-x-auto -mx-4 px-4 md:-mx-6 md:px-6 py-2 bg-[#141414] [scrollbar-width:none]"
                        >
                            {TABS.map((t) => (
                                <button
                                    key={t.id}
                                    type="button"
                                    onClick={() => selectTab(t.id)}
                                    aria-current={t.id === tab ? 'page' : undefined}
                                    className={cn(
                                        'shrink-0 px-3 py-1.5 rounded-lg text-[13px] transition-colors cursor-pointer flex items-center gap-1.5',
                                        t.id === tab
                                            ? 'bg-[#262625] text-[#EDEDED]'
                                            : 'text-[#9A9998] hover:text-[#D6D5C9] hover:bg-[#1F1F1F]'
                                    )}
                                >
                                    {t.label}
                                    {(badges[t.id] ?? 0) > 0 && (
                                        <span className="text-[11px] px-1.5 rounded-full bg-[#3A2A14] text-[#F2C07B] tabular-nums">
                                            {badges[t.id]}
                                        </span>
                                    )}
                                </button>
                            ))}
                        </nav>
                        <div className="flex flex-col gap-4">
                            {/* a new tab starts with a fresh boundary */}
                            <SectionBoundary key={tab}>
                                <TabBody tab={tab} filter={filter} onOpen={selectTab} />
                            </SectionBoundary>
                        </div>
                    </>
                )}
            </div>
        </div>
    )
}
