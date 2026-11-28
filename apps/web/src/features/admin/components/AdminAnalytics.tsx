import { useQuery } from '@tanstack/react-query'
import React, { useMemo, useState } from 'react'

import {
    adminAPI,
    type AdminAnalytics as AnalyticsData,
    type AdminVisitors,
    type TrendMetric,
} from '../api/admin'

import {
    BarChart,
    CHART_COLORS,
    ChartBox,
    DualAxisLineChart,
    Funnel,
    HeatGrid,
    NoData,
    StatTile,
    TileGrid,
    compactNumber,
    dayLabel,
    type ChartLine,
} from './AdminCharts'
import { AdminSkeleton, ErrorLine, Muted, money } from './AdminUi'

import { cn } from '@/shared/lib/utils'

// The Analytics tab, the product side, all from real rows: the trend chart (A1), who comes
// back (A8), the path to a merged PR (A2), where people work (A3), what the work led to (A4),
// feature use (A5), models and own keys (A6), how people find December (A7), and money.

// one window for the whole page: 1 year is for the chart (by week); the other cards stop
// at 90 days, the most the server reads for them in one go
const WINDOWS = [
    { days: 7, label: '7 days' },
    { days: 30, label: '30 days' },
    { days: 90, label: '90 days' },
    { days: 365, label: '1 year' },
] as const

// O2: the history behind the tiles, every line in one chart: counts on the left axis,
// dollars on the right. "Agents working now" has no history, so its line is sessions started
const COUNT_LINES: Array<{ key: TrendMetric; label: string; color: string }> = [
    { key: 'signups', label: 'Signups', color: CHART_COLORS.blue },
    { key: 'active', label: 'Active users', color: CHART_COLORS.green },
    { key: 'sessions', label: 'Sessions started', color: CHART_COLORS.violet },
]
const MONEY_LINES: Array<{ key: TrendMetric; label: string; color: string }> = [
    { key: 'creditsCents', label: 'Credits used', color: CHART_COLORS.amber },
    { key: 'paidCents', label: 'Paid', color: CHART_COLORS.red },
]

/** O2: every line in one chart, up to a year by week */
const TrendChart: React.FC<{ days: number }> = ({ days }) => {
    const { data, error } = useQuery({
        queryKey: ['admin', 'analytics', 'trend', days],
        queryFn: () => adminAPI.getTrend(days),
    })
    const points = data?.points ?? []
    const line = (axis: ChartLine['axis']) => (l: (typeof COUNT_LINES)[number]) => ({
        ...l,
        axis,
        values: points.map((point) => point[l.key]),
    })

    return (
        <ChartBox title={days === 365 ? 'Last year, by week' : `Last ${days} days`}>
            <ErrorLine error={error} />
            {data ? (
                <DualAxisLineChart
                    labels={points.map((point) => dayLabel(point.day))}
                    titles={
                        data.bucket === 'week'
                            ? points.map((point) => `Week of ${dayLabel(point.day)}`)
                            : undefined
                    }
                    lines={[...COUNT_LINES.map(line('left')), ...MONEY_LINES.map(line('right'))]}
                    formatLeft={compactNumber}
                    formatRight={(cents) => `$${compactNumber(cents / 100)}`}
                    minRight={100}
                />
            ) : (
                !error && <div className="h-[240px] rounded-lg bg-white/[0.02] animate-pulse" />
            )}
        </ChartBox>
    )
}

const dollars = (cents: number) => `$${compactNumber(cents / 100)}`
const percent = (part: number, whole: number) =>
    whole > 0 ? `${Math.round((part / whole) * 100)}%` : '-'
const weeksOf = (rows: Array<{ week: string }>) => [...new Set(rows.map((r) => r.week))].sort()

const PAID = ['RAZORPAY', 'COINBASE']
const FREE = ['GRANT', 'REFERRAL', 'ADJUSTMENT']

/** A6, A7: a share of a whole as a thin bar, with the count and the percent */
const ShareRows: React.FC<{
    rows: Array<{ label: string; value: number }>
    whole: number
    color?: string
    empty?: string
}> = ({ rows, whole, color = CHART_COLORS.blue, empty = 'No data yet' }) =>
    rows.length === 0 || whole === 0 ? (
        <NoData text={empty} />
    ) : (
        <div className="flex flex-col gap-2">
            {rows.map((row) => {
                const share = Math.min(1, row.value / whole)
                return (
                    <div key={row.label} className="flex flex-col gap-1">
                        <div className="flex items-baseline justify-between gap-3 text-[12.5px]">
                            <span className="text-[#D6D5C9] truncate">{row.label}</span>
                            <span className="text-[#9A9998] tabular-nums shrink-0">
                                {row.value.toLocaleString()} · {percent(row.value, whole)}
                            </span>
                        </div>
                        <div className="h-1.5 rounded-full bg-[#232322] overflow-hidden">
                            <div
                                className="h-full rounded-full"
                                style={{ width: `${share * 100}%`, backgroundColor: color }}
                            />
                        </div>
                    </div>
                )
            })}
        </div>
    )

const CHANNELS = [
    { key: 'web', label: 'Web app', color: CHART_COLORS.blue },
    { key: 'cli', label: 'CLI', color: CHART_COLORS.violet },
    { key: 'github', label: 'GitHub app', color: CHART_COLORS.green },
] as const

/**
 * C1, C2: who visits the landing page and the web app (Cloudflare Web Analytics, people only,
 * no cookies), and how many of the landing page visits became accounts.
 */
const Visitors: React.FC<{ days: number }> = ({ days }) => {
    const { data, error } = useQuery({
        queryKey: ['admin', 'visitors', days],
        queryFn: () => adminAPI.getVisitors(days),
    })
    if (error) return <ErrorLine error={error} />
    if (!data) return <AdminSkeleton tiles rows={2} />
    // before Cloudflare is connected there is nothing to show
    if (!data.connected) return null
    if ('error' in data && data.error !== null) {
        return <ErrorLine error={new Error(`Cloudflare: ${data.error}`)} />
    }
    return <VisitorsBody data={data as VisitorsData} />
}

type VisitorsData = Extract<AdminVisitors, { error: null }>

/** a short list of label and number, no bars */
const TopList: React.FC<{ title: string; rows: Array<{ label: string; value: number }> }> = ({
    title,
    rows,
}) => (
    <div className="flex flex-col gap-1.5 min-w-0">
        <Muted>{title}</Muted>
        {rows.length === 0 ? (
            <span className="text-[12.5px] text-[#7B7A79]">None yet</span>
        ) : (
            rows.map((row) => (
                <div
                    key={row.label}
                    className="flex items-baseline justify-between gap-3 text-[12.5px]"
                >
                    <span className="text-[#D6D5C9] truncate">{row.label}</span>
                    <span className="text-[#9A9998] tabular-nums shrink-0">
                        {row.value.toLocaleString()}
                    </span>
                </div>
            ))
        )}
    </div>
)

/** C1, C2: one small card: visits to each site, how many became accounts, top sources and pages */
const VisitorsBody: React.FC<{ data: VisitorsData }> = ({ data }) => (
    <ChartBox
        title={
            data.requestedDays > data.days
                ? `Website, last ${data.days} days (Cloudflare keeps 90)`
                : `Website, last ${data.days} days`
        }
    >
        <div className="grid grid-cols-3 gap-3">
            {[
                {
                    label: 'Landing visits',
                    value: data.landing.visits.toLocaleString(),
                    hint: `${data.landing.pageViews.toLocaleString()} views`,
                },
                {
                    label: 'Web app visits',
                    value: data.app.visits.toLocaleString(),
                    hint: `${data.app.pageViews.toLocaleString()} views`,
                },
                {
                    label: 'Visit to signup',
                    value: percent(data.signups, data.landing.visits),
                    hint: `${data.signups} ${data.signups === 1 ? 'signup' : 'signups'}`,
                },
            ].map((stat) => (
                <div key={stat.label} className="flex flex-col gap-0.5 min-w-0">
                    <Muted className="truncate">{stat.label}</Muted>
                    <span className="text-[18px] leading-tight text-[#EDEDED] tabular-nums">
                        {stat.value}
                    </span>
                    <Muted className="truncate">{stat.hint}</Muted>
                </div>
            ))}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-4 mt-1">
            <TopList
                title="Where visits come from"
                rows={data.referrers.map((r) => ({ label: r.host, value: r.visits }))}
            />
            <TopList
                title="Top landing pages"
                rows={data.topPages.map((p) => ({ label: p.path, value: p.views }))}
            />
        </div>
    </ChartBox>
)

const Page: React.FC<{ data: AnalyticsData }> = ({ data }) => {
    const { funnel, active, outcomes, features } = data

    // A8: the share of each signup week still active n weeks later
    const cohortRows = useMemo(() => {
        const sizes = new Map<string, number>(data.cohorts.sizes.map((s) => [s.cohort, s.size]))
        const now = Date.now()
        return data.cohorts.sizes.map(({ cohort }) => {
            const size = sizes.get(cohort) ?? 0
            const weeksSince = Math.floor(
                (now - new Date(`${cohort}T00:00:00`).getTime()) / (7 * 86400000)
            )
            const cells = Array.from({ length: 8 }, (_, week) => {
                if (week > weeksSince) return null
                const users =
                    data.cohorts.cells.find((c) => c.cohort === cohort && c.week === week)?.users ??
                    0
                return size > 0 ? Math.round((users / size) * 100) : 0
            })
            return {
                label: `${dayLabel(cohort)} · ${size}`,
                cells,
                titles: cells.map((v, week) =>
                    v === null ? '' : `week ${week}: ${v}% of ${size} still active`
                ),
            }
        })
    }, [data.cohorts])

    // A3
    const channelWeeks = weeksOf(data.channels)
    const channelUsers = (channel: string, week: string) =>
        data.channels.find((r) => r.channel === channel && r.week === week)?.users ?? 0

    // money per week
    const moneyWeeks = weeksOf([...data.wallet, ...data.spent])
    const paidIn = (week: string) =>
        data.wallet
            .filter((r) => r.week === week && PAID.includes(r.provider))
            .reduce((s, r) => s + r.cents, 0)
    const freeIn = (week: string) =>
        data.wallet
            .filter((r) => r.week === week && FREE.includes(r.provider))
            .reduce((s, r) => s + Math.max(0, r.cents), 0)
    const used = (week: string) => data.spent.find((r) => r.week === week)?.cents ?? 0
    const total = (fn: (week: string) => number) => moneyWeeks.reduce((s, w) => s + fn(w), 0)

    // A4: pull requests per week
    const prWeeks = weeksOf(data.prWeeks)
    const prCount = (kind: string, week: string) =>
        data.prWeeks.find((r) => r.kind === kind && r.week === week)?.count ?? 0

    // A6
    const calls = data.models.reduce((s, m) => s + m.calls, 0)
    const ownKeyCalls = data.models.reduce((s, m) => s + m.ownKeyCalls, 0)
    const keyUsers = data.keyProviders.reduce((s, k) => s + k.users, 0)

    // A7
    const methods = data.signupMethods
    const signedUp = methods.github + methods.google + methods.email
    const heard = data.heardFrom.reduce((s, h) => s + h.count, 0)

    return (
        <>
            {/* A8: who comes back */}
            <TileGrid>
                <StatTile label="Active today" value={active.day} hint="made a model call" />
                <StatTile label="Active, 7 days" value={active.week} />
                <StatTile label="Active, 30 days" value={active.month} />
                <StatTile
                    label="Stickiness"
                    value={percent(active.day, active.month)}
                    hint="today vs 30 days"
                />
            </TileGrid>

            {/* A2 */}
            <ChartBox title={`From signup to merged PR (signed up in the last ${data.days} days)`}>
                <Funnel
                    steps={[
                        { label: 'Signed up', value: funnel.signedUp },
                        { label: 'Finished onboarding', value: funnel.onboarded },
                        { label: 'Connected GitHub or GitLab', value: funnel.connectedGit },
                        { label: 'Ran the agent', value: funnel.ranAgent },
                        { label: 'PR opened', value: funnel.prOpened },
                        { label: 'PR merged', value: funnel.prMerged },
                    ]}
                />
            </ChartBox>

            {/* A3 */}
            <ChartBox
                title="Where people work, users per week"
                legend={CHANNELS.map((c) => ({ label: c.label, color: c.color }))}
            >
                {channelWeeks.length === 0 ? (
                    <NoData />
                ) : (
                    <BarChart
                        labels={channelWeeks.map(dayLabel)}
                        series={CHANNELS.map((c) => ({
                            label: c.label,
                            color: c.color,
                            values: channelWeeks.map((w) => channelUsers(c.key, w)),
                        }))}
                    />
                )}
            </ChartBox>

            {/* A4: what the work led to */}
            <TileGrid>
                <StatTile
                    label="Sessions started"
                    value={outcomes.sessions}
                    hint={`${percent(outcomes.failed, outcomes.sessions)} failed`}
                />
                <StatTile
                    label="Opened a PR"
                    value={percent(outcomes.withPr, outcomes.sessions)}
                    hint={`${outcomes.withPr} of ${outcomes.sessions} ${outcomes.sessions === 1 ? 'session' : 'sessions'}`}
                />
                <StatTile
                    label="PRs merged"
                    value={percent(outcomes.merged, outcomes.merged + outcomes.closed)}
                    hint={`${outcomes.merged} merged, ${outcomes.closed} closed`}
                />
                <StatTile
                    label="Time to merge"
                    value={
                        outcomes.medianMergeHours === null
                            ? '-'
                            : outcomes.medianMergeHours < 24
                              ? `${outcomes.medianMergeHours} h`
                              : `${Math.round((outcomes.medianMergeHours / 24) * 10) / 10} d`
                    }
                    hint={`median · +${compactNumber(outcomes.additions)} -${compactNumber(outcomes.deletions)} lines`}
                />
            </TileGrid>
            <ChartBox
                title="Pull requests per week"
                legend={[
                    { label: 'Merged', color: CHART_COLORS.green },
                    { label: 'Closed', color: CHART_COLORS.grey },
                ]}
            >
                <BarChart
                    labels={prWeeks.map(dayLabel)}
                    series={[
                        {
                            label: 'merged',
                            color: CHART_COLORS.green,
                            values: prWeeks.map((w) => prCount('merged', w)),
                        },
                        {
                            label: 'closed',
                            color: CHART_COLORS.grey,
                            values: prWeeks.map((w) => prCount('closed', w)),
                        },
                    ]}
                />
            </ChartBox>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {/* A5 */}
                <ChartBox
                    title={`Feature use, of ${features.active} active ${features.active === 1 ? 'user' : 'users'}`}
                >
                    <ShareRows
                        whole={features.active}
                        color={CHART_COLORS.violet}
                        empty="No active users in this window"
                        rows={[
                            { label: 'CLI', value: features.cli },
                            { label: 'Own API keys', value: features.ownKey },
                            { label: 'GitHub app', value: features.githubApp },
                            { label: 'Skills', value: features.skills },
                            { label: 'MCP servers', value: features.mcp },
                            { label: 'Plan first', value: features.planFirst },
                            { label: 'Deep mode', value: features.deep },
                        ]}
                    />
                </ChartBox>

                {/* A6 */}
                <ChartBox
                    title={`Models, ${calls.toLocaleString()} ${calls === 1 ? 'call' : 'calls'}`}
                >
                    {data.models.length === 0 ? (
                        <NoData />
                    ) : (
                        <div className="flex flex-col gap-1.5 text-[12.5px]">
                            {data.models.map((m) => (
                                <div
                                    key={m.model}
                                    className="flex items-baseline justify-between gap-3"
                                >
                                    <span className="text-[#D6D5C9] truncate">{m.model}</span>
                                    <span className="text-[#9A9998] tabular-nums shrink-0">
                                        {m.calls.toLocaleString()} · {money(m.cents)}
                                    </span>
                                </div>
                            ))}
                            <Muted className="mt-1">
                                {percent(ownKeyCalls, calls)} of calls on own keys
                            </Muted>
                        </div>
                    )}
                </ChartBox>

                {/* A6: own keys */}
                <ChartBox title={`Own keys, ${keyUsers} saved`}>
                    <ShareRows
                        whole={keyUsers}
                        color={CHART_COLORS.amber}
                        empty="No own keys saved yet"
                        rows={data.keyProviders.map((k) => ({ label: k.provider, value: k.users }))}
                    />
                </ChartBox>

                {/* A7 */}
                <ChartBox title={`How people sign up, ${signedUp} in ${data.days} days`}>
                    <ShareRows
                        whole={signedUp}
                        empty="No signups in this window"
                        rows={[
                            { label: 'GitHub', value: methods.github },
                            { label: 'Google', value: methods.google },
                            { label: 'Email code', value: methods.email },
                        ]}
                    />
                    <Muted>
                        Referrals: {data.referrals.joined} joined, {data.referrals.credited}{' '}
                        credited
                    </Muted>
                </ChartBox>

                <ChartBox
                    title={`Where they heard of December, ${heard} ${heard === 1 ? 'answer' : 'answers'}`}
                    className="md:col-span-2"
                >
                    <ShareRows
                        whole={heard}
                        color={CHART_COLORS.green}
                        empty="No answers in this window"
                        rows={data.heardFrom.map((h) => ({ label: h.answer, value: h.count }))}
                    />
                </ChartBox>
            </div>

            {/* A8 */}
            <ChartBox title="Still active n weeks after signup (% of each signup week)">
                {cohortRows.length === 0 ? (
                    <NoData />
                ) : (
                    <HeatGrid
                        rows={cohortRows}
                        columns={Array.from({ length: 8 }, (_, i) => `w${i}`)}
                        format={(v) => `${v}`}
                    />
                )}
            </ChartBox>

            {/* money */}
            <ChartBox title="Money per week">
                <div className="flex gap-4 flex-wrap text-[12.5px]">
                    <span className="text-[#9A9998]">
                        Paid <span className="text-[#D6D5C9]">{money(total(paidIn))}</span>
                    </span>
                    <span className="text-[#9A9998]">
                        Free credits given{' '}
                        <span className="text-[#D6D5C9]">{money(total(freeIn))}</span>
                    </span>
                    <span className="text-[#9A9998]">
                        Credits used <span className="text-[#D6D5C9]">{money(total(used))}</span>
                    </span>
                </div>
                {moneyWeeks.length === 0 ? (
                    <NoData />
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        {(
                            [
                                ['Paid', CHART_COLORS.green, paidIn],
                                ['Free credits given', CHART_COLORS.amber, freeIn],
                                ['Credits used', CHART_COLORS.blue, used],
                            ] as const
                        ).map(([label, color, fn]) => (
                            <div key={label} className="flex flex-col gap-1">
                                <Muted>{label}</Muted>
                                <BarChart
                                    labels={moneyWeeks.map(dayLabel)}
                                    format={dollars}
                                    series={[{ label, color, values: moneyWeeks.map(fn) }]}
                                    height={110}
                                />
                            </div>
                        ))}
                    </div>
                )}
            </ChartBox>
        </>
    )
}

export const AdminAnalytics: React.FC = () => {
    const [days, setDays] = useState<number>(30)
    const cardDays = Math.min(days, 90)
    const { data, error, isLoading } = useQuery({
        queryKey: ['admin', 'analytics', cardDays],
        queryFn: () => adminAPI.getAnalytics(cardDays),
    })

    return (
        <>
            <div className="flex gap-1" role="tablist" aria-label="Window">
                {WINDOWS.map(({ days: value, label }) => (
                    <button
                        key={value}
                        type="button"
                        role="tab"
                        aria-selected={days === value}
                        onClick={() => setDays(value)}
                        className={cn(
                            'px-2.5 py-1 rounded-md text-[12.5px] cursor-pointer',
                            days === value
                                ? 'bg-[#262625] text-[#EDEDED]'
                                : 'text-[#9A9998] hover:text-[#D6D5C9]'
                        )}
                    >
                        {label}
                    </button>
                ))}
            </div>
            <TrendChart days={days} />
            <Visitors days={days} />
            <ErrorLine error={error} />
            {isLoading && <AdminSkeleton tiles rows={3} />}
            {data && <Page data={data} />}
        </>
    )
}
