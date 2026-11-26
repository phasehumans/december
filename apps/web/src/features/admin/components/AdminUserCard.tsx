import { useQuery } from '@tanstack/react-query'
import { Check, Copy, X } from 'lucide-react'
import React, { useEffect, useState } from 'react'

import { adminAPI, type AdminUserDetails, type WalletProvider } from '../api/admin'

import { BarChart, CHART_COLORS, compactNumber, dayLabel } from './AdminCharts'
import { AdminDialog, ErrorLine, Muted, Tag, money, shortDate } from './AdminUi'

import { formatRelativeTime } from '@/shared/lib/relativeTime'
import { cn } from '@/shared/lib/utils'

// U1 + D1-D11: everything about one user on one card, read only. No divider lines and no
// buttons at the bottom: it closes with the x, Esc, a click outside or Back on a phone.
// Repositories and pull requests are counts only.

const DAY_MS = 24 * 60 * 60 * 1000

/** U3: signed up in the last 24 hours */
export const isNewUser = (createdAt: string) => Date.now() - new Date(createdAt).getTime() < DAY_MS

/** U4: copies a value, and shows a check for a moment */
export const CopyText: React.FC<{ text: string; label: string }> = ({ text, label }) => {
    const [copied, setCopied] = useState(false)
    useEffect(() => {
        if (!copied) return
        const timer = setTimeout(() => setCopied(false), 1500)
        return () => clearTimeout(timer)
    }, [copied])

    const Icon = copied ? Check : Copy
    return (
        <button
            type="button"
            aria-label={copied ? 'Copied' : label}
            title={copied ? 'Copied' : label}
            onClick={(e) => {
                e.stopPropagation()
                navigator.clipboard
                    ?.writeText(text)
                    .then(() => setCopied(true))
                    .catch(() => {
                        // Intentionally swallowed: the browser refused the clipboard, nothing to show
                    })
            }}
            className="shrink-0 p-1 rounded text-[#5C5C5C] hover:text-[#D6D5C9] cursor-pointer"
        >
            <Icon className="w-3.5 h-3.5" strokeWidth={1.75} />
        </button>
    )
}

export const CopyEmail: React.FC<{ email: string }> = ({ email }) => (
    <CopyText text={email} label={`Copy ${email}`} />
)

/** U3: "new" and "disposable" tags beside the email */
export const UserTags: React.FC<{ createdAt: string; disposable: boolean }> = ({
    createdAt,
    disposable,
}) => (
    <>
        {isNewUser(createdAt) && <Tag tone="ok">new</Tag>}
        {disposable && <Tag tone="warn">disposable</Tag>}
    </>
)

const WALLET_LABELS: Record<WalletProvider, string> = {
    RAZORPAY: 'Paid, Razorpay',
    COINBASE: 'Paid, crypto',
    GRANT: 'Free credits',
    ADJUSTMENT: 'Added by admin',
    REFERRAL: 'Referral',
}

const SIGNUP_LABELS: Record<AdminUserDetails['account']['signupMethod'], string> = {
    github: 'GitHub',
    google: 'Google',
    email: 'Email code',
}

const ADMIN_ACTIONS: Record<string, string> = {
    'credits.adjust': 'Added credits',
    'credit_request.approve': 'Approved the $5 request',
    'credit_request.reject': 'Rejected the $5 request',
}

const ago = (iso: string | null) => (iso ? formatRelativeTime(iso) : 'never')
const onOff = (value: boolean) => (value ? 'On' : 'Off')
const yesNo = (value: boolean) => (value ? 'Yes' : 'No')
const limit = (cents: number | null) => (cents === null ? 'Off' : money(cents))

/** the last 30 days (India time), a bar for every day, 0 where nothing was spent */
const last30Days = (daily: AdminUserDetails['usage']['daily']) => {
    const byDay = new Map(daily.map((row) => [row.day, row.cents]))
    return Array.from({ length: 30 }, (_, i) => {
        const date = new Date(Date.now() - (29 - i) * DAY_MS)
        const day = date.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })
        return { day, cents: byDay.get(day) ?? 0 }
    })
}

const Stat: React.FC<{ label: string; value: React.ReactNode }> = ({ label, value }) => (
    <div className="flex flex-col gap-0.5 bg-[#202020] rounded-lg px-3 py-2 min-w-0">
        <Muted>{label}</Muted>
        <span className="text-[15px] text-[#EDEDED] tabular-nums truncate">{value}</span>
    </div>
)

const Heading: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <h3 className="text-[11.5px] uppercase tracking-wide text-[#6B6A69]">{children}</h3>
)

/** a titled group of label and value pairs, spaced, with no lines */
const Block: React.FC<{ title: string; children: React.ReactNode; className?: string }> = ({
    title,
    children,
    className,
}) => (
    <section className={cn('flex flex-col gap-2 min-w-0', className)}>
        <Heading>{title}</Heading>
        <dl className="grid grid-cols-[minmax(110px,auto)_1fr] gap-x-4 gap-y-1.5 text-[13px]">
            {children}
        </dl>
    </section>
)

const Field: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
    <>
        <dt className="text-[#8A8988] break-words">{label}</dt>
        <dd className="text-[#D6D5C9] min-w-0 break-words">{children}</dd>
    </>
)

/** a list inside a block that scrolls when it is long */
const List: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <dd className="col-span-2 flex flex-col gap-1.5 max-h-[220px] overflow-y-auto pr-1 [scrollbar-width:thin] [scrollbar-color:#3A3938_transparent]">
        {children}
    </dd>
)

const ListRow: React.FC<{ left: React.ReactNode; right: React.ReactNode; dim?: boolean }> = ({
    left,
    right,
    dim,
}) => (
    <div className={cn('flex items-baseline justify-between gap-4', dim && 'text-[#7B7A79]')}>
        <span className="min-w-0 break-words">{left}</span>
        <span className="shrink-0 text-[#8A8988] tabular-nums">{right}</span>
    </div>
)

const Card: React.FC<{ user: AdminUserDetails }> = ({ user }) => {
    const { account, defaults, connected, usage, sessions, prs, money: wallet } = user
    const request = user.creditRequest
    const days = last30Days(usage.daily)

    return (
        <div className="flex flex-col gap-6">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <Stat label="Balance" value={money(wallet.balanceCents)} />
                <Stat label="Spent" value={money(usage.spentCents)} />
                <Stat label="Sessions" value={sessions.total} />
                <Stat label="PRs merged" value={`${prs.merged} of ${prs.opened}`} />
            </div>

            {/* D7: spend on credits per day */}
            <section className="flex flex-col gap-2">
                <Heading>Spent per day, 30 days</Heading>
                <BarChart
                    labels={days.map((d) => dayLabel(d.day))}
                    format={(cents) => `$${compactNumber(cents / 100)}`}
                    series={[
                        {
                            label: 'spent',
                            color: CHART_COLORS.blue,
                            values: days.map((d) => d.cents),
                        },
                    ]}
                    height={110}
                />
            </section>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
                <Block title="Account">
                    <Field label="Signed up with">{SIGNUP_LABELS[account.signupMethod]}</Field>
                    <Field label="Google linked">{yesNo(account.googleLinked)}</Field>
                    <Field label="Email verified">{yesNo(account.emailVerified)}</Field>
                    <Field label="Onboarding">
                        {account.onboarding}
                        {account.onboardingDoneAt && ` · ${shortDate(account.onboardingDoneAt)}`}
                    </Field>
                    <Field label="Time zone">{account.timezone}</Field>
                    <Field label="Data export">
                        {account.lastExport
                            ? `${account.lastExport.status.toLowerCase()} · ${shortDate(account.lastExport.createdAt)}`
                            : 'Never'}
                    </Field>
                </Block>

                <Block title="Notifications">
                    <Field label="Level">{account.notifyLevel.toLowerCase()}</Field>
                    <Field label="Email">{onOff(account.notifyEmail)}</Field>
                    <Field label="Push">
                        {onOff(account.notifyPush)}
                        {connected.pushBrowsers > 0 && ` · ${connected.pushBrowsers} browsers`}
                    </Field>
                    <Field label="Daily summary">{account.digest ?? 'Off'}</Field>
                    <Field label="Product emails">{onOff(account.productEmails)}</Field>
                    <Field label="Security alerts">{onOff(account.securityAlerts)}</Field>
                </Block>

                <Block title="Defaults">
                    <Field label="Runs on">
                        {defaults.modelSource === 'OWN_KEY' ? 'Own key' : 'Credits'}
                    </Field>
                    {defaults.ownKeyModel && (
                        <Field label="Own key model">{defaults.ownKeyModel}</Field>
                    )}
                    <Field label="Plan first">{yesNo(defaults.planFirst)}</Field>
                    <Field label="Effort">{defaults.effort}</Field>
                    <Field label="Open a PR">{yesNo(defaults.openPullRequest)}</Field>
                    <Field label="Repository">{defaults.repository}</Field>
                    <Field label="Base branch">{defaults.baseBranch}</Field>
                    <Field label="Blocked tools">{defaults.blockedTools}</Field>
                </Block>

                <Block title="Limits">
                    <Field label="Sandbox idle">{defaults.idleStopMinutes} min</Field>
                    <Field label="Archive after">
                        {defaults.archiveAfterDays ? `${defaults.archiveAfterDays} days` : 'Never'}
                    </Field>
                    <Field label="Low balance alert">{limit(defaults.lowBalanceAlertCents)}</Field>
                    <Field label="Session limit">{limit(defaults.sessionLimitCents)}</Field>
                    <Field label="Day limit">{limit(defaults.dayLimitCents)}</Field>
                </Block>

                <Block title="Connected">
                    <Field label="GitHub">
                        {connected.github
                            ? `${connected.github.username ?? 'connected'}${connected.github.appInstalled ? ` · app on ${connected.github.installations}` : ''}`
                            : 'No'}
                    </Field>
                    <Field label="GitLab">{connected.gitlab?.username ?? 'No'}</Field>
                    <Field label="Skills">{connected.skills}</Field>
                    <Field label="MCP servers">{connected.mcpServers}</Field>
                    <Field label="Secrets">{connected.secrets}</Field>
                    <Field label="Projects">{connected.projects}</Field>
                </Block>

                <Block title={`Own keys (${connected.ownKeys.length})`}>
                    {connected.ownKeys.length === 0 ? (
                        <Field label="Keys">None</Field>
                    ) : (
                        connected.ownKeys.map((key) => (
                            <Field key={key.provider} label={key.provider}>
                                {key.model} · used {ago(key.lastUsedAt)}
                            </Field>
                        ))
                    )}
                </Block>

                <Block title="Usage">
                    <Field label="Spent today">{money(usage.spentDayCents)}</Field>
                    <Field label="Spent, 30 days">{money(usage.spent30Cents)}</Field>
                    <Field label="Model calls">{usage.calls.toLocaleString()}</Field>
                    <Field label="Tokens">{compactNumber(usage.tokens)}</Field>
                    <Field label="From the CLI">{usage.cliCalls.toLocaleString()}</Field>
                    <Field label="On own keys">{usage.ownKeyCalls.toLocaleString()}</Field>
                    <Field label="First use">
                        {usage.firstAt ? shortDate(usage.firstAt) : '-'}
                    </Field>
                    <Field label="Last use">{ago(usage.lastAt)}</Field>
                </Block>

                <Block title="Top models">
                    {usage.topModels.length === 0 ? (
                        <Field label="Models">None</Field>
                    ) : (
                        usage.topModels.map((m) => (
                            <Field key={m.model} label={m.model}>
                                {m.calls.toLocaleString()} calls · {money(m.cents)}
                            </Field>
                        ))
                    )}
                </Block>

                <Block title="Sessions">
                    <Field label="Total">{sessions.total}</Field>
                    <Field label="Archived">{sessions.archived}</Field>
                    <Field label="Running now">{sessions.running}</Field>
                    <Field label="Waiting on them">{sessions.waiting}</Field>
                    <Field label="From GitHub">{sessions.githubRuns}</Field>
                    <Field label="Repositories">{sessions.repos}</Field>
                </Block>

                <Block title="Pull requests">
                    <Field label="Opened">{prs.opened}</Field>
                    <Field label="Merged">{prs.merged}</Field>
                    <Field label="Closed">{prs.closed}</Field>
                    <Field label="Lines">
                        <span className="text-[#7FD49A]">+{prs.additions.toLocaleString()}</span>{' '}
                        <span className="text-[#F28B82]">-{prs.deletions.toLocaleString()}</span>
                    </Field>
                </Block>

                <Block title={`Devices (${user.devices.length})`}>
                    {user.devices.length === 0 ? (
                        <Field label="Signed in">Nowhere</Field>
                    ) : (
                        <List>
                            {user.devices.map((device, i) => (
                                <ListRow
                                    key={i}
                                    left={device.label}
                                    right={ago(device.lastActiveAt)}
                                />
                            ))}
                        </List>
                    )}
                </Block>

                <Block title="Referrals">
                    <Field label="Code">{user.referral.code ?? 'Not made yet'}</Field>
                    <Field label="Invited by">{user.referral.invitedBy ?? 'Nobody'}</Field>
                    <Field label="Invited">{user.referral.invited.length}</Field>
                    {user.referral.invited.length > 0 && (
                        <List>
                            {user.referral.invited.map((row) => (
                                <ListRow
                                    key={row.email}
                                    left={row.email}
                                    right={row.status.toLowerCase()}
                                />
                            ))}
                        </List>
                    )}
                </Block>

                <Block title="Money">
                    <Field label="Balance">{money(wallet.balanceCents)}</Field>
                    <Field label="Paid">{money(wallet.paidCents)}</Field>
                    <Field label="Free credits">{money(wallet.freeCents)}</Field>
                    <Field label="Failed payments">{wallet.failedPayments}</Field>
                    {wallet.wallet.length > 0 && (
                        <List>
                            {wallet.wallet.map((row) => (
                                <ListRow
                                    key={row.id}
                                    dim={row.status !== 'SUCCESS'}
                                    left={`${WALLET_LABELS[row.provider]}${row.status !== 'SUCCESS' ? ` · ${row.status.toLowerCase()}` : ''}`}
                                    right={`${money(row.amountInCents)} · ${shortDate(row.createdAt)}`}
                                />
                            ))}
                        </List>
                    )}
                </Block>

                <Block title="Credit request">
                    {request ? (
                        <>
                            <Field label="Status">
                                {request.status.toLowerCase()}
                                {request.reviewedAt && ` · ${shortDate(request.reviewedAt)}`}
                            </Field>
                            <Field label="Sent">{shortDate(request.createdAt)}</Field>
                            <Field label="Building">{request.buildPlan}</Field>
                            <Field label="Heard from">{request.heardFrom}</Field>
                            <Field label="Will give feedback">
                                {yesNo(request.agreedToFeedback)}
                            </Field>
                            {request.rejectReason && (
                                <Field label="Rejected for">{request.rejectReason}</Field>
                            )}
                        </>
                    ) : (
                        <Field label="Status">None</Field>
                    )}
                </Block>

                <Block title={`Feedback (${user.feedback.total})`} className="md:col-span-2">
                    {user.feedback.items.length === 0 ? (
                        <Field label="Sent">None</Field>
                    ) : (
                        <List>
                            {user.feedback.items.map((item) => (
                                <div key={item.id} className="flex flex-col gap-0.5">
                                    <span className="text-[#D6D5C9] whitespace-pre-wrap break-words">
                                        {item.feedback}
                                    </span>
                                    <Muted>
                                        {shortDate(item.createdAt)}
                                        {item.rating ? ` · ${item.rating}` : ''}
                                    </Muted>
                                </div>
                            ))}
                        </List>
                    )}
                </Block>

                <Block title="What you did" className="md:col-span-2">
                    {user.adminHistory.length === 0 ? (
                        <Field label="Actions">None</Field>
                    ) : (
                        <List>
                            {user.adminHistory.map((row) => (
                                <ListRow
                                    key={row.id}
                                    left={`${ADMIN_ACTIONS[row.action] ?? row.action}${row.amountInCents ? ` · ${money(row.amountInCents)}` : ''}`}
                                    right={shortDate(row.createdAt)}
                                />
                            ))}
                        </List>
                    )}
                </Block>
            </div>
        </div>
    )
}

export const AdminUserCard: React.FC<{
    userId: string
    email: string
    onClose: () => void
}> = ({ userId, email, onClose }) => {
    const { data, error, isLoading } = useQuery({
        queryKey: ['admin', 'users', 'details', userId],
        queryFn: () => adminAPI.getUser(userId),
    })

    return (
        <AdminDialog label={`Details for ${email}`} onClose={onClose} className="md:max-w-[760px]">
            <div className="flex flex-col gap-5 p-4 md:p-6">
                <div className="flex items-start gap-3">
                    <div className="flex flex-col gap-1 min-w-0 flex-1">
                        <span className="text-[17px] text-[#EDEDED] truncate">
                            {data?.name || email}
                        </span>
                        <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                            <Muted className="truncate">{email}</Muted>
                            <CopyEmail email={email} />
                            {data && (
                                <UserTags createdAt={data.createdAt} disposable={data.disposable} />
                            )}
                            {data?.creditRequest?.status === 'APPROVED' &&
                                data.feedback.total === 0 && <Tag tone="warn">owes feedback</Tag>}
                        </div>
                        {data && (
                            <>
                                <Muted>
                                    Joined {shortDate(data.createdAt)} · active{' '}
                                    {ago(data.lastActiveAt)}
                                </Muted>
                                <div className="flex items-center gap-0.5 min-w-0">
                                    <span className="font-mono text-[11.5px] text-[#7B7A79] truncate">
                                        {data.id}
                                    </span>
                                    <CopyText text={data.id} label="Copy user ID" />
                                </div>
                            </>
                        )}
                    </div>
                    <button
                        type="button"
                        aria-label="Close"
                        onClick={onClose}
                        className="shrink-0 p-1.5 -mr-1.5 -mt-1 rounded-md text-[#7B7A79] hover:text-white hover:bg-[#262625] cursor-pointer"
                    >
                        <X className="w-4 h-4" strokeWidth={1.75} />
                    </button>
                </div>

                <ErrorLine error={error} />
                {isLoading && <Muted>Loading…</Muted>}
                {data && <Card user={data} />}
            </div>
        </AdminDialog>
    )
}
