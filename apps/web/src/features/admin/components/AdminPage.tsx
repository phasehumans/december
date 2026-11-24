import { useQuery } from '@tanstack/react-query'
import { ChevronLeft } from 'lucide-react'
import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { adminAPI } from '../api/admin'

import { AdminAnnouncements } from './AdminAnnouncements'
import { AdminCreditRequests } from './AdminCreditRequests'
import { AdminFeedback } from './AdminFeedback'
import { AdminInstallations } from './AdminInstallations'
import { AdminRedeemCodes } from './AdminRedeemCodes'
import { AdminSandboxes } from './AdminSandboxes'
import { AdminList, AdminRow, AdminSection, ErrorLine, Muted, shortDate } from './AdminUi'
import { AdminUsers } from './AdminUsers'

import { pageTitleClass } from '@/features/profile/components/settingsStyles'
import { cn } from '@/shared/lib/utils'

const AuditLog: React.FC = () => {
    const { data, error } = useQuery({
        queryKey: ['admin', 'audit-log'],
        queryFn: adminAPI.listAuditLog,
    })
    return (
        <AdminSection title="Audit log">
            <ErrorLine error={error} />
            <AdminList empty="No admin actions yet">
                {(data?.items ?? []).map((entry) => (
                    <AdminRow key={entry.id}>
                        <div className="flex flex-col gap-0.5 min-w-0">
                            <span className="text-[13.5px] text-[#D6D5C9]">{entry.action}</span>
                            <Muted className="break-all">
                                {entry.targetType} {entry.targetId ?? ''}{' '}
                                {entry.metadata ? JSON.stringify(entry.metadata) : ''}
                            </Muted>
                        </div>
                        <Muted>{shortDate(entry.createdAt)}</Muted>
                    </AdminRow>
                ))}
            </AdminList>
        </AdminSection>
    )
}

// #624 part 3 sections, in the suggested build order
const TABS = [
    { id: 'requests', label: 'Requests', render: () => <AdminCreditRequests /> },
    { id: 'feedback', label: 'Feedback', render: () => <AdminFeedback /> },
    { id: 'users', label: 'Users', render: () => <AdminUsers /> },
    { id: 'emails', label: 'Emails', render: () => <AdminAnnouncements /> },
    { id: 'codes', label: 'Codes', render: () => <AdminRedeemCodes /> },
    { id: 'github', label: 'GitHub', render: () => <AdminInstallations /> },
    { id: 'sandboxes', label: 'Sandboxes', render: () => <AdminSandboxes /> },
    { id: 'log', label: 'Log', render: () => <AuditLog /> },
] as const

type TabId = (typeof TABS)[number]['id']

/** app.trydecember.com/admin: full screen, only for accounts in ADMIN_EMAILS */
export const AdminPage: React.FC = () => {
    const navigate = useNavigate()
    const [tab, setTab] = useState<TabId>(() => {
        const hash = window.location.hash.replace('#', '')
        return (TABS.find((t) => t.id === hash)?.id ?? 'requests') as TabId
    })
    const {
        data: me,
        error,
        isLoading,
    } = useQuery({
        queryKey: ['admin', 'me'],
        queryFn: adminAPI.getMe,
        retry: false,
    })

    const selectTab = (id: TabId) => {
        setTab(id)
        window.history.replaceState(null, '', `#${id}`)
    }

    const active = TABS.find((t) => t.id === tab) ?? TABS[0]

    return (
        <div className="fixed inset-0 overflow-y-auto bg-[#141414] text-[#D6D5C9] font-sans">
            <div className="mx-auto w-full max-w-[920px] px-4 md:px-6 py-5 md:py-8 flex flex-col gap-5">
                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={() => navigate('/')}
                        aria-label="Back"
                        className="-ml-1.5 p-1 rounded-md text-[#9A9998] hover:text-[#D6D5C9] hover:bg-[#1F1F1F] cursor-pointer"
                    >
                        <ChevronLeft className="w-5 h-5" strokeWidth={1.75} />
                    </button>
                    <h1 className={cn(pageTitleClass, 'mb-0')}>Admin</h1>
                    {me?.email && <Muted className="ml-auto truncate">{me.email}</Muted>}
                </div>

                {isLoading ? null : error ? (
                    <p className="text-[13px] text-[#9A9998]">This page is for admins only.</p>
                ) : (
                    <>
                        <nav
                            aria-label="Admin sections"
                            className="flex gap-1 overflow-x-auto -mx-4 px-4 md:mx-0 md:px-0 [scrollbar-width:none]"
                        >
                            {TABS.map((t) => (
                                <button
                                    key={t.id}
                                    type="button"
                                    onClick={() => selectTab(t.id)}
                                    aria-current={t.id === tab ? 'page' : undefined}
                                    className={cn(
                                        'shrink-0 px-3 py-1.5 rounded-lg text-[13px] transition-colors cursor-pointer',
                                        t.id === tab
                                            ? 'bg-[#262625] text-[#EDEDED]'
                                            : 'text-[#9A9998] hover:text-[#D6D5C9] hover:bg-[#1F1F1F]'
                                    )}
                                >
                                    {t.label}
                                </button>
                            ))}
                        </nav>
                        <div className="flex flex-col gap-6">{active.render()}</div>
                    </>
                )}
            </div>
        </div>
    )
}
