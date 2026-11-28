import React from 'react'

import { useConnectionsNav } from '../hooks/useConnectionsNav'
import { useHooks } from '../hooks/useHooks'
import { HOOK_EVENT_LABELS, HOOK_EVENTS, TOOL_HOOK_EVENTS, type HookEvent } from '../types'

import {
    ChoiceGroup,
    ConfirmModal,
    DoneHint,
    EmptyRow,
    FormError,
    ListBox,
    ListHeader,
    ListRow,
    ListRows,
    ListSkeleton,
    ModalActions,
    MoreMenu,
    PrimaryButton,
    RowActions,
    SearchInput,
    SecondaryButton,
    Switch,
    WhiteButton,
    fieldLabelClass,
    inputClass,
    matchesQuery,
    textareaClass,
    useFlash,
} from './ConnectionsUi'

import type { ApiHook, HookInput } from '../api/hooks'

import { SettingsSelect } from '@/features/profile/components/SettingsUi'
import { Modal } from '@/shared/components/ui/Modal'
import { apiErrorMessage } from '@/shared/lib/apiErrorMessage'
import { cn } from '@/shared/lib/utils'

// user hooks saved on the account, in the cli's hooks.json terms. cloud sessions run them
// in the sandbox, the same way the cli runs ~/.december/hooks.json

/** the limits of the server (MAX_ACCOUNT_HOOKS and the others in @december/shared) */
export const MAX_HOOKS = 50
export const MAX_TIMEOUT = 600
export const MAX_COMMAND = 2000
export const MAX_MATCHER = 200
const DEFAULT_TIMEOUT = 60

type HooksJson = {
    hooks: Partial<
        Record<
            HookEvent,
            { matcher?: string; hooks: { type: 'command'; command: string; timeout?: number }[] }[]
        >
    >
}

/** the same shape as ~/.december/hooks.json, so a cli file can be pasted in */
export const toHooksJson = (
    hooks: Pick<ApiHook, 'event' | 'matcher' | 'command' | 'timeout'>[]
) => {
    const out: HooksJson = { hooks: {} }
    for (const hook of hooks) {
        const list = out.hooks[hook.event] ?? []
        list.push({
            ...(hook.matcher ? { matcher: hook.matcher } : {}),
            hooks: [{ type: 'command', command: hook.command, timeout: hook.timeout }],
        })
        out.hooks[hook.event] = list
    }
    return JSON.stringify(out, null, 2)
}

const isRegex = (value: string) => {
    try {
        new RegExp(value)
        return true
    } catch {
        // Intentionally swallowed: the caller reports the bad matcher
        return false
    }
}

/**
 * Reads a hooks.json like the cli (parseUserHooksData in @december/shared), with the
 * limits of the server. A hook that was saved before keeps its on or off state.
 */
export const parseHooksJson = (
    text: string,
    saved: Pick<ApiHook, 'event' | 'matcher' | 'command' | 'enabled'>[] = []
): { hooks: HookInput[]; error: null } | { hooks: null; error: string } => {
    let data: unknown
    try {
        data = JSON.parse(text)
    } catch {
        // Intentionally swallowed: shown as the error of the editor
        return { hooks: null, error: 'This is not valid JSON' }
    }
    const root = (data as HooksJson | null)?.hooks
    if (!root || typeof root !== 'object' || Array.isArray(root)) {
        return { hooks: null, error: 'Add a "hooks" object' }
    }
    const hooks: HookInput[] = []
    for (const [event, groups] of Object.entries(root)) {
        if (!(HOOK_EVENTS as readonly string[]).includes(event)) {
            return { hooks: null, error: `Unknown event "${event}"` }
        }
        if (!Array.isArray(groups)) return { hooks: null, error: `"${event}" must be a list` }
        for (const group of groups) {
            const matcher = typeof group?.matcher === 'string' ? group.matcher.trim() : ''
            if (matcher.length > MAX_MATCHER || (matcher && matcher !== '*' && !isRegex(matcher))) {
                return { hooks: null, error: `"${event}" has a tools match that is not valid` }
            }
            const entries = Array.isArray(group?.hooks) ? group.hooks : []
            if (entries.length === 0)
                return { hooks: null, error: `A "${event}" entry has no "hooks" list` }
            for (const entry of entries) {
                if (entry?.type !== undefined && entry.type !== 'command') {
                    return { hooks: null, error: `Use "type": "command" in "${event}"` }
                }
                const command = typeof entry?.command === 'string' ? entry.command.trim() : ''
                if (!command) return { hooks: null, error: `A "${event}" hook has no command` }
                if (command.length > MAX_COMMAND) {
                    return {
                        hooks: null,
                        error: `A "${event}" command is over ${MAX_COMMAND} characters`,
                    }
                }
                const timeout = entry.timeout === undefined ? DEFAULT_TIMEOUT : entry.timeout
                if (!Number.isInteger(timeout) || timeout < 1 || timeout > MAX_TIMEOUT) {
                    return { hooks: null, error: `Use a timeout from 1 to ${MAX_TIMEOUT} seconds` }
                }
                const kept = TOOL_HOOK_EVENTS.includes(event as HookEvent) ? matcher : ''
                const before = saved.find(
                    (hook) =>
                        hook.event === event && hook.matcher === kept && hook.command === command
                )
                hooks.push({
                    event: event as HookEvent,
                    matcher: kept,
                    command,
                    timeout,
                    enabled: before?.enabled ?? true,
                })
            }
        }
    }
    if (hooks.length > MAX_HOOKS)
        return { hooks: null, error: `You can save up to ${MAX_HOOKS} hooks` }
    return { hooks, error: null }
}

export const HooksTab: React.FC = () => {
    const { addParam, openAdd, closeAdd } = useConnectionsNav()
    const { hooks, isLoading, loadFailed, setHookEnabled, deleteHook } = useHooks()
    const [view, setView] = React.useState<'list' | 'json'>('list')
    const [query, setQuery] = React.useState('')
    const [editing, setEditing] = React.useState<ApiHook | null>(null)
    const [deleting, setDeleting] = React.useState<ApiHook | null>(null)
    const [actionError, setActionError] = React.useState<string | null>(null)

    const run = (change: Promise<unknown>, fallback: string) => {
        setActionError(null)
        change.catch((error) => setActionError(apiErrorMessage(error, fallback)))
    }

    const filtered = hooks.filter((hook) =>
        matchesQuery(query, hook.command, hook.matcher, HOOK_EVENT_LABELS[hook.event])
    )

    return (
        <div className="flex flex-col gap-4">
            <div className="flex items-center gap-2">
                {view === 'list' && hooks.length > 0 && (
                    <SearchInput value={query} onChange={setQuery} placeholder="Search hooks" />
                )}
                {/* on a phone the search fills the row (the add button is the top bar "+") */}
                <span
                    className={cn(
                        'flex-1',
                        view === 'list' && hooks.length > 0 && 'hidden md:block'
                    )}
                />
                <ChoiceGroup
                    label="Hooks view"
                    value={view}
                    onChange={setView}
                    options={[
                        { value: 'list', label: 'List' },
                        { value: 'json', label: 'JSON' },
                    ]}
                />
                {view === 'list' && (
                    <PrimaryButton onClick={() => openAdd()}>New hook</PrimaryButton>
                )}
            </div>
            <FormError>{actionError}</FormError>

            {view === 'json' ? (
                isLoading ? (
                    <ListBox>
                        <ListSkeleton />
                    </ListBox>
                ) : loadFailed ? (
                    <ListBox>
                        <EmptyRow>Could not load hooks</EmptyRow>
                    </ListBox>
                ) : (
                    <HooksJsonEditor />
                )
            ) : (
                <ListBox>
                    <ListHeader>
                        <span className="w-[150px]">When</span>
                        <span className="flex-1">Command</span>
                        <span className="w-[120px]">Tools</span>
                        <span className="w-[60px]">Timeout</span>
                        <span className="w-[104px]" />
                    </ListHeader>
                    {isLoading ? (
                        <ListSkeleton />
                    ) : loadFailed ? (
                        <EmptyRow>Could not load hooks</EmptyRow>
                    ) : hooks.length === 0 ? (
                        <EmptyRow
                            action={
                                <SecondaryButton onClick={() => openAdd()}>
                                    New hook
                                </SecondaryButton>
                            }
                        >
                            No hooks yet
                        </EmptyRow>
                    ) : filtered.length === 0 ? (
                        <EmptyRow>No results for "{query.trim()}"</EmptyRow>
                    ) : (
                        <ListRows>
                            {filtered.map((hook) => (
                                <ListRow key={hook.id} onClick={() => setEditing(hook)}>
                                    <span className="hidden md:block w-[150px] truncate text-[12.5px] text-[#7B7A79]">
                                        {HOOK_EVENT_LABELS[hook.event]}
                                    </span>
                                    <span className="flex-1 min-w-0 flex flex-col">
                                        <span
                                            className={cn(
                                                'font-mono text-[12.5px] truncate',
                                                hook.enabled ? 'text-[#D6D5C9]' : 'text-[#7B7A79]'
                                            )}
                                        >
                                            {hook.command}
                                        </span>
                                        <span className="md:hidden text-[12px] text-[#7B7A79] truncate">
                                            {HOOK_EVENT_LABELS[hook.event]}
                                            {hook.matcher ? ` · ${hook.matcher}` : ''}
                                        </span>
                                    </span>
                                    <span className="hidden md:block w-[120px] truncate font-mono text-[12px] text-[#7B7A79]">
                                        {hook.matcher ||
                                            (TOOL_HOOK_EVENTS.includes(hook.event) ? 'all' : '')}
                                    </span>
                                    <span className="hidden md:block w-[60px] text-[12.5px] text-[#7B7A79]">
                                        {hook.timeout}s
                                    </span>
                                    <span className="md:w-[104px] flex items-center justify-end gap-2 shrink-0">
                                        <RowActions
                                            noun="hook"
                                            onEdit={() => setEditing(hook)}
                                            onDelete={() => setDeleting(hook)}
                                        />
                                        <Switch
                                            checked={hook.enabled}
                                            label="Turn this hook on or off"
                                            onChange={(on) =>
                                                run(
                                                    setHookEnabled(hook.id, on),
                                                    'Could not update the hook'
                                                )
                                            }
                                        />
                                        <MoreMenu
                                            mobileOnly
                                            label="Hook options"
                                            items={[
                                                { label: 'Edit', onClick: () => setEditing(hook) },
                                                {
                                                    label: 'Delete hook',
                                                    danger: true,
                                                    onClick: () => setDeleting(hook),
                                                },
                                            ]}
                                        />
                                    </span>
                                </ListRow>
                            ))}
                        </ListRows>
                    )}
                </ListBox>
            )}

            {(addParam !== null || editing) && (
                <HookModal
                    existing={editing ?? undefined}
                    atLimit={!editing && hooks.length >= MAX_HOOKS}
                    onClose={() => {
                        setEditing(null)
                        closeAdd()
                    }}
                />
            )}
            <ConfirmModal
                isOpen={deleting !== null}
                title="Delete this hook?"
                body={
                    <span className="font-mono text-[12.5px] break-all">{deleting?.command}</span>
                }
                confirmLabel="Delete"
                onClose={() => setDeleting(null)}
                onConfirm={() => {
                    if (deleting) run(deleteHook(deleting.id), 'Could not delete the hook')
                    setDeleting(null)
                }}
            />
        </div>
    )
}

const HooksJsonEditor: React.FC = () => {
    const { hooks, replaceHooks } = useHooks()
    const initial = toHooksJson(hooks)
    const [text, setText] = React.useState(initial)
    const [saved, flashSaved] = useFlash()
    const [isSaving, setIsSaving] = React.useState(false)
    const [saveError, setSaveError] = React.useState<string | null>(null)
    const parsed = parseHooksJson(text, hooks)
    const isDirty = text !== initial

    const handleSave = async () => {
        if (!parsed.hooks || !isDirty || isSaving) return
        setSaveError(null)
        setIsSaving(true)
        try {
            const next = await replaceHooks(parsed.hooks)
            setText(toHooksJson(next))
            flashSaved()
        } catch (error) {
            setSaveError(apiErrorMessage(error, 'Could not save the hooks'))
        } finally {
            setIsSaving(false)
        }
    }

    return (
        <form
            className="flex flex-col gap-2"
            onSubmit={(e) => {
                e.preventDefault()
                void handleSave()
            }}
            onKeyDown={(e) => {
                if ((e.metaKey || e.ctrlKey) && e.key === 's') {
                    e.preventDefault()
                    void handleSave()
                }
            }}
        >
            <textarea
                aria-label="hooks.json"
                value={text}
                onChange={(e) => setText(e.target.value)}
                rows={18}
                spellCheck={false}
                className={textareaClass}
            />
            <div className="flex items-center gap-2.5">
                <FormError>{parsed.error ?? saveError}</FormError>
                <span className="flex-1" />
                {saved && <DoneHint>Saved</DoneHint>}
                <WhiteButton type="submit" disabled={!parsed.hooks || !isDirty || isSaving}>
                    {isSaving ? 'Saving' : 'Save'}
                </WhiteButton>
            </div>
        </form>
    )
}

const HookModal: React.FC<{ existing?: ApiHook; atLimit: boolean; onClose: () => void }> = ({
    existing,
    atLimit,
    onClose,
}) => {
    const { saveHook } = useHooks()
    const [event, setEvent] = React.useState<HookEvent>(existing?.event ?? 'PreToolUse')
    const [matcher, setMatcher] = React.useState(existing?.matcher ?? '')
    const [command, setCommand] = React.useState(existing?.command ?? '')
    const [timeout, setTimeoutValue] = React.useState(String(existing?.timeout ?? DEFAULT_TIMEOUT))
    const [touched, setTouched] = React.useState(false)
    const [isPending, setIsPending] = React.useState(false)
    const [saveError, setSaveError] = React.useState<string | null>(
        atLimit ? `You can save up to ${MAX_HOOKS} hooks` : null
    )

    const timeoutNumber = Number(timeout)
    const timeoutError =
        !Number.isInteger(timeoutNumber) || timeoutNumber < 1 || timeoutNumber > MAX_TIMEOUT
            ? `Use a whole number from 1 to ${MAX_TIMEOUT}`
            : null
    const isToolEvent = TOOL_HOOK_EVENTS.includes(event)
    const matcherError =
        isToolEvent && matcher.trim() && matcher.trim() !== '*' && !isRegex(matcher.trim())
            ? 'This is not a valid regex'
            : null
    const commandError = touched && !command.trim() ? 'Add a command' : null

    const handleSubmit = async () => {
        setTouched(true)
        if (!command.trim() || timeoutError || matcherError || atLimit || isPending) return
        setSaveError(null)
        setIsPending(true)
        try {
            await saveHook(
                {
                    event,
                    matcher: isToolEvent ? matcher.trim() : '',
                    command: command.trim(),
                    timeout: timeoutNumber,
                    enabled: existing?.enabled ?? true,
                },
                existing?.id
            )
            onClose()
        } catch (error) {
            setSaveError(apiErrorMessage(error, 'Could not save the hook'))
        } finally {
            setIsPending(false)
        }
    }

    return (
        <Modal
            isOpen
            onClose={onClose}
            title={existing ? 'Edit hook' : 'New hook'}
            description="The command runs in the sandbox of your cloud sessions."
            variant="premium"
            showLogo={false}
            sheetOnPhone
        >
            <form
                onSubmit={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    void handleSubmit()
                }}
                className="flex flex-col gap-4"
            >
                <div className="flex flex-col gap-1.5">
                    <span className={fieldLabelClass}>When</span>
                    <SettingsSelect
                        label="When"
                        value={event}
                        options={HOOK_EVENTS.map((value) => ({
                            value,
                            label: HOOK_EVENT_LABELS[value],
                        }))}
                        onChange={setEvent}
                        className="w-full"
                    />
                </div>
                {isToolEvent && (
                    <div className="flex flex-col gap-1.5">
                        <label htmlFor="hook-matcher" className={fieldLabelClass}>
                            Tools (empty means all)
                        </label>
                        <input
                            id="hook-matcher"
                            value={matcher}
                            maxLength={MAX_MATCHER}
                            placeholder="bash|edit_file"
                            onChange={(e) => setMatcher(e.target.value)}
                            className={cn(inputClass, 'font-mono')}
                        />
                        <FormError>{matcherError}</FormError>
                    </div>
                )}
                <div className="flex flex-col gap-1.5">
                    <label htmlFor="hook-command" className={fieldLabelClass}>
                        Command
                    </label>
                    <input
                        id="hook-command"
                        autoFocus
                        value={command}
                        maxLength={MAX_COMMAND}
                        placeholder="./scripts/check.sh"
                        onChange={(e) => setCommand(e.target.value)}
                        className={cn(inputClass, 'font-mono')}
                    />
                    <FormError>{commandError}</FormError>
                </div>
                <div className="flex flex-col gap-1.5">
                    <label htmlFor="hook-timeout" className={fieldLabelClass}>
                        Timeout (seconds)
                    </label>
                    <input
                        id="hook-timeout"
                        inputMode="numeric"
                        value={timeout}
                        onChange={(e) => setTimeoutValue(e.target.value.replace(/[^0-9]/g, ''))}
                        className={inputClass}
                    />
                    <FormError>{timeoutError}</FormError>
                </div>
                <FormError>{saveError}</FormError>
                <ModalActions
                    onCancel={onClose}
                    submitLabel={existing ? 'Save' : 'Add hook'}
                    submitDisabled={Boolean(timeoutError || matcherError) || atLimit}
                    isPending={isPending}
                />
            </form>
        </Modal>
    )
}
