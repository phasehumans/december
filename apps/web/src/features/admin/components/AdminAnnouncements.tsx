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
    Tag,
    adminInputClass,
    shortDate,
    useAdminAction,
} from './AdminUi'

import { SettingsSelect } from '@/features/profile/components/SettingsUi'
import { cn } from '@/shared/lib/utils'

const KEY = ['admin', 'announcements']

type Kind = 'ANNOUNCEMENT' | 'FEEDBACK_REQUEST'

export const AdminAnnouncements: React.FC = () => {
    const { data, error, isLoading } = useQuery({
        queryKey: KEY,
        queryFn: adminAPI.listAnnouncements,
    })
    const [kind, setKind] = useState<Kind>('ANNOUNCEMENT')
    const [subject, setSubject] = useState('')
    const [body, setBody] = useState('')
    const [daysAgo, setDaysAgo] = useState('3')
    const [confirming, setConfirming] = useState(false)
    const [testedTo, setTestedTo] = useState<string | null>(null)

    const sendTest = useAdminAction(
        (s: string, b: string) =>
            adminAPI.sendTestAnnouncement(s, b).then((r) => setTestedTo(r.sentTo)),
        []
    )
    const send = useAdminAction(
        (input: Parameters<typeof adminAPI.sendAnnouncement>[0]) =>
            adminAPI.sendAnnouncement(input),
        [KEY]
    )

    const ready =
        subject.trim().length > 0 &&
        body.trim().length > 0 &&
        (kind === 'ANNOUNCEMENT' || /^\d+$/.test(daysAgo))

    return (
        <AdminSection title="Emails">
            <AdminBox>
                <div className="flex items-center gap-2 flex-wrap">
                    <SettingsSelect
                        label="Kind"
                        value={kind}
                        onChange={(value) => {
                            setKind(value)
                            setConfirming(false)
                        }}
                        options={[
                            { value: 'ANNOUNCEMENT', label: 'Announcement' },
                            { value: 'FEEDBACK_REQUEST', label: 'Feedback request' },
                        ]}
                    />
                    {kind === 'FEEDBACK_REQUEST' && (
                        <label className="flex items-center gap-2 text-[13px] text-[#B5B4AE]">
                            Signed up
                            <input
                                aria-label="Signed up days ago"
                                inputMode="numeric"
                                value={daysAgo}
                                onChange={(e) => setDaysAgo(e.target.value.replace(/\D/g, ''))}
                                className={`${adminInputClass} w-[64px]`}
                            />
                            days ago
                        </label>
                    )}
                </div>
                <input
                    aria-label="Subject"
                    placeholder="Subject"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    className={adminInputClass}
                />
                <textarea
                    aria-label="Body"
                    placeholder="hi {name}, ..."
                    value={body}
                    rows={8}
                    onChange={(e) => setBody(e.target.value)}
                    className={cn(adminInputClass, 'resize-y font-mono leading-relaxed')}
                />
                <div className="flex items-center gap-2 flex-wrap justify-end">
                    {testedTo && <Muted>Test sent to {testedTo}</Muted>}
                    <AdminButton
                        disabled={!ready || sendTest.isPending}
                        onClick={() => sendTest.mutate([subject.trim(), body.trim()])}
                    >
                        Send test
                    </AdminButton>
                    {confirming ? (
                        <>
                            <AdminButton onClick={() => setConfirming(false)}>Cancel</AdminButton>
                            <AdminButton
                                tone="primary"
                                disabled={!ready || send.isPending}
                                onClick={() =>
                                    send.mutate(
                                        [
                                            {
                                                kind,
                                                subject: subject.trim(),
                                                body: body.trim(),
                                                ...(kind === 'FEEDBACK_REQUEST'
                                                    ? { signedUpDaysAgo: Number(daysAgo) }
                                                    : {}),
                                            },
                                        ],
                                        {
                                            onSuccess: () => {
                                                setConfirming(false)
                                                setSubject('')
                                                setBody('')
                                                setTestedTo(null)
                                            },
                                        }
                                    )
                                }
                            >
                                Send to users now
                            </AdminButton>
                        </>
                    ) : (
                        <AdminButton
                            tone="primary"
                            disabled={!ready}
                            onClick={() => setConfirming(true)}
                        >
                            Send
                        </AdminButton>
                    )}
                </div>
                <ErrorLine error={sendTest.error || send.error} />
            </AdminBox>

            <ErrorLine error={error} />
            {!isLoading && (
                <AdminList empty="Nothing sent yet">
                    {(data?.items ?? []).map((item) => (
                        <AdminRow key={item.id}>
                            <div className="flex flex-col gap-0.5 min-w-0 flex-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                    <span className="text-[14px] text-[#D6D5C9]">
                                        {item.subject}
                                    </span>
                                    {item.kind === 'FEEDBACK_REQUEST' && (
                                        <Tag>feedback, {item.signedUpDaysAgo} days</Tag>
                                    )}
                                </div>
                                <Muted>
                                    {item.recipientCount} sent · {item.skippedCount} opted out
                                </Muted>
                            </div>
                            <Muted>{shortDate(item.sentAt ?? item.createdAt)}</Muted>
                        </AdminRow>
                    ))}
                </AdminList>
            )}
        </AdminSection>
    )
}
