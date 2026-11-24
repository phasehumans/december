import { useQuery } from '@tanstack/react-query'
import React, { useState } from 'react'

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

import {
    waitlistAPI,
    type WaitlistFeature,
    type WaitlistLaunchResult,
} from '@/features/supercrew/api/waitlist'
import { cn } from '@/shared/lib/utils'

const FEATURE: WaitlistFeature = 'super-crew'
const KEY = ['admin', 'waitlist', FEATURE]

/** #630: who asked to hear about Super Crew, and the launch-day email + inbox item */
export const AdminWaitlist: React.FC = () => {
    const { data, error, isLoading } = useQuery({
        queryKey: KEY,
        queryFn: () => waitlistAPI.listEntries(FEATURE),
    })
    const [subject, setSubject] = useState('')
    const [body, setBody] = useState('')
    const [inboxMessage, setInboxMessage] = useState('')
    const [confirming, setConfirming] = useState(false)
    const [result, setResult] = useState<WaitlistLaunchResult | null>(null)

    const launch = useAdminAction(
        (input: Parameters<typeof waitlistAPI.launch>[1]) =>
            waitlistAPI.launch(FEATURE, input).then(setResult),
        [KEY]
    )

    const waiting = data ? data.joinedCount - data.notifiedCount : 0
    const ready =
        subject.trim().length > 0 && body.trim().length > 0 && inboxMessage.trim().length > 0

    return (
        <AdminSection
            title="Super Crew waitlist"
            action={
                data && (
                    <Muted>{`${data.joinedCount} joined · ${data.notifiedCount} notified`}</Muted>
                )
            }
        >
            <AdminBox>
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
                    rows={6}
                    onChange={(e) => setBody(e.target.value)}
                    className={cn(adminInputClass, 'resize-y font-mono leading-relaxed')}
                />
                <input
                    aria-label="Inbox line"
                    placeholder="Inbox line"
                    value={inboxMessage}
                    onChange={(e) => setInboxMessage(e.target.value)}
                    className={adminInputClass}
                />
                <div className="flex items-center gap-2 flex-wrap justify-end">
                    {result && (
                        <Muted>
                            {result.failedCount > 0
                                ? `Sent ${result.sentCount} · ${result.failedCount} failed, send again to retry`
                                : `Sent ${result.sentCount}`}
                        </Muted>
                    )}
                    {confirming ? (
                        <>
                            <AdminButton onClick={() => setConfirming(false)}>Cancel</AdminButton>
                            <AdminButton
                                tone="primary"
                                disabled={!ready || launch.isPending}
                                onClick={() =>
                                    launch.mutate(
                                        [
                                            {
                                                subject: subject.trim(),
                                                body: body.trim(),
                                                inboxMessage: inboxMessage.trim(),
                                            },
                                        ],
                                        { onSettled: () => setConfirming(false) }
                                    )
                                }
                            >
                                {`Send to ${waiting} ${waiting === 1 ? 'person' : 'people'} now`}
                            </AdminButton>
                        </>
                    ) : (
                        <AdminButton
                            tone="primary"
                            disabled={!ready || waiting === 0}
                            onClick={() => {
                                setResult(null)
                                setConfirming(true)
                            }}
                        >
                            Send launch
                        </AdminButton>
                    )}
                </div>
                <ErrorLine error={launch.error} />
            </AdminBox>

            <ErrorLine error={error} />
            {!isLoading && (
                <AdminList empty="Nobody yet">
                    {(data?.items ?? []).map((item) => (
                        <AdminRow key={item.userId}>
                            <div className="flex flex-col gap-0.5 min-w-0 flex-1">
                                <span className="text-[14px] text-[#D6D5C9] truncate">
                                    {item.name}
                                </span>
                                <Muted className="break-all">{item.email}</Muted>
                            </div>
                            <div className="flex items-center gap-2">
                                {item.notifiedAt && <Tag tone="ok">Notified</Tag>}
                                <Muted>{shortDate(item.joinedAt)}</Muted>
                            </div>
                        </AdminRow>
                    ))}
                </AdminList>
            )}
        </AdminSection>
    )
}
