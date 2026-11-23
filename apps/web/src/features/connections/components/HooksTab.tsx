import { Check, ChevronDown } from 'lucide-react'
import React from 'react'

import { useConnectionsNav } from '../hooks/useConnectionsNav'
import { isPluginOff, useConnectionsStore } from '../hooks/useConnectionsStore'
import {
    HOOK_EVENT_LABELS,
    HOOK_EVENTS,
    TOOL_HOOK_EVENTS,
    type ConnectionsHook,
    type HookEvent,
} from '../types'

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

import { Modal } from '@/shared/components/ui/Modal'
import { cn } from '@/shared/lib/utils'

type HooksJson = {
    hooks: Partial<
        Record<
            HookEvent,
            {
                matcher?: string
                hooks: { type: 'command'; command: string; timeout?: number }[]
            }[]
        >
    >
}

/** same shape as ~/.december/hooks.json, so people can paste their CLI file */
const toJson = (hooks: ConnectionsHook[]): string => {
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

const parseJson = (
    text: string
): { hooks: ConnectionsHook[]; error: null } | { hooks: null; error: string } => {
    let data: unknown
    try {
        data = JSON.parse(text)
    } catch (err) {
        return { hooks: null, error: err instanceof Error ? err.message : 'Invalid JSON' }
    }
    const root = (data as HooksJson | null)?.hooks
    if (!root || typeof root !== 'object' || Array.isArray(root)) {
        return { hooks: null, error: 'Expected an object with a "hooks" key' }
    }
    const hooks: ConnectionsHook[] = []
    for (const [event, entries] of Object.entries(root)) {
        if (!(HOOK_EVENTS as readonly string[]).includes(event)) {
            return { hooks: null, error: `Unknown event "${event}"` }
        }
        if (!Array.isArray(entries)) {
            return { hooks: null, error: `"${event}" must be a list` }
        }
        for (const entry of entries) {
            for (const cmd of entry?.hooks ?? []) {
                if (!cmd?.command || typeof cmd.command !== 'string') {
                    return { hooks: null, error: `A "${event}" hook has no command` }
                }
                hooks.push({
                    id: `hook-${Date.now()}-${hooks.length}`,
                    event: event as HookEvent,
                    matcher: typeof entry.matcher === 'string' ? entry.matcher : '',
                    command: cmd.command,
                    timeout: typeof cmd.timeout === 'number' ? cmd.timeout : 60,
                    enabled: true,
                })
            }
        }
    }
    return { hooks, error: null }
}

export const HooksTab: React.FC = () => {
    const { addParam, openAdd, closeAdd } = useConnectionsNav()
    const hooks = useConnectionsStore((s) => s.hooks)
    const plugins = useConnectionsStore((s) => s.plugins)
    const setHookEnabled = useConnectionsStore((s) => s.setHookEnabled)
    const deleteHook = useConnectionsStore((s) => s.deleteHook)
    const [view, setView] = React.useState<'list' | 'json'>('list')
    const [query, setQuery] = React.useState('')
    const [editing, setEditing] = React.useState<ConnectionsHook | null>(null)
    const [deleting, setDeleting] = React.useState<ConnectionsHook | null>(null)

    const visible = hooks
        .filter((h) => !h.plugin || plugins.some((p) => p.name === h.plugin && p.installed))
        .sort((a, b) => HOOK_EVENTS.indexOf(a.event) - HOOK_EVENTS.indexOf(b.event))
    const filtered = visible.filter((h) =>
        matchesQuery(query, h.command, h.matcher, HOOK_EVENT_LABELS[h.event])
    )

    return (
        <div className="flex flex-col gap-4">
            <div className="flex items-center gap-2 flex-wrap">
                {view === 'list' && visible.length > 0 && (
                    <SearchInput value={query} onChange={setQuery} placeholder="Search hooks" />
                )}
                <span className="flex-1" />
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

            {view === 'json' ? (
                <HooksJsonEditor />
            ) : (
                <ListBox>
                    <ListHeader>
                        <span className="w-[150px]">When</span>
                        <span className="flex-1">Command</span>
                        <span className="w-[120px]">Tools</span>
                        <span className="w-[60px]">Timeout</span>
                        <span className="w-[104px]" />
                    </ListHeader>
                    {visible.length === 0 ? (
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
                            {filtered.map((hook) => {
                                const locked = isPluginOff(plugins, hook.plugin)
                                const isOwn = !hook.plugin
                                return (
                                    <ListRow
                                        key={hook.id}
                                        onClick={isOwn ? () => setEditing(hook) : undefined}
                                    >
                                        <span className="hidden md:block w-[150px] truncate text-[12.5px] text-[#7B7A79]">
                                            {HOOK_EVENT_LABELS[hook.event]}
                                        </span>
                                        <span className="flex-1 min-w-0 flex flex-col">
                                            <span className="font-mono text-[12.5px] text-[#D6D5C9] truncate">
                                                {hook.command}
                                            </span>
                                            <span className="md:hidden text-[12px] text-[#7B7A79] truncate">
                                                {HOOK_EVENT_LABELS[hook.event]}
                                                {hook.plugin ? ` · ${hook.plugin}` : ''}
                                            </span>
                                        </span>
                                        <span className="hidden md:block w-[120px] truncate font-mono text-[12px] text-[#7B7A79]">
                                            {hook.plugin ? (
                                                <span className="font-sans">{hook.plugin}</span>
                                            ) : (
                                                hook.matcher ||
                                                (TOOL_HOOK_EVENTS.includes(hook.event) ? 'all' : '')
                                            )}
                                        </span>
                                        <span className="hidden md:block w-[60px] text-[12.5px] text-[#7B7A79]">
                                            {hook.timeout}s
                                        </span>
                                        <span className="md:w-[104px] flex items-center justify-end gap-2">
                                            {isOwn && (
                                                <RowActions
                                                    noun="hook"
                                                    onEdit={() => setEditing(hook)}
                                                    onDelete={() => setDeleting(hook)}
                                                />
                                            )}
                                            <Switch
                                                checked={hook.enabled && !locked}
                                                disabled={locked}
                                                disabledReason="Plugin is off"
                                                label="Turn this hook on or off"
                                                onChange={(on) => setHookEnabled(hook.id, on)}
                                            />
                                            {isOwn && (
                                                <MoreMenu
                                                    mobileOnly
                                                    label="Hook options"
                                                    items={[
                                                        {
                                                            label: 'Edit',
                                                            onClick: () => setEditing(hook),
                                                        },
                                                        {
                                                            label: 'Delete hook',
                                                            danger: true,
                                                            onClick: () => setDeleting(hook),
                                                        },
                                                    ]}
                                                />
                                            )}
                                        </span>
                                    </ListRow>
                                )
                            })}
                        </ListRows>
                    )}
                </ListBox>
            )}

            {(addParam !== null || editing) && (
                <HookModal
                    existing={editing ?? undefined}
                    onClose={() => {
                        setEditing(null)
                        closeAdd()
                    }}
                />
            )}
            <ConfirmModal
                isOpen={deleting !== null}
                title="Delete this hook?"
                body={<span className="font-mono text-[12.5px]">{deleting?.command}</span>}
                confirmLabel="Delete"
                onClose={() => setDeleting(null)}
                onConfirm={() => {
                    if (deleting) deleteHook(deleting.id)
                    setDeleting(null)
                }}
            />
        </div>
    )
}

const HooksJsonEditor: React.FC = () => {
    const hooks = useConnectionsStore((s) => s.hooks)
    const replaceUserHooks = useConnectionsStore((s) => s.replaceUserHooks)
    const initial = toJson(hooks.filter((h) => !h.plugin))
    const [text, setText] = React.useState(initial)
    const [saved, flashSaved] = useFlash()
    const parsed = parseJson(text)
    const isDirty = text !== initial

    const handleSave = () => {
        if (!parsed.hooks || !isDirty) return
        replaceUserHooks(parsed.hooks)
        setText(toJson(parsed.hooks))
        flashSaved()
    }

    return (
        <form
            className="flex flex-col gap-2"
            onSubmit={(e) => {
                e.preventDefault()
                handleSave()
            }}
            onKeyDown={(e) => {
                if ((e.metaKey || e.ctrlKey) && e.key === 's') {
                    e.preventDefault()
                    handleSave()
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
                <FormError>{parsed.error}</FormError>
                <span className="flex-1" />
                {saved && <DoneHint>Saved</DoneHint>}
                <WhiteButton type="submit" disabled={!parsed.hooks || !isDirty}>
                    Save
                </WhiteButton>
            </div>
        </form>
    )
}

const EventSelect: React.FC<{ value: HookEvent; onChange: (value: HookEvent) => void }> = ({
    value,
    onChange,
}) => {
    const [open, setOpen] = React.useState(false)
    return (
        <div className="relative">
            <button
                type="button"
                id="hook-event"
                aria-haspopup="listbox"
                aria-expanded={open}
                onClick={() => setOpen((v) => !v)}
                className={cn(
                    inputClass,
                    'flex items-center justify-between text-left cursor-pointer'
                )}
            >
                {HOOK_EVENT_LABELS[value]}
                <ChevronDown className="w-4 h-4 text-[#7B7A79]" />
            </button>
            {open && (
                <>
                    <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
                    <div
                        role="listbox"
                        className="absolute left-0 right-0 top-full mt-1.5 z-50 bg-[#1C1C1C] border border-[#2B2A27] rounded-xl shadow-2xl p-1 flex flex-col gap-0.5 animate-in fade-in zoom-in-95 duration-100"
                    >
                        {HOOK_EVENTS.map((event) => (
                            <button
                                key={event}
                                type="button"
                                role="option"
                                aria-selected={event === value}
                                onClick={() => {
                                    onChange(event)
                                    setOpen(false)
                                }}
                                className="flex items-center justify-between w-full px-2.5 py-1.5 rounded-lg text-[12.5px] text-[#D6D5C9] hover:text-white hover:bg-[#282828] text-left cursor-pointer"
                            >
                                <span>{HOOK_EVENT_LABELS[event]}</span>
                                {event === value && <Check className="w-3.5 h-3.5 text-white" />}
                            </button>
                        ))}
                    </div>
                </>
            )}
        </div>
    )
}

const HookModal: React.FC<{ existing?: ConnectionsHook; onClose: () => void }> = ({
    existing,
    onClose,
}) => {
    const saveHook = useConnectionsStore((s) => s.saveHook)
    const [event, setEvent] = React.useState<HookEvent>(existing?.event ?? 'PreToolUse')
    const [matcher, setMatcher] = React.useState(existing?.matcher ?? '')
    const [command, setCommand] = React.useState(existing?.command ?? '')
    const [timeout, setTimeoutValue] = React.useState(String(existing?.timeout ?? 60))
    const [touched, setTouched] = React.useState(false)

    const timeoutNumber = Number(timeout)
    const timeoutError =
        !Number.isInteger(timeoutNumber) || timeoutNumber < 1 || timeoutNumber > 600
            ? 'Use a whole number from 1 to 600'
            : null
    const commandError = touched && !command.trim() ? 'Add a command' : null
    const isToolEvent = TOOL_HOOK_EVENTS.includes(event)

    const handleSubmit = () => {
        setTouched(true)
        if (!command.trim() || timeoutError) return
        saveHook({
            id: existing?.id ?? `hook-${Date.now()}`,
            event,
            matcher: isToolEvent ? matcher.trim() : '',
            command: command.trim(),
            timeout: timeoutNumber,
            enabled: existing?.enabled ?? true,
        })
        onClose()
    }

    return (
        <Modal
            isOpen
            onClose={onClose}
            title={existing ? 'Edit hook' : 'New hook'}
            variant="premium"
            showLogo={false}
        >
            <form
                onSubmit={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    handleSubmit()
                }}
                className="flex flex-col gap-4"
            >
                <div className="flex flex-col gap-1.5">
                    <label htmlFor="hook-event" className={fieldLabelClass}>
                        When
                    </label>
                    <EventSelect value={event} onChange={setEvent} />
                </div>
                {isToolEvent && (
                    <div className="flex flex-col gap-1.5">
                        <label htmlFor="hook-matcher" className={fieldLabelClass}>
                            Tools (empty means all)
                        </label>
                        <input
                            id="hook-matcher"
                            value={matcher}
                            placeholder="bash|edit_file"
                            onChange={(e) => setMatcher(e.target.value)}
                            className={cn(inputClass, 'font-mono')}
                        />
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
                <ModalActions
                    onCancel={onClose}
                    submitLabel={existing ? 'Save' : 'Add hook'}
                    submitDisabled={Boolean(timeoutError)}
                />
            </form>
        </Modal>
    )
}
