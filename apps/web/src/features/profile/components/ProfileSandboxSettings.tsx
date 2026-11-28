import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import React from 'react'

import {
    PAGE_SUBTITLES,
    listBoxClass,
    listRowClass,
    listRowNoteClass,
    listRowTitleClass,
    listRowsClass,
    outlineButtonClass,
    sectionBoxClass,
} from './settingsStyles'
import {
    SettingsEmptyArt,
    SettingsPage,
    SettingsRow,
    SettingsSection,
    usePreviewOn,
    usePreviewValue,
} from './SettingsUi'

import { ChoiceGroup, DemoPill } from '@/features/connections/components/ConnectionsUi'
import {
    sandboxAPI,
    type ArchiveAfterDays,
    type IdleStopMinutes,
    type RunningSandbox,
    type SandboxSettings,
} from '@/features/profile/api/sandbox'
import { Skeleton } from '@/shared/components/ui/Skeleton'
import { isSkeletonPreviewActive } from '@/shared/lib/skeletonPreview'

const SANDBOX_SETTINGS_KEY = ['sandbox-settings'] as const
const RUNNING_SANDBOXES_KEY = ['sandbox-running'] as const

/** the running list is read again this often while the page is open (and on focus) */
const RUNNING_REFRESH_MS = 15 * 1000
/** the run time of each row moves on this often */
const CLOCK_TICK_MS = 30 * 1000
/**
 * A stopped row leaves the list at once. The worker pauses the sandbox a moment later, so
 * a read in between still lists it: the row stays hidden for this long. A pause that did
 * not happen (a new prompt holds the sandbox) shows the row again after it.
 */
export const STOPPED_HIDE_MS = 2 * 60 * 1000

const pick = <T extends string>(...pairs: [T, string][]) =>
    pairs.map(([value, label]) => ({ value, label }))
const IDLE = pick(['10', '10 min'], ['30', '30 min'], ['60', '1 hour'])
const ARCHIVE = pick(['7', '7 days'], ['30', '30 days'], ['never', 'Never'])
const SIZE = pick(['standard', 'Standard'], ['large', 'Large'])

type IdleChoice = (typeof IDLE)[number]['value']
type ArchiveChoice = (typeof ARCHIVE)[number]['value']

const errorText = (error: unknown, fallback: string) =>
    error instanceof Error && error.message ? error.message : fallback

/** "38 min" or "2 h 5 min": how long the sandbox has run */
export const formatRunTime = (startedAt: string, now: number): string => {
    const minutes = Math.max(0, Math.floor((now - new Date(startedAt).getTime()) / 60000))
    if (minutes < 60) return `${minutes} min`
    return `${Math.floor(minutes / 60)} h ${minutes % 60} min`
}

/** the grey line of a running row: repository, time (or Starting) and cost so far */
const runningDetail = (sandbox: RunningSandbox, now: number): string =>
    [
        sandbox.repoFullName,
        sandbox.sandboxStatus === 'STARTING' ? 'Starting' : formatRunTime(sandbox.startedAt, now),
        `$${(sandbox.costInCents / 100).toFixed(2)}`,
    ]
        .filter(Boolean)
        .join(' · ')

/** what this page knows about the stop of one row */
type StopState = { pending?: boolean; stoppedAt?: number; error?: string }

const LoadError: React.FC<{ text: string; onRetry: () => void }> = ({ text, onRetry }) => (
    <div className="flex items-center justify-between gap-3 px-4 py-3 text-[13px] text-[#7B7A79]">
        <span className="min-w-0">{text}</span>
        <button type="button" onClick={onRetry} className={outlineButtonClass}>
            Try again
        </button>
    </div>
)

const RunningSkeleton: React.FC = () => (
    <div className={listRowsClass} data-testid="running-skeleton">
        {[0, 1].map((row) => (
            <div key={row} className={listRowClass}>
                <div className="flex flex-col gap-1.5 min-w-0 flex-1">
                    <Skeleton className="h-4 w-40 max-w-[70%] bg-white/[0.04] rounded" />
                    <Skeleton className="h-3 w-56 max-w-[85%] bg-white/[0.025] rounded" />
                </div>
                <Skeleton className="w-[62px] h-[31px] rounded-lg bg-white/[0.03] shrink-0" />
            </div>
        ))}
    </div>
)

const LimitsSkeleton: React.FC = () => (
    <div className={sectionBoxClass} data-testid="limits-skeleton">
        {[0, 1].map((row) => (
            <div key={row} className="flex items-center justify-between gap-3 min-h-8">
                <Skeleton className="h-4 w-36 bg-white/[0.04] rounded" />
                <Skeleton className="h-[30px] w-[170px] rounded-lg bg-white/[0.03] shrink-0" />
            </div>
        ))}
    </div>
)

/**
 * Sandbox (N3-A, issue 637): what runs now with Stop, the idle time and when to archive.
 * The machine size is ui only: it shows with the preview on.
 */
export const ProfileSandboxSettings: React.FC = () => {
    const isPreview = usePreviewOn()
    const queryClient = useQueryClient()
    const [size, setSize] = usePreviewValue<'standard' | 'large'>('sandbox.size', 'standard')
    const skeletonPreview = isSkeletonPreviewActive()

    // the run times are read from the clock at each render: this tick renders the page again
    const [, setTick] = React.useState(0)
    React.useEffect(() => {
        const timer = setInterval(() => setTick((tick) => tick + 1), CLOCK_TICK_MS)
        return () => clearInterval(timer)
    }, [])
    const now = Date.now()

    const settingsQuery = useQuery({
        queryKey: SANDBOX_SETTINGS_KEY,
        queryFn: sandboxAPI.getSettings,
    })
    const runningQuery = useQuery({
        queryKey: RUNNING_SANDBOXES_KEY,
        queryFn: sandboxAPI.getRunning,
        refetchInterval: RUNNING_REFRESH_MS,
    })

    const save = useMutation({
        mutationFn: (patch: Partial<SandboxSettings>) => sandboxAPI.updateSettings(patch),
        onMutate: async (patch) => {
            await queryClient.cancelQueries({ queryKey: SANDBOX_SETTINGS_KEY })
            const previous = queryClient.getQueryData<SandboxSettings>(SANDBOX_SETTINGS_KEY)
            if (previous) queryClient.setQueryData(SANDBOX_SETTINGS_KEY, { ...previous, ...patch })
            return { previous }
        },
        onError: (_error, _patch, context) => {
            if (context?.previous) queryClient.setQueryData(SANDBOX_SETTINGS_KEY, context.previous)
        },
        onSuccess: (saved) => queryClient.setQueryData(SANDBOX_SETTINGS_KEY, saved),
        // a failed save rolls back to the values before it, which can hide a newer save
        // that finished first: the saved values come back from the server
        onSettled: (_saved, error) => {
            if (error) void queryClient.invalidateQueries({ queryKey: SANDBOX_SETTINGS_KEY })
        },
    })
    // a save that failed shows its error under the row it came from
    const failedPatch = save.isError ? save.variables : undefined
    const errorFor = (key: keyof SandboxSettings) =>
        failedPatch && key in failedPatch ? errorText(save.error, 'Could not save') : undefined

    // each row keeps its own stop state, so two stops at once do not mix up
    const [stops, setStops] = React.useState<Record<string, StopState>>({})
    const setStop = React.useCallback(
        (sessionId: string, state: StopState | null) =>
            setStops((current) => {
                const next = { ...current }
                if (state) next[sessionId] = state
                else delete next[sessionId]
                return next
            }),
        []
    )

    const stop = useMutation({
        mutationFn: (sessionId: string) => sandboxAPI.stop(sessionId),
        onMutate: (sessionId) => setStop(sessionId, { pending: true }),
        onSuccess: (stopped, sessionId) => {
            const status = stopped.sandboxStatus
            if (status === 'RUNNING' || status === 'STARTING') {
                // the run is stopped, but a sandbox that still starts has nothing to pause
                // yet: the row stays, with the state the server gave
                setStop(sessionId, null)
                queryClient.setQueryData<{ items: RunningSandbox[] }>(
                    RUNNING_SANDBOXES_KEY,
                    (current) =>
                        current && {
                            items: current.items.map((item) =>
                                item.sessionId === sessionId
                                    ? { ...item, sandboxStatus: status }
                                    : item
                            ),
                        }
                )
                return
            }
            setStop(sessionId, { stoppedAt: Date.now() })
        },
        onError: (error, sessionId) => {
            setStop(sessionId, { error: errorText(error, 'Could not stop. Try again.') })
            // a session that is gone (404) leaves the list
            void queryClient.invalidateQueries({ queryKey: RUNNING_SANDBOXES_KEY })
        },
    })

    const items = runningQuery.data?.items
    // a stopped row is hidden while the worker pauses its sandbox
    const running = (items ?? []).filter((sandbox) => {
        const stoppedAt = stops[sandbox.sessionId]?.stoppedAt
        return stoppedAt === undefined || now - stoppedAt >= STOPPED_HIDE_MS
    })

    // a row the server no longer lists needs no stop state
    React.useEffect(() => {
        if (!items) return
        setStops((current: Record<string, StopState>) => {
            const listed = new Set(items.map((item) => item.sessionId))
            const kept = (Object.entries(current) as [string, StopState][]).filter(
                ([sessionId, state]) => listed.has(sessionId) || state.pending
            )
            return kept.length === Object.keys(current).length ? current : Object.fromEntries(kept)
        })
    }, [items])

    const renderRunning = () => {
        if (runningQuery.isPending || skeletonPreview) return <RunningSkeleton />
        if (runningQuery.isError && !items) {
            return (
                <LoadError
                    text="Could not load the running sandboxes."
                    onRetry={() => void runningQuery.refetch()}
                />
            )
        }
        if (running.length === 0) {
            return <SettingsEmptyArt art="sandbox" title="No sandbox runs now" small />
        }
        return (
            <div className={listRowsClass}>
                {running.map((sandbox) => {
                    const title = sandbox.title || 'Untitled session'
                    const state = stops[sandbox.sessionId]
                    return (
                        <div key={sandbox.sessionId} className={listRowClass}>
                            <div className="flex flex-col min-w-0 flex-1">
                                <span className={listRowTitleClass}>{title}</span>
                                {state?.error ? (
                                    <span
                                        role="alert"
                                        className={`${listRowNoteClass} text-red-400`}
                                    >
                                        {state.error}
                                    </span>
                                ) : (
                                    <span className={listRowNoteClass}>
                                        {runningDetail(sandbox, now)}
                                    </span>
                                )}
                            </div>
                            <button
                                type="button"
                                onClick={() => stop.mutate(sandbox.sessionId)}
                                disabled={state?.pending === true}
                                aria-label={`Stop ${title}`}
                                className={`${outlineButtonClass} disabled:opacity-50 disabled:cursor-default`}
                            >
                                {state?.pending ? 'Stopping' : 'Stop'}
                            </button>
                        </div>
                    )
                })}
            </div>
        )
    }

    const renderLimits = () => {
        const settings = settingsQuery.data
        if (settingsQuery.isPending || skeletonPreview) return <LimitsSkeleton />
        if (!settings) {
            return (
                <div className={listBoxClass}>
                    <LoadError
                        text="Could not load the settings."
                        onRetry={() => void settingsQuery.refetch()}
                    />
                </div>
            )
        }
        const archiveValue: ArchiveChoice =
            settings.archiveAfterDays === null
                ? 'never'
                : (String(settings.archiveAfterDays) as ArchiveChoice)
        return (
            <div className={sectionBoxClass}>
                <SettingsRow label="Stop when idle for" hint={errorFor('idleStopMinutes')}>
                    <ChoiceGroup
                        label="Stop when idle for"
                        options={IDLE}
                        value={String(settings.idleStopMinutes) as IdleChoice}
                        onChange={(value) => {
                            const minutes = Number(value) as IdleStopMinutes
                            if (minutes !== settings.idleStopMinutes) {
                                save.mutate({ idleStopMinutes: minutes })
                            }
                        }}
                    />
                </SettingsRow>
                <SettingsRow label="Archive sessions after" hint={errorFor('archiveAfterDays')}>
                    <ChoiceGroup
                        label="Archive sessions after"
                        options={ARCHIVE}
                        value={archiveValue}
                        onChange={(value) => {
                            if (value === archiveValue) return
                            save.mutate({
                                archiveAfterDays:
                                    value === 'never' ? null : (Number(value) as ArchiveAfterDays),
                            })
                        }}
                    />
                </SettingsRow>
            </div>
        )
    }

    return (
        <SettingsPage title="Sandbox" subtitle={PAGE_SUBTITLES.sandbox}>
            <SettingsSection
                title="Running now"
                description="Sandboxes that use credits right now."
                action={
                    running.length > 0 && (
                        <span className="text-[13px] text-[#7B7A79] shrink-0">
                            {running.length} running
                        </span>
                    )
                }
                bare
            >
                <div className={listBoxClass}>{renderRunning()}</div>
            </SettingsSection>

            <SettingsSection
                title="Limits"
                description="When a sandbox stops, and when old sessions are archived."
                bare
            >
                {renderLimits()}
            </SettingsSection>

            {/* ui only: a second machine size needs its own E2B template and a price */}
            {isPreview && (
                <SettingsSection
                    title="Machine size"
                    description="The size of each new sandbox."
                    action={<DemoPill />}
                >
                    <SettingsRow label="Size">
                        <ChoiceGroup
                            label="Machine size"
                            options={SIZE}
                            value={size}
                            onChange={setSize}
                        />
                    </SettingsRow>
                </SettingsSection>
            )}
        </SettingsPage>
    )
}
