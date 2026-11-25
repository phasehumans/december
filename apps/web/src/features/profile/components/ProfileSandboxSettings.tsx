import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import React from 'react'

import { PAGE_SUBTITLES } from './settingsStyles'
import {
    SettingsPage,
    SettingsRow,
    SettingsSection,
    SettingsSelect,
    outlineButtonClass,
    usePreviewOn,
    usePreviewValue,
} from './SettingsUi'

import {
    ChoiceGroup,
    DemoPill,
    FormError,
    ListBox,
    ListRows,
    ModalActions,
    SecondaryButton,
    fieldLabelClass,
    textareaClass,
} from '@/features/connections/components/ConnectionsUi'
import { profileAPI } from '@/features/profile/api/profile'
import {
    sandboxAPI,
    type ArchiveAfterDays,
    type IdleStopMinutes,
    type RunningSandbox,
    type SandboxSettings,
} from '@/features/profile/api/sandbox'
import { useConnectedRepos } from '@/features/profile/hooks/useConnectedRepos'
import { Modal } from '@/shared/components/ui/Modal'

const SETTINGS_KEY = ['sandbox-settings']
const RUNNING_KEY = ['sandbox-running']
// the same limit as the server
const SETUP_COMMANDS_MAX_LENGTH = 4000
// the value of the repository select before a repository is picked
const NO_REPOSITORY = ''

const pick = <T extends string>(...pairs: [T, string][]) =>
    pairs.map(([value, label]) => ({ value, label }))
const IDLE = pick(['10', '10 min'], ['30', '30 min'], ['60', '1 hour'])
const ARCHIVE = pick(['7', '7 days'], ['30', '30 days'], ['never', 'Never'])
const SIZE = pick(['standard', 'Standard'], ['large', 'Large'])

/** "38 min" or "2 h 5 min": how long ago the session started */
const formatRunTime = (startedAt: string, now: number): string => {
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

/**
 * Sandbox (N3-A, issue 637): what runs now with Stop, the idle time, when to archive, and
 * setup commands for each repository. The machine size is ui only: it shows with the
 * preview on.
 */
export const ProfileSandboxSettings: React.FC = () => {
    const isPreview = usePreviewOn()
    const queryClient = useQueryClient()
    const [size, setSize] = usePreviewValue<'standard' | 'large'>('sandbox.size', 'standard')

    const settingsQuery = useQuery({ queryKey: SETTINGS_KEY, queryFn: sandboxAPI.getSettings })
    const settings = settingsQuery.data
    const runningQuery = useQuery({ queryKey: RUNNING_KEY, queryFn: sandboxAPI.getRunning })
    const running = runningQuery.data?.items ?? []
    const { data: profile } = useQuery({ queryKey: ['profile'], queryFn: profileAPI.getProfile })
    const { repos } = useConnectedRepos({
        enabled: Boolean(profile),
        isGithubConnected: Boolean(profile?.githubAppInstall || profile?.githubConnected),
    })

    const save = useMutation({
        mutationFn: (
            patch: Partial<Pick<SandboxSettings, 'idleStopMinutes' | 'archiveAfterDays'>>
        ) => sandboxAPI.updateSettings(patch),
        onMutate: async (patch) => {
            await queryClient.cancelQueries({ queryKey: SETTINGS_KEY })
            const previous = queryClient.getQueryData<SandboxSettings>(SETTINGS_KEY)
            if (previous) queryClient.setQueryData(SETTINGS_KEY, { ...previous, ...patch })
            return { previous }
        },
        onError: (_error, _patch, context) => {
            if (context?.previous) queryClient.setQueryData(SETTINGS_KEY, context.previous)
        },
        onSuccess: (saved) => queryClient.setQueryData(SETTINGS_KEY, saved),
    })

    // the answer of the stop is the state it leads to: the list is not read again at once
    const stop = useMutation({
        mutationFn: (sessionId: string) => sandboxAPI.stop(sessionId),
        onSuccess: (stopped) => {
            const current = queryClient.getQueryData<{ items: RunningSandbox[] }>(RUNNING_KEY)
            if (!current) return
            const status = stopped.sandboxStatus
            queryClient.setQueryData(RUNNING_KEY, {
                items: current.items.flatMap((item) => {
                    if (item.sessionId !== stopped.sessionId) return [item]
                    // a sandbox that still starts or runs stays in the list
                    return status === 'RUNNING' || status === 'STARTING'
                        ? [{ ...item, sandboxStatus: status }]
                        : []
                }),
            })
        },
    })

    // the setup dialog: null is closed, a repository name edits that row, '' adds a row
    const [editing, setEditing] = React.useState<string | null>(null)
    const [repo, setRepo] = React.useState(NO_REPOSITORY)
    const [commands, setCommands] = React.useState('')
    const [formError, setFormError] = React.useState<string | null>(null)

    const saveSetup = useMutation({
        mutationFn: (data: { repoFullName: string; commands: string }) =>
            sandboxAPI.setSetupCommands(data),
        onSuccess: (saved) => {
            queryClient.setQueryData(SETTINGS_KEY, saved)
            setEditing(null)
        },
        onError: (error: Error) => setFormError(error.message || 'Could not save.'),
    })

    if (!settings) {
        return (
            <SettingsPage title="Sandbox" subtitle={PAGE_SUBTITLES.sandbox}>
                {settingsQuery.isError && (
                    <p className="text-[13px] text-[#7B7A79]">Could not load the settings.</p>
                )}
            </SettingsPage>
        )
    }

    const setup = settings.setupCommands
    // the server keeps a repository in lower case: show the name as the git host writes it
    const repoLabel = (repoFullName: string) =>
        repos.find((item) => item.fullName.toLowerCase() === repoFullName.toLowerCase())
            ?.fullName ?? repoFullName
    // a new row picks from the repositories that have no setup commands yet
    const repoOptions = [
        { value: NO_REPOSITORY, label: 'Pick a repository' },
        ...repos
            .filter(
                (item) => !setup.some((row) => row.repoFullName === item.fullName.toLowerCase())
            )
            .map((item) => ({ value: item.fullName, label: item.fullName })),
    ]
    const now = Date.now()

    const openSetup = (repoFullName: string) => {
        const row = setup.find((item) => item.repoFullName === repoFullName)
        setRepo(row?.repoFullName ?? NO_REPOSITORY)
        setCommands(row?.commands ?? '')
        setFormError(null)
        setEditing(repoFullName)
    }

    const submitSetup = (event: React.FormEvent) => {
        event.preventDefault()
        // the modal is portaled, so stop the submit reaching a form behind it
        event.stopPropagation()
        if (editing === null || !repo) return
        if (commands.length > SETUP_COMMANDS_MAX_LENGTH) {
            setFormError(`Use at most ${SETUP_COMMANDS_MAX_LENGTH} characters.`)
            return
        }
        saveSetup.mutate({ repoFullName: repo, commands: commands.trim() })
    }

    return (
        <SettingsPage title="Sandbox" subtitle={PAGE_SUBTITLES.sandbox}>
            <SettingsSection
                title="Running now"
                description="Sandboxes that use credits right now."
                action={
                    running.length > 0 && (
                        <span className="text-[13px] text-[#7B7A79]">{running.length} running</span>
                    )
                }
                bare
            >
                {running.length === 0 ? (
                    <ListBox>
                        <div className="px-4 py-6 text-[13px] text-[#7B7A79]">
                            No sandbox runs now
                        </div>
                    </ListBox>
                ) : (
                    <ListBox>
                        <ListRows>
                            {running.map((sandbox) => (
                                <div
                                    key={sandbox.sessionId}
                                    className="flex items-center gap-3 px-3.5 md:px-4 py-3 text-[13px]"
                                >
                                    <div className="flex flex-col min-w-0 flex-1">
                                        <span className="text-[#D6D5C9] font-medium truncate">
                                            {sandbox.title || 'Untitled session'}
                                        </span>
                                        <span className="text-[12px] text-[#7B7A79] truncate">
                                            {runningDetail(sandbox, now)}
                                        </span>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => stop.mutate(sandbox.sessionId)}
                                        disabled={
                                            stop.isPending && stop.variables === sandbox.sessionId
                                        }
                                        aria-label={`Stop ${sandbox.title || 'Untitled session'}`}
                                        className={outlineButtonClass}
                                    >
                                        Stop
                                    </button>
                                </div>
                            ))}
                        </ListRows>
                    </ListBox>
                )}
            </SettingsSection>

            <SettingsSection title="Limits" description="When a sandbox stops, and its size.">
                <SettingsRow label="Stop when idle for">
                    <ChoiceGroup
                        label="Stop when idle for"
                        options={IDLE}
                        value={String(settings.idleStopMinutes) as (typeof IDLE)[number]['value']}
                        onChange={(value) =>
                            save.mutate({ idleStopMinutes: Number(value) as IdleStopMinutes })
                        }
                    />
                </SettingsRow>
                <SettingsRow label="Archive sessions after">
                    <ChoiceGroup
                        label="Archive sessions after"
                        options={ARCHIVE}
                        value={
                            (settings.archiveAfterDays === null
                                ? 'never'
                                : String(
                                      settings.archiveAfterDays
                                  )) as (typeof ARCHIVE)[number]['value']
                        }
                        onChange={(value) =>
                            save.mutate({
                                archiveAfterDays:
                                    value === 'never' ? null : (Number(value) as ArchiveAfterDays),
                            })
                        }
                    />
                </SettingsRow>
                {/* ui only: a second machine size needs its own E2B template and a price */}
                {isPreview && (
                    <SettingsRow
                        label={
                            <span className="inline-flex items-center gap-2">
                                Machine size
                                <DemoPill />
                            </span>
                        }
                    >
                        <ChoiceGroup
                            label="Machine size"
                            options={SIZE}
                            value={size}
                            onChange={setSize}
                        />
                    </SettingsRow>
                )}
            </SettingsSection>

            <SettingsSection
                title="Setup commands"
                description="Commands that run after the repository is cloned."
                bare
                action={
                    <button
                        type="button"
                        onClick={() => openSetup(NO_REPOSITORY)}
                        className={outlineButtonClass}
                    >
                        Add repository
                    </button>
                }
            >
                <ListBox>
                    {setup.length === 0 ? (
                        <div className="px-4 py-6 text-[13px] text-[#7B7A79]">
                            No setup commands yet
                        </div>
                    ) : (
                        <ListRows>
                            {setup.map((row) => (
                                <div
                                    key={row.repoFullName}
                                    className="flex items-center gap-3 px-3.5 md:px-4 py-3 text-[13px]"
                                >
                                    <div className="flex flex-col min-w-0 flex-1">
                                        <span className="text-[#D6D5C9] font-medium truncate">
                                            {repoLabel(row.repoFullName)}
                                        </span>
                                        <span className="text-[12px] text-[#7B7A79] font-mono truncate">
                                            {row.commands}
                                        </span>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => openSetup(row.repoFullName)}
                                        aria-label={`Edit setup commands of ${repoLabel(row.repoFullName)}`}
                                        className={outlineButtonClass}
                                    >
                                        Edit
                                    </button>
                                </div>
                            ))}
                        </ListRows>
                    )}
                </ListBox>
            </SettingsSection>

            <Modal
                isOpen={editing !== null}
                onClose={() => setEditing(null)}
                title="Setup commands"
                description="They run in the sandbox after the repository is cloned."
                variant="premium"
                showLogo={false}
                sheetOnPhone
            >
                <form onSubmit={submitSetup} className="flex flex-col gap-4">
                    <div className="flex flex-col gap-1.5">
                        <span className={fieldLabelClass}>Repository</span>
                        {editing ? (
                            <span className="text-[13px] text-[#D6D5C9]">{repoLabel(editing)}</span>
                        ) : (
                            <SettingsSelect
                                label="Repository"
                                value={repo}
                                options={repoOptions}
                                onChange={setRepo}
                                className="w-full"
                            />
                        )}
                    </div>
                    <div className="flex flex-col gap-1.5">
                        <label htmlFor="setup-commands-input" className={fieldLabelClass}>
                            Commands
                        </label>
                        <textarea
                            id="setup-commands-input"
                            rows={4}
                            value={commands}
                            onChange={(e) => setCommands(e.target.value)}
                            placeholder="bun install"
                            maxLength={SETUP_COMMANDS_MAX_LENGTH}
                            className={textareaClass}
                        />
                    </div>
                    <FormError>{formError}</FormError>
                    <ModalActions
                        onCancel={() => setEditing(null)}
                        submitLabel="Save"
                        submitDisabled={!repo || !commands.trim()}
                        isPending={saveSetup.isPending}
                        leading={
                            editing ? (
                                <SecondaryButton
                                    onClick={() =>
                                        saveSetup.mutate({ repoFullName: editing, commands: '' })
                                    }
                                    disabled={saveSetup.isPending}
                                >
                                    Remove
                                </SecondaryButton>
                            ) : undefined
                        }
                    />
                </form>
            </Modal>
        </SettingsPage>
    )
}
