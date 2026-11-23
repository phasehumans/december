import { Eye, EyeOff, Plus, X } from 'lucide-react'
import React from 'react'

import { useConnectionsNav } from '../hooks/useConnectionsNav'
import { isPluginOff, useConnectionsStore } from '../hooks/useConnectionsStore'

import {
    BackLink,
    ChoiceGroup,
    ConfirmModal,
    DetailHeader,
    DoneHint,
    EmptyRow,
    FactsBox,
    FormError,
    ListBox,
    ListHeader,
    ListRow,
    ListRows,
    LogoTile,
    ModalActions,
    MoreMenu,
    Pill,
    PrimaryButton,
    SearchInput,
    SecondaryButton,
    SectionTitle,
    Spinner,
    Switch,
    fieldLabelClass,
    inputClass,
    matchesQuery,
    type PillTone,
} from './ConnectionsUi'

import type { ConnectionsMcp, McpAuth, McpTransport } from '../types'

import { Modal } from '@/shared/components/ui/Modal'
import { cn } from '@/shared/lib/utils'

const NAME_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/

const statusPill = (mcp: ConnectionsMcp, locked: boolean): { tone: PillTone; label: string } => {
    if (!mcp.enabled || locked) return { tone: 'muted', label: 'Off' }
    if (mcp.status === 'needs-signin') return { tone: 'warn', label: 'Needs sign-in' }
    if (mcp.status === 'error') return { tone: 'err', label: 'Error' }
    return { tone: 'ok', label: 'Connected' }
}

type TestResult = { ok: true; tools: number } | { ok: false; message: string } | null

/** demo only: there is no backend, so "Test" checks the form and pretends to connect */
const fakeTest = (url: string, auth: McpAuth, headers: { key: string; value: string }[]) =>
    new Promise<TestResult>((resolve) => {
        setTimeout(() => {
            if (!/^https:\/\//.test(url)) {
                resolve({ ok: false, message: 'Could not reach the server' })
            } else if (auth === 'header' && !headers.some((h) => h.key.trim() && h.value.trim())) {
                resolve({ ok: false, message: '401 Unauthorized. Check the header.' })
            } else {
                resolve({ ok: true, tools: 8 })
            }
        }, 900)
    })

const demoTools = (name: string) =>
    ['list', 'get', 'search', 'create', 'update', 'delete', 'run', 'describe'].map((verb) => ({
        name: `${verb}_${name.replace(/-/g, '_')}`,
        enabled: verb !== 'delete',
    }))

export const McpsTab: React.FC<{ itemId?: string }> = ({ itemId }) => {
    const { addParam, closeAdd } = useConnectionsNav()
    return (
        <>
            {itemId ? <McpPage itemId={itemId} /> : <McpsList />}
            <McpFormModal isOpen={addParam !== null && !itemId} onClose={closeAdd} />
        </>
    )
}

const McpsList: React.FC = () => {
    const { toItem, openAdd } = useConnectionsNav()
    const mcps = useConnectionsStore((s) => s.mcps)
    const plugins = useConnectionsStore((s) => s.plugins)
    const setMcpEnabled = useConnectionsStore((s) => s.setMcpEnabled)
    const setMcpStatus = useConnectionsStore((s) => s.setMcpStatus)
    const [query, setQuery] = React.useState('')

    const visible = mcps.filter(
        (mcp) => !mcp.plugin || plugins.some((p) => p.name === mcp.plugin && p.installed)
    )
    const filtered = visible.filter((mcp) => matchesQuery(query, mcp.name, mcp.url))

    return (
        <div className="flex flex-col gap-4">
            {visible.length > 0 && (
                <div className="flex items-center gap-2">
                    <SearchInput value={query} onChange={setQuery} placeholder="Search MCPs" />
                    <span className="hidden md:block flex-1" />
                    <PrimaryButton onClick={() => openAdd()}>Add MCP</PrimaryButton>
                </div>
            )}
            <ListBox>
                <ListHeader>
                    <span className="w-7" />
                    <span className="flex-1">Name</span>
                    <span className="w-[130px]">Source</span>
                    <span className="w-[60px]">Tools</span>
                    <span className="w-[110px]">Status</span>
                    <span className="w-[72px]" />
                </ListHeader>
                {visible.length === 0 ? (
                    <EmptyRow
                        action={
                            <SecondaryButton onClick={() => openAdd()}>Add MCP</SecondaryButton>
                        }
                    >
                        No MCPs yet
                    </EmptyRow>
                ) : filtered.length === 0 ? (
                    <EmptyRow>No results for "{query.trim()}"</EmptyRow>
                ) : (
                    <ListRows>
                        {filtered.map((mcp) => {
                            const locked = isPluginOff(plugins, mcp.plugin)
                            const pill = statusPill(mcp, locked)
                            const off = !mcp.enabled || locked
                            return (
                                <ListRow key={mcp.name} onClick={() => toItem('mcps', mcp.name)}>
                                    <span className={cn(off && 'opacity-50')}>
                                        <LogoTile brand={mcp.brand} name={mcp.name} />
                                    </span>
                                    <span className="flex-1 min-w-0 flex flex-col">
                                        <span
                                            className={cn(
                                                'truncate',
                                                off ? 'text-[#7B7A79]' : 'text-[#D6D5C9]'
                                            )}
                                        >
                                            {mcp.name}
                                        </span>
                                        <span className="md:hidden text-[12px] text-[#7B7A79] truncate">
                                            {mcp.plugin ? `${mcp.plugin} plugin` : 'You'}
                                        </span>
                                    </span>
                                    <span className="hidden md:block w-[130px] truncate text-[12.5px] text-[#7B7A79]">
                                        {mcp.plugin ? `${mcp.plugin} plugin` : 'You'}
                                    </span>
                                    <span className="hidden md:block w-[60px] text-[12.5px] text-[#7B7A79]">
                                        {mcp.tools.length || ''}
                                    </span>
                                    <span className="hidden md:block w-[110px]">
                                        <Pill tone={pill.tone}>{pill.label}</Pill>
                                    </span>
                                    <span className="md:w-[72px] flex items-center justify-end gap-2">
                                        <span className="md:hidden">
                                            {pill.tone !== 'ok' && pill.tone !== 'muted' && (
                                                <Pill tone={pill.tone}>{pill.label}</Pill>
                                            )}
                                        </span>
                                        {mcp.status === 'needs-signin' && !off ? (
                                            <SecondaryButton
                                                small
                                                onClick={() =>
                                                    setMcpStatus(mcp.name, {
                                                        status: 'connected',
                                                        account: 'phasehumans',
                                                        tools: mcp.tools.length
                                                            ? mcp.tools
                                                            : demoTools(mcp.name),
                                                    })
                                                }
                                            >
                                                Sign in
                                            </SecondaryButton>
                                        ) : (
                                            <Switch
                                                checked={!off}
                                                disabled={locked}
                                                disabledReason="Plugin is off"
                                                label={`Turn ${mcp.name} on or off`}
                                                onChange={(on) => setMcpEnabled(mcp.name, on)}
                                            />
                                        )}
                                    </span>
                                </ListRow>
                            )
                        })}
                    </ListRows>
                )}
            </ListBox>
        </div>
    )
}

const McpPage: React.FC<{ itemId: string }> = ({ itemId }) => {
    const { toTab, toItem } = useConnectionsNav()
    const mcps = useConnectionsStore((s) => s.mcps)
    const plugins = useConnectionsStore((s) => s.plugins)
    const setMcpEnabled = useConnectionsStore((s) => s.setMcpEnabled)
    const setMcpToolEnabled = useConnectionsStore((s) => s.setMcpToolEnabled)
    const setMcpStatus = useConnectionsStore((s) => s.setMcpStatus)
    const removeMcp = useConnectionsStore((s) => s.removeMcp)
    const [isEditing, setIsEditing] = React.useState(false)
    const [isRemoving, setIsRemoving] = React.useState(false)
    const [isTesting, setIsTesting] = React.useState(false)
    const [toolQuery, setToolQuery] = React.useState('')

    const mcp = mcps.find((m) => m.name === itemId)
    if (!mcp) {
        return (
            <div className="flex flex-col">
                <BackLink label="MCPs" onClick={() => toTab('mcps')} />
                <ListBox className="mt-4">
                    <EmptyRow>MCP not found</EmptyRow>
                </ListBox>
            </div>
        )
    }

    const locked = isPluginOff(plugins, mcp.plugin)
    const pill = statusPill(mcp, locked)
    const fromPlugin = Boolean(mcp.plugin)
    const tools = mcp.tools.filter((t) => matchesQuery(toolQuery, t.name))

    const runTest = async () => {
        setIsTesting(true)
        const result = await fakeTest(mcp.url, mcp.auth, mcp.headers)
        setIsTesting(false)
        if (!result) return
        if (result.ok) {
            setMcpStatus(mcp.name, {
                status: 'connected',
                lastError: undefined,
                tools: mcp.tools.length ? mcp.tools : demoTools(mcp.name),
            })
        } else if ('message' in result) {
            setMcpStatus(mcp.name, { status: 'error', lastError: result.message })
        }
    }

    const authLabel =
        mcp.auth === 'oauth'
            ? mcp.status === 'needs-signin'
                ? 'OAuth, not signed in'
                : `OAuth, signed in as ${mcp.account ?? 'you'}`
            : mcp.auth === 'header'
              ? `Header: ${mcp.headers.map((h) => h.key).join(', ')}`
              : 'None'

    return (
        <div className="flex flex-col">
            <BackLink label="MCPs" onClick={() => toTab('mcps')} />
            <DetailHeader
                title={mcp.name}
                logo={<LogoTile brand={mcp.brand} name={mcp.name} large />}
            >
                <Pill tone={pill.tone}>{pill.label}</Pill>
                <Switch
                    checked={mcp.enabled && !locked}
                    disabled={locked}
                    disabledReason="Plugin is off"
                    label="Turn this MCP on or off"
                    onChange={(on) => setMcpEnabled(mcp.name, on)}
                />
                <span className="flex-1" />
                {fromPlugin ? (
                    <SecondaryButton onClick={() => toItem('plugins', mcp.plugin ?? '')}>
                        Open plugin
                    </SecondaryButton>
                ) : (
                    <>
                        {mcp.status === 'needs-signin' ? (
                            <SecondaryButton
                                onClick={() =>
                                    setMcpStatus(mcp.name, {
                                        status: 'connected',
                                        account: 'phasehumans',
                                        tools: mcp.tools.length ? mcp.tools : demoTools(mcp.name),
                                    })
                                }
                            >
                                Sign in
                            </SecondaryButton>
                        ) : (
                            <SecondaryButton onClick={runTest} disabled={isTesting}>
                                {isTesting ? (
                                    <>
                                        <Spinner />
                                        Testing
                                    </>
                                ) : (
                                    'Test'
                                )}
                            </SecondaryButton>
                        )}
                        <SecondaryButton onClick={() => setIsEditing(true)}>Edit</SecondaryButton>
                        <MoreMenu
                            label="MCP options"
                            items={[
                                {
                                    label: 'Sign out',
                                    hidden: mcp.auth !== 'oauth' || mcp.status === 'needs-signin',
                                    onClick: () =>
                                        setMcpStatus(mcp.name, {
                                            status: 'needs-signin',
                                            account: undefined,
                                        }),
                                },
                                {
                                    label: 'Remove MCP',
                                    danger: true,
                                    onClick: () => setIsRemoving(true),
                                },
                            ]}
                        />
                    </>
                )}
            </DetailHeader>

            {mcp.status === 'error' && mcp.lastError && (
                <p className="-mt-2 mb-4 text-[12.5px] text-red-500 font-medium">
                    Last test: {mcp.lastError}
                </p>
            )}

            <div className="mb-8">
                <FactsBox
                    rows={[
                        {
                            label: 'Server URL',
                            value: <span className="font-mono text-[12.5px]">{mcp.url}</span>,
                        },
                        { label: 'Transport', value: mcp.transport.toUpperCase() },
                        { label: 'Auth', value: fromPlugin ? 'Set by plugin' : authLabel },
                    ]}
                />
            </div>

            <div className="flex items-center gap-2 mb-3">
                <SectionTitle>Tools</SectionTitle>
                <span className="flex-1" />
                {mcp.tools.length > 0 && (
                    <SearchInput
                        value={toolQuery}
                        onChange={setToolQuery}
                        placeholder="Search tools"
                    />
                )}
            </div>
            <ListBox>
                {mcp.tools.length === 0 ? (
                    <EmptyRow>
                        {mcp.status === 'needs-signin'
                            ? 'Sign in to see tools'
                            : 'Run Test to see tools'}
                    </EmptyRow>
                ) : tools.length === 0 ? (
                    <EmptyRow>No results for "{toolQuery.trim()}"</EmptyRow>
                ) : (
                    <ListRows>
                        {tools.map((tool) => (
                            <ListRow key={tool.name}>
                                <span
                                    className={cn(
                                        'flex-1 min-w-0 truncate font-mono text-[12.5px]',
                                        tool.enabled ? 'text-[#D6D5C9]' : 'text-[#7B7A79]'
                                    )}
                                >
                                    {tool.name}
                                </span>
                                <Switch
                                    checked={tool.enabled}
                                    label={`Allow ${tool.name}`}
                                    onChange={(on) => setMcpToolEnabled(mcp.name, tool.name, on)}
                                />
                            </ListRow>
                        ))}
                    </ListRows>
                )}
            </ListBox>

            <McpFormModal isOpen={isEditing} existing={mcp} onClose={() => setIsEditing(false)} />
            <ConfirmModal
                isOpen={isRemoving}
                title={`Remove ${mcp.name}?`}
                confirmLabel="Remove"
                onClose={() => setIsRemoving(false)}
                onConfirm={() => {
                    removeMcp(mcp.name)
                    setIsRemoving(false)
                    toTab('mcps')
                }}
            />
        </div>
    )
}

const McpFormModal: React.FC<{
    isOpen: boolean
    existing?: ConnectionsMcp
    onClose: () => void
}> = ({ isOpen, existing, onClose }) => {
    if (!isOpen) return null
    return <McpForm existing={existing} onClose={onClose} />
}

const McpForm: React.FC<{ existing?: ConnectionsMcp; onClose: () => void }> = ({
    existing,
    onClose,
}) => {
    const { toItem } = useConnectionsNav()
    const mcps = useConnectionsStore((s) => s.mcps)
    const saveMcp = useConnectionsStore((s) => s.saveMcp)

    const [name, setName] = React.useState(existing?.name ?? '')
    const [url, setUrl] = React.useState(existing?.url ?? '')
    const [transport, setTransport] = React.useState<McpTransport>(existing?.transport ?? 'http')
    const [auth, setAuth] = React.useState<McpAuth>(existing?.auth ?? 'none')
    const [headers, setHeaders] = React.useState(
        existing?.headers.length ? existing.headers : [{ key: 'Authorization', value: '' }]
    )
    const [shownHeaders, setShownHeaders] = React.useState<Record<number, boolean>>({})
    const [touched, setTouched] = React.useState(false)
    const [isTesting, setIsTesting] = React.useState(false)
    const [testResult, setTestResult] = React.useState<TestResult>(null)

    const nameError = !name
        ? touched
            ? 'Add a name'
            : null
        : !NAME_PATTERN.test(name)
          ? 'Use lowercase letters, numbers and hyphens'
          : mcps.some((m) => m.name === name && m.name !== existing?.name)
            ? 'You already have an MCP with this name'
            : null
    const urlError = !url
        ? touched
            ? 'Add the server URL'
            : null
        : !/^https:\/\/\S+$/.test(url)
          ? 'Enter a full URL starting with https://'
          : null
    const isValid = Boolean(name && url && !nameError && !urlError)

    const runTest = async () => {
        setTouched(true)
        if (!isValid) return
        setIsTesting(true)
        setTestResult(null)
        const result = await fakeTest(url, auth, headers)
        setIsTesting(false)
        setTestResult(result)
    }

    const handleSubmit = () => {
        setTouched(true)
        if (!isValid) return
        const cleanHeaders = auth === 'header' ? headers.filter((h) => h.key.trim()) : []
        const failed = testResult && 'message' in testResult ? testResult.message : undefined
        saveMcp(
            {
                name,
                url,
                transport,
                auth,
                headers: cleanHeaders,
                status: auth === 'oauth' ? 'needs-signin' : failed ? 'error' : 'connected',
                lastError: failed,
                enabled: existing?.enabled ?? true,
                tools:
                    existing?.tools.length && existing.url === url
                        ? existing.tools
                        : auth === 'oauth'
                          ? []
                          : demoTools(name),
                account: undefined,
                brand: existing?.brand,
            },
            existing?.name
        )
        if (!existing) {
            // going to the new MCP's page drops ?add, which closes this modal
            toItem('mcps', name)
            return
        }
        onClose()
        if (existing.name !== name) toItem('mcps', name, { replace: true })
    }

    return (
        <Modal
            isOpen
            onClose={onClose}
            title={existing ? `Edit ${existing.name}` : 'Add MCP'}
            variant="premium"
            showLogo={false}
            maxWidth="max-w-[420px]"
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
                    <label htmlFor="mcp-name" className={fieldLabelClass}>
                        Name
                    </label>
                    <input
                        id="mcp-name"
                        autoFocus
                        value={name}
                        placeholder="e.g. neon"
                        onChange={(e) => setName(e.target.value)}
                        className={inputClass}
                    />
                    <FormError>{nameError}</FormError>
                </div>
                <div className="flex flex-col gap-1.5">
                    <label htmlFor="mcp-url" className={fieldLabelClass}>
                        Server URL
                    </label>
                    <input
                        id="mcp-url"
                        value={url}
                        placeholder="https://mcp.example.com/mcp"
                        onChange={(e) => setUrl(e.target.value.trim())}
                        className={cn(inputClass, 'font-mono')}
                    />
                    <FormError>{urlError}</FormError>
                </div>
                <div className="flex flex-col gap-1.5">
                    <span className={fieldLabelClass}>Transport</span>
                    <ChoiceGroup
                        label="Transport"
                        value={transport}
                        onChange={setTransport}
                        options={[
                            { value: 'http', label: 'HTTP' },
                            { value: 'sse', label: 'SSE' },
                        ]}
                    />
                </div>
                <div className="flex flex-col gap-1.5">
                    <span className={fieldLabelClass}>Auth</span>
                    <ChoiceGroup
                        label="Auth"
                        value={auth}
                        onChange={setAuth}
                        options={[
                            { value: 'none', label: 'None' },
                            { value: 'header', label: 'Header' },
                            { value: 'oauth', label: 'OAuth' },
                        ]}
                    />
                </div>
                {auth === 'header' && (
                    <div className="flex flex-col gap-2">
                        {headers.map((header, index) => (
                            <div key={index} className="flex items-center gap-2">
                                <input
                                    aria-label="Header name"
                                    value={header.key}
                                    placeholder="Authorization"
                                    onChange={(e) =>
                                        setHeaders((list) =>
                                            list.map((h, i) =>
                                                i === index ? { ...h, key: e.target.value } : h
                                            )
                                        )
                                    }
                                    className={cn(inputClass, 'font-mono flex-1 min-w-0')}
                                />
                                <div className="relative flex-1 min-w-0">
                                    <input
                                        aria-label="Header value"
                                        type={shownHeaders[index] ? 'text' : 'password'}
                                        value={header.value}
                                        placeholder="Bearer ..."
                                        onChange={(e) =>
                                            setHeaders((list) =>
                                                list.map((h, i) =>
                                                    i === index
                                                        ? { ...h, value: e.target.value }
                                                        : h
                                                )
                                            )
                                        }
                                        className={cn(inputClass, 'font-mono pr-10')}
                                    />
                                    <button
                                        type="button"
                                        aria-label={
                                            shownHeaders[index] ? 'Hide value' : 'Show value'
                                        }
                                        onClick={() =>
                                            setShownHeaders((s) => ({ ...s, [index]: !s[index] }))
                                        }
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-[#7B7A79] hover:text-[#D6D5C9] transition-colors cursor-pointer"
                                    >
                                        {shownHeaders[index] ? (
                                            <EyeOff className="w-4 h-4" />
                                        ) : (
                                            <Eye className="w-4 h-4" />
                                        )}
                                    </button>
                                </div>
                                {headers.length > 1 && (
                                    <button
                                        type="button"
                                        aria-label="Remove header"
                                        onClick={() =>
                                            setHeaders((list) => list.filter((_, i) => i !== index))
                                        }
                                        className="p-1 rounded text-[#7B7A79] hover:text-red-400 transition-colors cursor-pointer"
                                    >
                                        <X className="w-4 h-4" />
                                    </button>
                                )}
                            </div>
                        ))}
                        <button
                            type="button"
                            onClick={() => setHeaders((list) => [...list, { key: '', value: '' }])}
                            className="self-start flex items-center gap-1 text-[12px] text-[#87B2F4] hover:underline cursor-pointer"
                        >
                            <Plus className="w-3 h-3" />
                            Add header
                        </button>
                    </div>
                )}

                {testResult &&
                    (testResult.ok ? (
                        <DoneHint>Connected, {testResult.tools} tools</DoneHint>
                    ) : (
                        <FormError>{testResult.message}</FormError>
                    ))}

                <ModalActions
                    onCancel={onClose}
                    submitLabel={
                        existing ? 'Save' : auth === 'oauth' ? 'Add and sign in' : 'Add MCP'
                    }
                    leading={
                        auth !== 'oauth' && (
                            <SecondaryButton onClick={runTest} disabled={isTesting}>
                                {isTesting ? (
                                    <>
                                        <Spinner />
                                        Testing
                                    </>
                                ) : (
                                    'Test'
                                )}
                            </SecondaryButton>
                        )
                    }
                />
            </form>
        </Modal>
    )
}
