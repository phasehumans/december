import { useQuery } from '@tanstack/react-query'
import React, { useMemo, useState } from 'react'

import { adminAPI, type AdminSandbox } from '../api/admin'

import {
    AdminButton,
    AdminList,
    AdminRow,
    AdminSection,
    ErrorLine,
    Muted,
    Tag,
    money,
    shortDate,
    useAdminAction,
} from './AdminUi'

import { SettingsSelect } from '@/features/profile/components/SettingsUi'

const KEY = ['admin', 'sandboxes']

const SandboxRow: React.FC<{ sandbox: AdminSandbox }> = ({ sandbox }) => {
    const control = useAdminAction(
        (action: 'pause' | 'stop') => adminAPI.controlSandbox(sandbox.sessionId, action),
        [KEY]
    )
    const isRunning = sandbox.sandboxStatus !== 'PAUSED'

    return (
        <AdminRow>
            <div className="flex flex-col gap-0.5 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[14px] text-[#D6D5C9] break-all">{sandbox.email}</span>
                    <Tag tone={isRunning ? 'ok' : 'plain'}>
                        {sandbox.sandboxStatus.toLowerCase()}
                    </Tag>
                    {sandbox.agentWorking && <Tag tone="warn">agent working</Tag>}
                    {isRunning && <Tag>{sandbox.userRunningCount} running for this user</Tag>}
                </div>
                <Muted className="break-all">
                    {sandbox.title ?? 'Untitled'} · {sandbox.sandboxId} · last activity{' '}
                    {shortDate(sandbox.lastActivityAt)}
                </Muted>
                <ErrorLine error={control.error} />
            </div>
            <div className="flex items-center gap-2">
                {isRunning && (
                    <AdminButton
                        disabled={control.isPending}
                        onClick={() => control.mutate(['pause'])}
                    >
                        Pause
                    </AdminButton>
                )}
                <AdminButton
                    tone="danger"
                    disabled={control.isPending}
                    onClick={() => control.mutate(['stop'])}
                >
                    Stop
                </AdminButton>
            </div>
        </AdminRow>
    )
}

const DailyUsage: React.FC = () => {
    const [days, setDays] = useState('7')
    const { data, error } = useQuery({
        queryKey: ['admin', 'usage', days],
        queryFn: () => adminAPI.dailyUsage(Number(days)),
    })

    const byDay = useMemo(() => {
        const groups = new Map<string, NonNullable<typeof data>['items']>()
        for (const row of data?.items ?? []) {
            const day = new Date(row.day).toLocaleDateString(undefined, {
                month: 'short',
                day: 'numeric',
            })
            groups.set(day, [...(groups.get(day) ?? []), row])
        }
        return Array.from(groups.entries())
    }, [data])

    return (
        <AdminSection
            title="Cost per model"
            action={
                <SettingsSelect
                    label="Days"
                    value={days}
                    onChange={setDays}
                    options={[
                        { value: '1', label: 'Today' },
                        { value: '7', label: '7 days' },
                        { value: '30', label: '30 days' },
                    ]}
                />
            }
        >
            <ErrorLine error={error} />
            <AdminList empty="No usage">
                {byDay.map(([day, rows]) => (
                    <AdminRow key={day} className="flex-col !items-stretch">
                        <div className="flex items-center justify-between">
                            <span className="text-[14px] text-[#D6D5C9]">{day}</span>
                            <span className="font-mono text-[13px] text-[#D6D5C9]">
                                {money(
                                    rows
                                        .filter((row) => row.billingSource === 'CREDITS')
                                        .reduce((sum, row) => sum + row.costInCents, 0)
                                )}
                            </span>
                        </div>
                        {rows.map((row) => (
                            <div
                                key={`${row.model}-${row.billingSource}`}
                                className="flex items-center justify-between gap-3 text-[12.5px]"
                            >
                                <Muted className="truncate">
                                    {row.model}
                                    {row.billingSource === 'OWN_KEY' ? ' (own key)' : ''} ·{' '}
                                    {row.events} calls
                                </Muted>
                                <span className="font-mono text-[#B5B4AE]">
                                    {money(row.costInCents)}
                                </span>
                            </div>
                        ))}
                    </AdminRow>
                ))}
            </AdminList>
        </AdminSection>
    )
}

export const AdminSandboxes: React.FC = () => {
    const { data, error, isLoading } = useQuery({
        queryKey: KEY,
        queryFn: adminAPI.listSandboxes,
        refetchInterval: 30 * 1000,
    })

    return (
        <>
            <AdminSection title="Sandboxes">
                <ErrorLine error={error} />
                {!isLoading && (
                    <AdminList empty="No sandboxes">
                        {(data?.items ?? []).map((sandbox) => (
                            <SandboxRow key={sandbox.sessionId} sandbox={sandbox} />
                        ))}
                    </AdminList>
                )}
            </AdminSection>
            <DailyUsage />
        </>
    )
}
