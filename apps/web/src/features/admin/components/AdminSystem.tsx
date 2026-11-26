import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowUpRight } from 'lucide-react'
import React from 'react'

import {
    adminAPI,
    type AdminDeploys,
    type AdminEdge,
    type AdminHealth,
    type AdminPageSpeed,
    type AdminPublicStatus,
    type CheckStatus,
    type PublicState,
} from '../api/admin'

import { BarChart, CHART_COLORS, NoData, StatusDot } from './AdminCharts'
import { AdminSandboxes } from './AdminSandboxes'
import {
    AdminList,
    AdminRow,
    AdminSection,
    AdminSkeleton,
    ErrorLine,
    Muted,
    RefreshLine,
    shortDate,
} from './AdminUi'

import { formatRelativeTime } from '@/shared/lib/relativeTime'
import { cn } from '@/shared/lib/utils'

// The System tab, the infrastructure side: what users see on the public status page (S1),
// then what the server sees inside (S2): server, machine, database and Redis, errors per
// hour, queues, workers, sandboxes and failed jobs.

const DETAILED_STATUS_URL = 'https://status.trydecember.com/'

// ----- S1: the public status page -----

const PUBLIC_TEXT: Record<PublicState, string> = {
    operational: 'All systems normal',
    degraded: 'Some systems are slow',
    downtime: 'Some systems are down',
    maintenance: 'Maintenance in progress',
}
const SERVICE_TEXT: Record<PublicState, string> = {
    operational: 'Operational',
    degraded: 'Slow',
    downtime: 'Down',
    maintenance: 'Maintenance',
}
const STATE_COLOR: Record<PublicState, string> = {
    operational: '#4ade80',
    degraded: '#fbbf24',
    maintenance: '#60a5fa',
    downtime: '#f87171',
}
const DAY_COLOR: Record<AdminPublicStatus['days'][number]['status'], string> = {
    operational: '#4ade80',
    recovered: '#fbbf24',
    degraded: '#fbbf24',
    maintenance: '#60a5fa',
    downtime: '#f87171',
    not_monitored: '#2A2A2A',
}
const BARS = 90

const Dot: React.FC<{ color: string }> = ({ color }) => (
    <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: color }} />
)

const dayTitle = (day: AdminPublicStatus['days'][number]) => {
    const date = new Date(`${day.day}T00:00:00`).toLocaleDateString([], {
        day: 'numeric',
        month: 'short',
    })
    if (day.problems.length > 0) return `${date}: ${day.problems.join(', ')}`
    return day.status === 'operational' ? `${date}: No problems` : `${date}: Not monitored yet`
}

/** S1: the same things /status shows, read by the server from Better Stack */
const PublicStatus: React.FC<{ status: AdminPublicStatus | undefined; error: unknown }> = ({
    status,
    error,
}) => {
    const link = (
        <a
            href={DETAILED_STATUS_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-[12.5px] text-[#D6D5C9] hover:text-white"
        >
            Check detailed system status
            <ArrowUpRight className="w-3.5 h-3.5" strokeWidth={1.75} />
        </a>
    )

    if (error || (status && !status.available)) {
        return (
            <div className="bg-[#191919] border border-[#242323] rounded-xl p-4 flex flex-col gap-2">
                <span className="flex items-center gap-2 text-[14px] text-[#EDEDED]">
                    <Dot color="#6B6A68" />
                    Cannot load the public status
                </span>
                {link}
            </div>
        )
    }
    if (!status) return <AdminSkeleton rows={2} />

    // the newest day lines up with the last bar
    const days = status.days.slice(-BARS)
    const bars = [...Array.from({ length: BARS - days.length }, () => null), ...days]

    return (
        <section
            aria-label="Public status"
            className="bg-[#191919] border border-[#242323] rounded-xl p-4 flex flex-col gap-4"
        >
            <div className="flex items-center justify-between gap-3 flex-wrap">
                <span className="flex items-center gap-2 text-[15px] text-[#EDEDED]">
                    <Dot color={status.overall ? STATE_COLOR[status.overall] : '#6B6A68'} />
                    {status.overall ? PUBLIC_TEXT[status.overall] : 'Status not known'}
                </span>
                <Muted>What users see at trydecember.com/status</Muted>
            </div>

            {status.announcement && (
                <p className="text-[13px] text-[#F2C07B] bg-[#3A2A14]/50 rounded-lg px-3 py-2 break-words">
                    {status.announcement}
                </p>
            )}

            {status.services.length > 0 && (
                <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-2">
                    {status.services.map((service) => (
                        <li
                            key={service.name}
                            className="flex items-center justify-between gap-3 text-[13px]"
                        >
                            <span className="text-[#D6D5C9] truncate">{service.name}</span>
                            <span className="flex items-center gap-1.5 text-[#9A9998] shrink-0">
                                <Dot
                                    color={service.state ? STATE_COLOR[service.state] : '#6B6A68'}
                                />
                                {service.state ? SERVICE_TEXT[service.state] : 'No data'}
                            </span>
                        </li>
                    ))}
                </ul>
            )}

            <div className="flex flex-col gap-1.5">
                <div
                    className="flex items-stretch gap-[2px] h-8"
                    role="img"
                    aria-label="The last 90 days, one bar a day"
                >
                    {bars.map((day, i) => (
                        <span
                            key={day?.day ?? `empty-${i}`}
                            title={day ? dayTitle(day) : ''}
                            className="flex-1 min-w-0 rounded-[2px]"
                            style={{ backgroundColor: day ? DAY_COLOR[day.status] : '#2A2A2A' }}
                        />
                    ))}
                </div>
                <div className="flex justify-between text-[11.5px] text-[#7B7A79]">
                    <span>90 days ago</span>
                    <span>Today</span>
                </div>
            </div>

            {link}
        </section>
    )
}

// ----- S2 to S8: inside the server -----

const worst = (statuses: CheckStatus[]): CheckStatus =>
    statuses.includes('down') ? 'down' : statuses.includes('warn') ? 'warn' : 'ok'

/** one line that says if anything needs a look */
const problemsOf = (health: AdminHealth) => {
    const { machine, database, redis, worker, queues, errors, server } = health
    const waiting = queues.items.reduce((sum, queue) => sum + queue.waiting, 0)
    const problems = [
        server.status !== 'ok' &&
            ((server.startsLastDay ?? 0) > 3
                ? `server restarted ${server.startsLastDay} times in 24 hours`
                : `server: event loop delay ${server.eventLoopP99Ms} ms`),
        machine.status !== 'ok' && `machine: ${machine.detail}`,
        database.status !== 'ok' && `database: ${database.detail}`,
        redis.status !== 'ok' && `Redis: ${redis.detail}`,
        worker.status !== 'ok' && `worker: ${worker.detail}`,
        queues.status !== 'ok' && `${waiting} jobs waiting`,
        errors.status !== 'ok' && `errors: ${errors.detail}`,
    ].filter((problem): problem is string => Boolean(problem))
    const status = worst([
        server.status,
        machine.status,
        database.status,
        redis.status,
        worker.status,
        queues.status,
        errors.status,
    ])
    return { problems, status }
}

const duration = (seconds: number) => {
    const days = Math.floor(seconds / 86400)
    const hours = Math.floor((seconds % 86400) / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    if (days > 0) return `${days} d ${hours} h`
    if (hours > 0) return `${hours} h ${minutes} min`
    return `${minutes} min`
}

/** a thin bar that fills up to 100%, amber from 80% and red from 90% */
const Meter: React.FC<{ pct: number }> = ({ pct }) => (
    <div className="h-1.5 rounded-full bg-[#232322] overflow-hidden">
        <div
            className="h-full rounded-full"
            style={{
                width: `${Math.min(100, Math.max(0, pct))}%`,
                backgroundColor:
                    pct >= 90
                        ? CHART_COLORS.red
                        : pct >= 80
                          ? CHART_COLORS.amber
                          : CHART_COLORS.green,
            }}
        />
    </div>
)

const Card: React.FC<{
    title: string
    status: CheckStatus
    children: React.ReactNode
    className?: string
}> = ({ title, status, children, className }) => (
    <section
        aria-label={title}
        className={cn(
            'bg-[#191919] border border-[#242323] rounded-xl px-4 py-3.5 flex flex-col gap-3 min-w-0',
            className
        )}
    >
        <span className="flex items-center gap-2 text-[13.5px] text-[#EDEDED]">
            <StatusDot status={status} />
            {title}
        </span>
        {children}
    </section>
)

const Field: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
    <div className="flex items-baseline justify-between gap-4 text-[12.5px]">
        <span className="text-[#8A8988] shrink-0">{label}</span>
        <span className="text-[#D6D5C9] text-right min-w-0 break-words tabular-nums">
            {children}
        </span>
    </div>
)

const MeterField: React.FC<{ label: string; pct: number | undefined; text?: string }> = ({
    label,
    pct,
    text,
}) =>
    pct === undefined ? null : (
        <div className="flex flex-col gap-1">
            <Field label={label}>
                {pct}%{text ? ` · ${text}` : ''}
            </Field>
            <Meter pct={pct} />
        </div>
    )

/** S3 */
const ServerCard: React.FC<{ server: AdminHealth['server'] }> = ({ server }) => {
    // an answer cached before a deploy has no list yet
    const starts = server.recentStarts ?? []
    return (
        <Card title="Server" status={server.status}>
            <Field label="Up for">{duration(server.uptimeSeconds)}</Field>
            <Field label="Restarts, 24 hours">{server.startsLastDay ?? '-'}</Field>
            {starts.length > 0 && (
                <Field label="Last starts">
                    {starts
                        .slice(0, 3)
                        .map((at) => formatRelativeTime(at))
                        .join(', ')}
                </Field>
            )}
            <Field label="Memory">
                {server.memoryMb} MB · heap {server.heapMb} MB
            </Field>
            <Field label="Event loop delay">{server.eventLoopP99Ms} ms (p99)</Field>
            <Field label="Runtime">{server.runtime}</Field>
            <Field label="Commit">{server.commit ? server.commit.slice(0, 7) : 'not set'}</Field>
        </Card>
    )
}

/** S4 */
const MachineCard: React.FC<{ machine: AdminHealth['machine'] }> = ({ machine }) => (
    <Card title="Machine" status={machine.status}>
        {machine.load ? (
            <>
                <Field label="CPU load (1, 5, 15 min)">
                    {machine.load.join(' · ')} on {machine.cores} cores
                </Field>
                <MeterField
                    label="CPU, 5 min"
                    pct={
                        machine.cores
                            ? Math.round(((machine.load[1] ?? 0) / machine.cores) * 100)
                            : undefined
                    }
                />
                <MeterField label="Memory" pct={machine.memoryUsedPct} text={machine.memoryText} />
                <MeterField label="Disk" pct={machine.diskUsedPct} text={machine.diskText} />
            </>
        ) : (
            <Muted>{machine.detail}</Muted>
        )}
    </Card>
)

/** S5 */
const DataCard: React.FC<{ database: AdminHealth['database']; redis: AdminHealth['redis'] }> = ({
    database,
    redis,
}) => (
    <Card title="Database and Redis" status={worst([database.status, redis.status])}>
        <Field label="Database ping">
            {database.pingMs !== null ? `${database.pingMs} ms` : database.detail}
        </Field>
        {database.connections != null && database.maxConnections != null && (
            <MeterField
                label="Connections"
                pct={Math.round((database.connections / database.maxConnections) * 100)}
                text={`${database.connections} of ${database.maxConnections}`}
            />
        )}
        {database.sizeText && <Field label="Database size">{database.sizeText}</Field>}
        <Field label="Redis ping">
            {redis.pingMs !== null ? `${redis.pingMs} ms` : redis.detail}
        </Field>
        {redis.memory && <Field label="Redis memory">{redis.memory}</Field>}
    </Card>
)

/** S6 */
const ErrorsCard: React.FC<{ errors: AdminHealth['errors'] }> = ({ errors }) => {
    const total = errors.hourly.reduce((sum, hour) => sum + hour.count, 0)
    return (
        <Card title={`Server errors, 24 hours: ${total}`} status={errors.status}>
            {total === 0 ? (
                <NoData text="No server errors in 24 hours" />
            ) : (
                <BarChart
                    labels={errors.hourly.map((h) =>
                        new Date(h.hour).toLocaleTimeString([], { hour: '2-digit' })
                    )}
                    series={[
                        {
                            label: 'errors',
                            color: CHART_COLORS.red,
                            values: errors.hourly.map((h) => h.count),
                        },
                    ]}
                    height={110}
                />
            )}
        </Card>
    )
}

/** S7 */
const QueuesCard: React.FC<{ queues: AdminHealth['queues'] }> = ({ queues }) => (
    <Card title="Queues" status={queues.status}>
        <div className="overflow-x-auto -mx-1">
            <table className="w-full text-[12.5px] tabular-nums">
                <thead>
                    <tr className="text-left text-[#7B7A79]">
                        <th className="font-normal px-1 py-1">Queue</th>
                        <th className="font-normal px-1 py-1 text-right">Waiting</th>
                        <th className="font-normal px-1 py-1 text-right">Active</th>
                        <th className="font-normal px-1 py-1 text-right">Delayed</th>
                        <th className="font-normal px-1 py-1 text-right">Failed</th>
                    </tr>
                </thead>
                <tbody>
                    {queues.items.map((queue) => (
                        <tr key={queue.name} className="text-[#D6D5C9]">
                            <td className="px-1 py-1">
                                <span className="flex items-center gap-1.5">
                                    <StatusDot status={queue.status} />
                                    {queue.label}
                                </span>
                                {queue.error && (
                                    <Muted className="break-words">{queue.error}</Muted>
                                )}
                            </td>
                            <td className="px-1 py-1 text-right">{queue.waiting}</td>
                            <td className="px-1 py-1 text-right">{queue.active}</td>
                            <td className="px-1 py-1 text-right">{queue.delayed}</td>
                            <td
                                className={cn(
                                    'px-1 py-1 text-right',
                                    queue.failed > 0 && 'text-[#F28B82]'
                                )}
                            >
                                {queue.failed}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    </Card>
)

/** S8 */
const WorkersCard: React.FC<{ worker: AdminHealth['worker'] }> = ({ worker }) => (
    <Card title={`Workers (${worker.workers.length})`} status={worker.status}>
        {worker.workers.length === 0 ? (
            <Muted>{worker.detail}</Muted>
        ) : (
            worker.workers.map((w) => (
                <div key={w.host} className="flex flex-col gap-1">
                    <Field label={w.host}>
                        {w.secondsAgo < 60
                            ? `seen ${w.secondsAgo} s ago`
                            : `seen ${formatRelativeTime(w.at)}`}
                    </Field>
                    <Field label="Last hour">
                        {w.jobsDoneLastHour ?? 0} done · {w.jobsFailedLastHour ?? 0} failed
                        {w.memoryMb != null && ` · ${w.memoryMb} MB`}
                    </Field>
                </div>
            ))
        )}
    </Card>
)

const DEPLOY_COLOR: Record<string, string> = {
    success: '#4ade80',
    failure: '#f87171',
    active: '#fbbf24',
    idle: '#fbbf24',
    canceled: '#6B6A68',
    skipped: '#6B6A68',
}
const DEPLOY_TEXT: Record<string, string> = {
    success: 'Live',
    failure: 'Failed',
    active: 'Building',
    idle: 'Queued',
    canceled: 'Canceled',
    skipped: 'Skipped',
}

type EdgeData = Extract<AdminEdge, { error: null }>
type PageSpeedData = Extract<AdminPageSpeed, { error: null }>

const cloudflareError = (part: AdminEdge | AdminPageSpeed | undefined) =>
    part && part.connected && 'error' in part && part.error !== null ? part.error : null

// Google's limits for a page load (LCP): good up to 2.5 s, poor over 4 s
const loadColor = (ms: number | null) =>
    ms === null
        ? 'text-[#7B7A79]'
        : ms <= 2500
          ? 'text-[#7FD49A]'
          : ms <= 4000
            ? 'text-[#F2C07B]'
            : 'text-[#F28B82]'

/**
 * C3, C4, C5 in one small card: the last deploy of each site, the last 24 hours at
 * Cloudflare's edge, and how fast pages load for real visitors.
 */
const CloudflareCard: React.FC<{
    deploys: AdminDeploys | undefined
    edge: AdminEdge | undefined
    speed: AdminPageSpeed | undefined
}> = ({ deploys, edge, speed }) => {
    if (!deploys) return null
    if (!deploys.connected) return <Muted>Cloudflare is not connected yet</Muted>
    const edgeData = edge?.connected && !cloudflareError(edge) ? (edge as EdgeData) : null
    const speedData = speed?.connected && !cloudflareError(speed) ? (speed as PageSpeedData) : null
    const failedDeploy = deploys.projects.some((p) => p.deploys[0]?.status === 'failure')
    const status: CheckStatus =
        failedDeploy || (edgeData?.serverErrors ?? 0) > 50
            ? 'down'
            : (edgeData?.serverErrors ?? 0) > 0
              ? 'warn'
              : 'ok'

    return (
        <Card title="Cloudflare" status={status}>
            {/* C3: the newest deploy of each project */}
            <div className="flex flex-col gap-2">
                {deploys.projects.map((project) => {
                    const latest = project.deploys[0]
                    return (
                        <div
                            key={project.name}
                            aria-label={`Deploys of ${project.name}`}
                            className="flex items-start gap-2 min-w-0"
                        >
                            <span
                                className="w-2 h-2 rounded-full shrink-0 mt-[5px]"
                                style={{
                                    backgroundColor: latest
                                        ? (DEPLOY_COLOR[latest.status] ?? '#6B6A68')
                                        : '#6B6A68',
                                }}
                            />
                            <div className="flex flex-col gap-0.5 min-w-0 flex-1">
                                <span className="text-[12.5px] text-[#D6D5C9] truncate">
                                    <span className="text-[#EDEDED]">{project.name}</span>
                                    {latest?.message ? ` · ${latest.message}` : ''}
                                </span>
                                {project.error ? (
                                    <span className="text-[12px] text-[#F28B82] truncate">
                                        {project.error}
                                    </span>
                                ) : latest ? (
                                    <Muted className="truncate">
                                        {DEPLOY_TEXT[latest.status] ?? latest.status}
                                        {latest.commit && ` · ${latest.commit}`}
                                        {latest.createdAt &&
                                            ` · ${formatRelativeTime(latest.createdAt)}`}
                                    </Muted>
                                ) : (
                                    <Muted>No deploys yet</Muted>
                                )}
                            </div>
                        </div>
                    )
                })}
            </div>

            {/* C4 */}
            {cloudflareError(edge) ? (
                <span className="text-[12px] text-[#F28B82]">Edge: {cloudflareError(edge)}</span>
            ) : (
                edgeData && (
                    <Field label="Last 24 hours">
                        {edgeData.requests.toLocaleString()} requests ·{' '}
                        <span className={cn(edgeData.serverErrors > 0 && 'text-[#F28B82]')}>
                            {edgeData.serverErrors} 5xx
                        </span>{' '}
                        · {edgeData.blocked} blocked
                        {edgeData.cacheHitPct !== null && ` · ${edgeData.cacheHitPct}% cached`}
                    </Field>
                )
            )}

            {/* C5: the 75th percentile page load of real visitors */}
            {cloudflareError(speed) ? (
                <span className="text-[12px] text-[#F28B82]">
                    Page speed: {cloudflareError(speed)}
                </span>
            ) : (
                speedData &&
                speedData.sites.map((site) => (
                    <Field key={site.host} label={`${site.label} load`}>
                        <span className={loadColor(site.lcpMs)}>
                            {site.lcpMs === null ? '-' : `${(site.lcpMs / 1000).toFixed(1)} s`}
                        </span>
                        {site.lcpGoodPct != null && (
                            <span className="text-[#7B7A79]"> · {site.lcpGoodPct}% good</span>
                        )}
                    </Field>
                ))
            )}
        </Card>
    )
}

/** S10: the last 5 failed jobs, shown only when there are some */
const FailedJobs: React.FC = () => {
    const { data } = useQuery({
        queryKey: ['admin', 'failed-jobs'],
        queryFn: () => adminAPI.getFailedJobs(),
    })
    const items = (data?.items ?? []).slice(0, 5)
    if (items.length === 0) return null
    return (
        <AdminSection title="Failed jobs">
            <AdminList empty="">
                {items.map((job) => (
                    <AdminRow key={`${job.queue}-${job.id}`}>
                        <div className="flex flex-col gap-0.5 min-w-0 flex-1">
                            <span className="text-[13.5px] text-[#D6D5C9]">
                                {job.name} <Muted>· {job.queue}</Muted>
                            </span>
                            <Muted className="break-words line-clamp-2">
                                <span title={job.reason}>{job.reason || 'no error text'}</span>
                            </Muted>
                        </div>
                        <Muted>{shortDate(job.failedAt)}</Muted>
                    </AdminRow>
                ))}
            </AdminList>
        </AdminSection>
    )
}

export const AdminSystem: React.FC = () => {
    const queryClient = useQueryClient()
    const {
        data: health,
        error,
        dataUpdatedAt,
        isFetching,
    } = useQuery({
        queryKey: ['admin', 'health'],
        queryFn: () => adminAPI.getHealth(),
    })
    const { data: publicStatus, error: publicError } = useQuery({
        queryKey: ['admin', 'public-status'],
        queryFn: () => adminAPI.getPublicStatus(),
    })
    const { data: deploys } = useQuery({
        queryKey: ['admin', 'deploys'],
        queryFn: () => adminAPI.getDeploys(),
    })
    const { data: edge } = useQuery({
        queryKey: ['admin', 'edge'],
        queryFn: () => adminAPI.getEdge(),
    })
    const { data: pageSpeed } = useQuery({
        queryKey: ['admin', 'page-speed'],
        queryFn: () => adminAPI.getPageSpeed(),
    })
    // skip the server's short caches: health, the public status and the failed jobs
    // B6: each part that came back is shown even when another part fails, and the failure
    // is said instead of the old "Updated" time staying quietly
    const refresh = useMutation({
        mutationFn: async () => {
            const parts: Array<[string[], Promise<unknown>]> = [
                [['admin', 'health'], adminAPI.getHealth(true)],
                [['admin', 'public-status'], adminAPI.getPublicStatus(true)],
                [['admin', 'failed-jobs'], adminAPI.getFailedJobs(true)],
                [['admin', 'deploys'], adminAPI.getDeploys(true)],
                [['admin', 'edge'], adminAPI.getEdge(true)],
                [['admin', 'page-speed'], adminAPI.getPageSpeed(true)],
            ]
            const results = await Promise.allSettled(parts.map(([, read]) => read))
            results.forEach((result, i) => {
                if (result.status === 'fulfilled') {
                    queryClient.setQueryData(parts[i]![0], result.value)
                }
            })
            const failed = results.find((r) => r.status === 'rejected')
            if (failed) {
                const reason = (failed as PromiseRejectedResult).reason
                throw new Error(
                    `Some parts did not refresh: ${reason instanceof Error ? reason.message : 'unknown error'}`
                )
            }
        },
    })

    return (
        <>
            <RefreshLine
                updatedAt={dataUpdatedAt}
                isFetching={isFetching || refresh.isPending}
                onRefresh={() => refresh.mutate()}
            />
            <ErrorLine error={refresh.error} />

            {/* S1 */}
            <PublicStatus status={publicStatus} error={publicError} />

            {/* C3, C4, C5 */}
            <CloudflareCard deploys={deploys} edge={edge} speed={pageSpeed} />

            <ErrorLine error={error} />
            {!health && !error && <AdminSkeleton tiles rows={3} />}
            {health && (
                <>
                    {/* S2: one line that says if anything inside needs a look */}
                    {(() => {
                        const { problems, status } = problemsOf(health)
                        return (
                            <span className="flex items-center gap-2 text-[14px] text-[#EDEDED]">
                                <StatusDot status={status} />
                                {problems.length === 0
                                    ? 'Inside: all good'
                                    : `Needs a look: ${problems.join(' · ')}`}
                            </span>
                        )
                    })()}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <ServerCard server={health.server} />
                        <MachineCard machine={health.machine} />
                        <DataCard database={health.database} redis={health.redis} />
                        <WorkersCard worker={health.worker} />
                        <ErrorsCard errors={health.errors} />
                        <QueuesCard queues={health.queues} />
                    </div>

                    <FailedJobs />
                    <AdminSandboxes counts={health.sandboxes} />
                </>
            )}
        </>
    )
}
