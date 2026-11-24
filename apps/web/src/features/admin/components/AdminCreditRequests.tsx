import { useQuery } from '@tanstack/react-query'
import React, { useState } from 'react'

import { adminAPI, type AdminCreditRequest, type CreditRequestStatus } from '../api/admin'

import {
    AdminButton,
    AdminList,
    AdminRow,
    AdminSection,
    ErrorLine,
    Muted,
    Tag,
    adminInputClass,
    shortDate,
    useAdminAction,
} from './AdminUi'

import { SettingsSelect } from '@/features/profile/components/SettingsUi'

const KEY = ['admin', 'credit-requests']

const RequestRow: React.FC<{ request: AdminCreditRequest }> = ({ request }) => {
    const [reason, setReason] = useState('')
    const [rejecting, setRejecting] = useState(false)
    const approve = useAdminAction((id: string) => adminAPI.approveCreditRequest(id), [KEY])
    const reject = useAdminAction(
        (id: string, why: string) => adminAPI.rejectCreditRequest(id, why),
        [KEY]
    )
    const { signals } = request

    return (
        <AdminRow>
            <div className="flex flex-col gap-1 min-w-0 flex-1 basis-[320px]">
                <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[14px] text-[#D6D5C9] break-all">
                        {request.email ?? request.normalizedEmail}
                    </span>
                    {request.status !== 'PENDING' && (
                        <Tag tone={request.status === 'APPROVED' ? 'ok' : 'warn'}>
                            {request.status.toLowerCase()}
                        </Tag>
                    )}
                </div>
                <span className="text-[13px] text-[#B5B4AE]">{request.buildPlan}</span>
                <Muted>Heard from: {request.heardFrom}</Muted>
                <div className="flex flex-wrap gap-1.5 mt-0.5">
                    <Tag>{signals.signupMethod ?? 'deleted'}</Tag>
                    <Tag tone={(signals.accountAgeDays ?? 0) < 1 ? 'warn' : 'plain'}>
                        {signals.accountAgeDays ?? '-'} days old
                    </Tag>
                    {signals.githubUsername && <Tag>@{signals.githubUsername}</Tag>}
                    {signals.disposableEmail && <Tag tone="warn">throwaway inbox</Tag>}
                    {signals.accountDeleted && <Tag tone="warn">account deleted</Tag>}
                    {signals.otherAccountsSameInbox > 0 && (
                        <Tag tone="warn">
                            {signals.otherAccountsSameInbox} other accounts, same inbox
                        </Tag>
                    )}
                    {signals.otherRequestsSameIp > 0 && (
                        <Tag tone="warn">{signals.otherRequestsSameIp} other requests, same ip</Tag>
                    )}
                    {signals.ipAddress && <Tag>{signals.ipAddress}</Tag>}
                    {request.status === 'APPROVED' && (
                        <Tag tone={signals.feedbackCount > 0 ? 'ok' : 'warn'}>
                            {signals.feedbackCount > 0 ? 'gave feedback' : 'owes feedback'}
                        </Tag>
                    )}
                </div>
                <Muted>
                    Sent {shortDate(request.createdAt)}
                    {request.rejectReason ? ` · ${request.rejectReason}` : ''}
                </Muted>
                <ErrorLine error={approve.error || reject.error} />
            </div>

            {request.status === 'PENDING' && (
                <div className="flex items-center gap-2 flex-wrap">
                    {rejecting ? (
                        <>
                            <input
                                aria-label="Reason"
                                placeholder="Reason"
                                value={reason}
                                onChange={(e) => setReason(e.target.value)}
                                className={adminInputClass}
                            />
                            <AdminButton
                                tone="danger"
                                disabled={!reason.trim() || reject.isPending}
                                onClick={() => reject.mutate([request.id, reason.trim()])}
                            >
                                Reject
                            </AdminButton>
                            <AdminButton onClick={() => setRejecting(false)}>Cancel</AdminButton>
                        </>
                    ) : (
                        <>
                            <AdminButton onClick={() => setRejecting(true)}>Reject</AdminButton>
                            <AdminButton
                                tone="primary"
                                disabled={approve.isPending}
                                onClick={() => approve.mutate([request.id])}
                            >
                                Approve $5
                            </AdminButton>
                        </>
                    )}
                </div>
            )}
        </AdminRow>
    )
}

export const AdminCreditRequests: React.FC = () => {
    const [status, setStatus] = useState<CreditRequestStatus | 'ALL'>('PENDING')
    const { data, error, isLoading } = useQuery({
        queryKey: [...KEY, status],
        queryFn: () => adminAPI.listCreditRequests(status === 'ALL' ? undefined : status),
    })

    return (
        <AdminSection
            title="Credit requests"
            action={
                <SettingsSelect
                    label="Status"
                    value={status}
                    onChange={setStatus}
                    options={[
                        { value: 'PENDING', label: 'Pending' },
                        { value: 'APPROVED', label: 'Approved' },
                        { value: 'REJECTED', label: 'Rejected' },
                        { value: 'ALL', label: 'All' },
                    ]}
                />
            }
        >
            <ErrorLine error={error} />
            {!isLoading && (
                <AdminList empty="No requests">
                    {(data?.items ?? []).map((request) => (
                        <RequestRow key={request.id} request={request} />
                    ))}
                </AdminList>
            )}
        </AdminSection>
    )
}
