import { useQuery } from '@tanstack/react-query'
import React, { useState } from 'react'

import { adminAPI, type AdminSandbox } from '../api/admin'

import {
    AdminButton,
    AdminList,
    AdminRow,
    AdminSection,
    ErrorLine,
    Muted,
    Tag,
    shortDate,
    useAdminAction,
} from './AdminUi'

const KEY = ['admin', 'sandboxes']

const SandboxRow: React.FC<{ sandbox: AdminSandbox }> = ({ sandbox }) => {
    // B2: the health counts change too
    const control = useAdminAction(
        (action: 'pause' | 'stop') => adminAPI.controlSandbox(sandbox.sessionId, action),
        [KEY, ['admin', 'health']]
    )
    // B2: Stop asks first; after a pause or stop is sent, the row says so until the worker
    // has done it, so a second click can't queue it again
    const [confirmStop, setConfirmStop] = useState(false)
    const [sent, setSent] = useState<'pause' | 'stop' | null>(null)
    const send = (action: 'pause' | 'stop') =>
        control.mutate([action], {
            onSuccess: () => {
                setSent(action)
                setConfirmStop(false)
            },
        })
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
                {/* B12: no session titles, only ids */}
                <Muted className="break-all">
                    Session {sandbox.sessionId.slice(0, 8)} · {sandbox.sandboxId} · last activity{' '}
                    {shortDate(sandbox.lastActivityAt)}
                </Muted>
                <ErrorLine error={control.error} />
            </div>
            <div className="flex items-center gap-2">
                {sent ? (
                    <Muted>{sent === 'stop' ? 'Stopping…' : 'Pausing…'}</Muted>
                ) : confirmStop ? (
                    <>
                        <Muted>
                            {sandbox.agentWorking
                                ? 'The agent is working. Stop it?'
                                : 'Stop this sandbox?'}
                        </Muted>
                        <AdminButton onClick={() => setConfirmStop(false)}>No</AdminButton>
                        <AdminButton
                            tone="danger"
                            disabled={control.isPending}
                            onClick={() => send('stop')}
                        >
                            Stop
                        </AdminButton>
                    </>
                ) : (
                    <>
                        {isRunning && (
                            <AdminButton disabled={control.isPending} onClick={() => send('pause')}>
                                Pause
                            </AdminButton>
                        )}
                        <AdminButton
                            tone="danger"
                            disabled={control.isPending}
                            onClick={() => setConfirmStop(true)}
                        >
                            Stop
                        </AdminButton>
                    </>
                )}
            </div>
        </AdminRow>
    )
}

export const AdminSandboxes: React.FC<{
    counts?: { starting: number; running: number; paused: number }
}> = ({ counts }) => {
    const { data, error, isLoading } = useQuery({
        queryKey: KEY,
        queryFn: adminAPI.listSandboxes,
    })

    return (
        <AdminSection title="Sandboxes">
            {counts && (
                <Muted>
                    {counts.running} running · {counts.starting} starting · {counts.paused} paused
                </Muted>
            )}
            <ErrorLine error={error} />
            {!isLoading && (
                <AdminList empty="No sandboxes running">
                    {/* Y7: only the ones costing money now; paused ones keep their files and cost nothing */}
                    {(data?.items ?? [])
                        .filter((sandbox) => sandbox.sandboxStatus !== 'PAUSED')
                        .map((sandbox) => (
                            <SandboxRow key={sandbox.sessionId} sandbox={sandbox} />
                        ))}
                </AdminList>
            )}
        </AdminSection>
    )
}
