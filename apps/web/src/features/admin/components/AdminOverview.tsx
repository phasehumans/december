import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ChevronRight } from 'lucide-react'
import React from 'react'

import { adminAPI, type AdminUserFilter } from '../api/admin'

import { AdminSection, AdminSkeleton, ErrorLine, RefreshLine, money } from './AdminUi'

export type AdminTabId = 'overview' | 'users' | 'analytics' | 'system'

/** opens a tab; for Users, optionally with a filter (asked for credits, feedback) */
export type AdminOpen = (tab: AdminTabId, filter?: AdminUserFilter) => void

const Stat: React.FC<{ label: string; value: React.ReactNode; hint: string }> = ({
    label,
    value,
    hint,
}) => (
    <div className="flex flex-col gap-1 min-w-0">
        <span className="text-[12px] text-[#7B7A79] truncate">{label}</span>
        <span className="text-[20px] leading-tight text-[#EDEDED] tabular-nums truncate">
            {value}
        </span>
        <span className="text-[11.5px] text-[#7B7A79] truncate">{hint}</span>
    </div>
)

/**
 * V1: today's numbers in one long card, and the things waiting for the admin. The history
 * of these numbers is the chart on Analytics; the system's state is on System.
 */
export const AdminOverview: React.FC<{ onOpen: AdminOpen }> = ({ onOpen }) => {
    const queryClient = useQueryClient()
    const { data, error, dataUpdatedAt, isFetching } = useQuery({
        queryKey: ['admin', 'overview'],
        queryFn: () => adminAPI.getOverview(),
    })
    // U5: skip the server's 60-second cache
    const refresh = useMutation({
        mutationFn: () => adminAPI.getOverview(true),
        onSuccess: (fresh) => queryClient.setQueryData(['admin', 'overview'], fresh),
    })

    if (error) return <ErrorLine error={error} />
    if (!data) return <AdminSkeleton rows={4} />

    const needs = [
        {
            label: 'Credit requests waiting',
            count: data.needsYou.pendingRequests,
            tab: 'users' as const,
            filter: 'asked' as const,
        },
        {
            label: 'Feedback this week',
            count: data.needsYou.feedbackWeek,
            tab: 'users' as const,
            filter: 'feedback' as const,
        },
        {
            label: 'Failed jobs, 24 hours',
            count: data.needsYou.failedJobsDay,
            tab: 'system' as const,
            filter: undefined,
        },
    ]

    return (
        <>
            <RefreshLine
                updatedAt={dataUpdatedAt}
                isFetching={isFetching || refresh.isPending}
                onRefresh={() => refresh.mutate()}
            />
            <ErrorLine error={refresh.error} />
            <section
                aria-label="Today"
                className="bg-[#191919] border border-[#242323] rounded-xl px-4 py-4 grid grid-cols-2 md:grid-cols-5 gap-x-6 gap-y-5"
            >
                <Stat
                    label="Signups today"
                    value={data.signupsToday}
                    hint={`${data.signups7d} in 7 days`}
                />
                <Stat
                    label="Active users, 24 hours"
                    value={data.activeDay}
                    hint="ran the agent at least once"
                />
                <Stat
                    label="Agents working now"
                    value={data.agentsWorking}
                    hint={`${data.sandboxesRunning} sandboxes running`}
                />
                <Stat
                    label="Credits used today"
                    value={money(data.creditsSpentTodayCents)}
                    hint="India time"
                />
                <Stat label="Paid, 30 days" value={money(data.paid30dCents)} hint="Razorpay" />
            </section>

            <AdminSection title="Needs you">
                <div className="bg-[#191919] border border-[#242323] rounded-xl overflow-hidden flex flex-col divide-y divide-[#242323]">
                    {needs.map((item) => (
                        <button
                            key={item.label}
                            type="button"
                            onClick={() => onOpen(item.tab, item.filter)}
                            className="px-4 py-2.5 flex items-center justify-between gap-3 text-left hover:bg-[#1E1E1E] cursor-pointer"
                        >
                            <span className="text-[13.5px] text-[#D6D5C9]">{item.label}</span>
                            <span className="flex items-center gap-2">
                                <span
                                    className={
                                        item.count > 0
                                            ? 'text-[13.5px] text-[#F2C07B] tabular-nums'
                                            : 'text-[13.5px] text-[#7B7A79] tabular-nums'
                                    }
                                >
                                    {item.count}
                                </span>
                                <ChevronRight
                                    className="w-4 h-4 text-[#5A5958]"
                                    strokeWidth={1.75}
                                />
                            </span>
                        </button>
                    ))}
                </div>
            </AdminSection>
        </>
    )
}
