import React from 'react'

import { PAGE_SUBTITLES } from './settingsStyles'
import {
    SettingsPage,
    SettingsRow,
    SettingsSection,
    SettingsSoon,
    outlineButtonClass,
    usePreviewOn,
    usePreviewValue,
} from './SettingsUi'

import {
    ChoiceGroup,
    FormError,
    ListBox,
    ListRows,
    ModalActions,
    fieldLabelClass,
    inputClass,
    textareaClass,
} from '@/features/connections/components/ConnectionsUi'
import { Modal } from '@/shared/components/ui/Modal'

interface RunningSandbox {
    id: string
    title: string
    repo: string
    detail: string
}

interface SetupCommand {
    repo: string
    commands: string
}

// sample rows for the ui-only page. the real lists come with the server part (issue 637)
const SAMPLE_RUNNING: RunningSandbox[] = [
    { id: 's1', title: 'fix-login-redirect', repo: 'acme/web', detail: '38 min · $0.21' },
    { id: 's2', title: 'add-csv-export', repo: 'acme/api', detail: '6 min · $0.03' },
]
const SAMPLE_SETUP: SetupCommand[] = [
    { repo: 'acme/web', commands: 'bun install' },
    { repo: 'acme/api', commands: 'pip install -r requirements.txt' },
]

const pick = <T extends string>(...pairs: [T, string][]) =>
    pairs.map(([value, label]) => ({ value, label }))
const IDLE = pick(['10', '10 min'], ['30', '30 min'], ['60', '1 hour'])
const ARCHIVE = pick(['7', '7 days'], ['30', '30 days'], ['never', 'Never'])
const SIZE = pick(['standard', 'Standard'], ['large', 'Large'])

/**
 * Sandbox (N3-A): what runs now with Stop, the idle time, when to archive, the machine
 * size, and setup commands for each repository. Ui only (issue 637).
 */
export const ProfileSandboxSettings: React.FC = () => {
    const isPreview = usePreviewOn()
    const [running, setRunning] = usePreviewValue('sandbox.running', SAMPLE_RUNNING)
    const [idle, setIdle] = usePreviewValue<'10' | '30' | '60'>('sandbox.idle', '10')
    const [archive, setArchive] = usePreviewValue<'7' | '30' | 'never'>('sandbox.archive', '30')
    const [size, setSize] = usePreviewValue<'standard' | 'large'>('sandbox.size', 'standard')
    const [setup, setSetup] = usePreviewValue('sandbox.setup', SAMPLE_SETUP)

    // the setup dialog: null is closed, an index edits that row, -1 adds a row
    const [editing, setEditing] = React.useState<number | null>(null)
    const [repo, setRepo] = React.useState('')
    const [commands, setCommands] = React.useState('')
    const [formError, setFormError] = React.useState<string | null>(null)

    if (!isPreview) {
        return (
            <SettingsSoon
                title="Sandbox"
                subtitle={PAGE_SUBTITLES.sandbox}
                text="Sandbox settings are coming soon"
            />
        )
    }

    const openSetup = (index: number) => {
        const row = index >= 0 ? setup[index] : undefined
        setRepo(row?.repo ?? '')
        setCommands(row?.commands ?? '')
        setFormError(null)
        setEditing(index)
    }

    const saveSetup = (event: React.FormEvent) => {
        event.preventDefault()
        // the modal is portaled, so stop the submit reaching a form behind it
        event.stopPropagation()
        if (editing === null) return
        const next: SetupCommand = { repo: repo.trim(), commands: commands.trim() }
        if (!/^[\w.-]+\/[\w.-]+$/.test(next.repo)) {
            setFormError('Enter the repository as owner/name.')
            return
        }
        setSetup(
            editing >= 0 ? setup.map((row, i) => (i === editing ? next : row)) : [...setup, next]
        )
        setEditing(null)
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
                                    key={sandbox.id}
                                    className="flex items-center gap-3 px-3.5 md:px-4 py-3 text-[13px]"
                                >
                                    <div className="flex flex-col min-w-0 flex-1">
                                        <span className="text-[#D6D5C9] font-medium truncate">
                                            {sandbox.title}
                                        </span>
                                        <span className="text-[12px] text-[#7B7A79] truncate">
                                            {sandbox.repo} · {sandbox.detail}
                                        </span>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() =>
                                            setRunning(running.filter((r) => r.id !== sandbox.id))
                                        }
                                        aria-label={`Stop ${sandbox.title}`}
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
                        value={idle}
                        onChange={setIdle}
                    />
                </SettingsRow>
                <SettingsRow label="Archive sessions after">
                    <ChoiceGroup
                        label="Archive sessions after"
                        options={ARCHIVE}
                        value={archive}
                        onChange={setArchive}
                    />
                </SettingsRow>
                <SettingsRow label="Machine size">
                    <ChoiceGroup
                        label="Machine size"
                        options={SIZE}
                        value={size}
                        onChange={setSize}
                    />
                </SettingsRow>
            </SettingsSection>

            <SettingsSection
                title="Setup commands"
                description="Commands that run after the repository is cloned."
                bare
                action={
                    <button
                        type="button"
                        onClick={() => openSetup(-1)}
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
                            {setup.map((row, index) => (
                                <div
                                    key={row.repo}
                                    className="flex items-center gap-3 px-3.5 md:px-4 py-3 text-[13px]"
                                >
                                    <div className="flex flex-col min-w-0 flex-1">
                                        <span className="text-[#D6D5C9] font-medium truncate">
                                            {row.repo}
                                        </span>
                                        <span className="text-[12px] text-[#7B7A79] font-mono truncate">
                                            {row.commands}
                                        </span>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => openSetup(index)}
                                        aria-label={`Edit setup commands of ${row.repo}`}
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
                <form onSubmit={saveSetup} className="flex flex-col gap-4">
                    <div className="flex flex-col gap-1.5">
                        <label htmlFor="setup-repo-input" className={fieldLabelClass}>
                            Repository
                        </label>
                        <input
                            id="setup-repo-input"
                            type="text"
                            autoFocus
                            value={repo}
                            onChange={(e) => setRepo(e.target.value)}
                            placeholder="owner/name"
                            className={inputClass}
                        />
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
                            className={textareaClass}
                        />
                    </div>
                    <FormError>{formError}</FormError>
                    <ModalActions
                        onCancel={() => setEditing(null)}
                        submitLabel="Save"
                        submitDisabled={!repo.trim() || !commands.trim()}
                    />
                </form>
            </Modal>
        </SettingsPage>
    )
}
