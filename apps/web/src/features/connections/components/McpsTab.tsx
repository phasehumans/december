import { Eye, EyeOff, Plus, X } from 'lucide-react'
import React from 'react'

import { connectionErrorMessage, useMcps } from '../hooks/useConnectionsData'
import { useConnectionsNav } from '../hooks/useConnectionsNav'

import {
    BackLink,
    ChoiceGroup,
    ConfirmModal,
    DetailHeader,
    EmptyRow,
    FactsBox,
    FormError,
    ListBox,
    ListHeader,
    ListRow,
    ListRows,
    ListSkeleton,
    LogoTile,
    ModalActions,
    MoreMenu,
    Pill,
    PrimaryButton,
    SearchInput,
    SecondaryButton,
    SectionTitle,
    Switch,
    fieldLabelClass,
    inputClass,
    matchesQuery,
    type PillTone,
} from './ConnectionsUi'

import type { ConnectionsMcp, McpAuth, McpTransport } from '../types'

import { Modal } from '@/shared/components/ui/Modal'
import { cn } from '@/shared/lib/utils'

// the same rule as the server: an imported server can have capitals and underscores
const NAME_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]{0,39}$/
const URL_MAX = 500

const statusPill = (mcp: ConnectionsMcp): { tone: PillTone; label: string } => {
    if (!mcp.enabled) return { tone: 'muted', label: 'Off' }
    if (mcp.status === 'error') return { tone: 'err', label: 'Error' }
    // the status comes from a session: a server that no session used has none
    if (mcp.status === 'unknown') return { tone: 'muted', label: 'Not used yet' }
    return { tone: 'ok', label: 'Connected' }
}

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
    const { mcps, isLoading, loadFailed, retry, setMcpEnabled } = useMcps()
    const [query, setQuery] = React.useState('')
    const [actionError, setActionError] = React.useState<string | null>(null)

    const visible = mcps
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
            <FormError>{actionError}</FormError>
            <ListBox>
                <ListHeader>
                    <span className="w-7" />
                    <span className="flex-1">Name</span>
                    <span className="w-[130px]">Source</span>
                    <span className="w-[60px]">Tools</span>
                    <span className="w-[110px]">Status</span>
                    <span className="w-[72px]" />
                </ListHeader>
                {isLoading ? (
                    <ListSkeleton />
                ) : loadFailed ? (
                    <EmptyRow
                        action={
                            <SecondaryButton onClick={() => retry()}>Try again</SecondaryButton>
                        }
                    >
                        Could not load MCPs
                    </EmptyRow>
                ) : visible.length === 0 ? (
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
                            const pill = statusPill(mcp)
                            const off = !mcp.enabled
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
                                            You
                                        </span>
                                    </span>
                                    <span className="hidden md:block w-[130px] truncate text-[12.5px] text-[#7B7A79]">
                                        You
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
                                        <Switch
                                            checked={!off}
                                            label={`Turn ${mcp.name} on or off`}
                                            onChange={(on) => {
                                                setActionError(null)
                                                setMcpEnabled(mcp.name, on).catch((error) =>
                                                    setActionError(
                                                        connectionErrorMessage(
                                                            error,
                                                            'Could not update the MCP'
                                                        )
                                                    )
                                                )
                                            }}
                                        />
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
    const { mcps, isLoading, loadFailed, setMcpEnabled, setMcpToolEnabled, removeMcp } = useMcps()
    const [isEditing, setIsEditing] = React.useState(false)
    const [isRemoving, setIsRemoving] = React.useState(false)
    const [toolQuery, setToolQuery] = React.useState('')
    const [actionError, setActionError] = React.useState<string | null>(null)

    const mcp = mcps.find((m) => m.name === itemId)
    if (!mcp) {
        return (
            <div className="flex flex-col">
                <BackLink label="MCPs" onClick={() => toTab('mcps')} />
                <ListBox className="mt-4">
                    {isLoading ? (
                        <ListSkeleton />
                    ) : (
                        <EmptyRow>{loadFailed ? 'Could not load MCPs' : 'MCP not found'}</EmptyRow>
                    )}
                </ListBox>
            </div>
        )
    }

    /** runs a change. a change the server refuses shows under the heading */
    const run = async (change: () => Promise<void>, fallback: string) => {
        setActionError(null)
        try {
            await change()
        } catch (error) {
            setActionError(connectionErrorMessage(error, fallback))
        }
    }

    const pill = statusPill(mcp)
    const tools = mcp.tools.filter((t) => matchesQuery(toolQuery, t.name))

    const authLabel =
        mcp.auth === 'header' ? `Header: ${mcp.headers.map((h) => h.key).join(', ')}` : 'None'

    return (
        <div className="flex flex-col">
            <BackLink label="MCPs" onClick={() => toTab('mcps')} />
            <DetailHeader
                title={mcp.name}
                logo={<LogoTile brand={mcp.brand} name={mcp.name} large />}
            >
                <Pill tone={pill.tone}>{pill.label}</Pill>
                <Switch
                    checked={mcp.enabled}
                    label="Turn this MCP on or off"
                    onChange={(on) =>
                        run(() => setMcpEnabled(mcp.name, on), 'Could not update the MCP')
                    }
                />
                <span className="flex-1" />
                <SecondaryButton onClick={() => setIsEditing(true)}>Edit</SecondaryButton>
                <MoreMenu
                    label="MCP options"
                    items={[
                        {
                            label: 'Remove MCP',
                            danger: true,
                            onClick: () => setIsRemoving(true),
                        },
                    ]}
                />
            </DetailHeader>

            {mcp.status === 'error' && mcp.lastError && (
                <p className="-mt-2 mb-4 text-[12.5px] text-red-500 font-medium">
                    Last session: {mcp.lastError}
                </p>
            )}
            {actionError && (
                <div className="-mt-2 mb-4">
                    <FormError>{actionError}</FormError>
                </div>
            )}

            <div className="mb-8">
                <FactsBox
                    rows={[
                        {
                            label: 'Server URL',
                            value: <span className="font-mono text-[12.5px]">{mcp.url}</span>,
                        },
                        { label: 'Transport', value: mcp.transport.toUpperCase() },
                        { label: 'Auth', value: authLabel },
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
                        {mcp.status === 'unknown' ? 'No session has used this MCP yet' : 'No tools'}
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
                                    onChange={(on) =>
                                        run(
                                            () => setMcpToolEnabled(mcp.name, tool.name, on),
                                            'Could not update the tool'
                                        )
                                    }
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
                    setIsRemoving(false)
                    run(async () => {
                        await removeMcp(mcp.name)
                        toTab('mcps')
                    }, 'Could not remove the MCP')
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
    const { mcps, saveMcp } = useMcps()

    const [name, setName] = React.useState(existing?.name ?? '')
    const [url, setUrl] = React.useState(existing?.url ?? '')
    const [transport, setTransport] = React.useState<McpTransport>(existing?.transport ?? 'http')
    const [auth, setAuth] = React.useState<McpAuth>(existing?.auth ?? 'none')
    const [headers, setHeaders] = React.useState(
        existing?.headers.length ? existing.headers : [{ key: 'Authorization', value: '' }]
    )
    const [shownHeaders, setShownHeaders] = React.useState<Record<number, boolean>>({})
    const [touched, setTouched] = React.useState(false)
    const [isSaving, setIsSaving] = React.useState(false)
    const [saveError, setSaveError] = React.useState<string | null>(null)

    const nameError = !name
        ? touched
            ? 'Add a name'
            : null
        : !NAME_PATTERN.test(name)
          ? 'Use letters, numbers, dashes and underscores'
          : mcps.some((m) => m.name === name && m.name !== existing?.name)
            ? 'You already have an MCP with this name'
            : null
    const urlError = !url
        ? touched
            ? 'Add the server URL'
            : null
        : !/^https:\/\/\S+$/.test(url)
          ? 'Enter a full URL starting with https://'
          : url.length > URL_MAX
            ? `A URL is at most ${URL_MAX} characters`
            : null

    // the api never returns a header value. a header sent empty keeps its saved value,
    // so only a header that is not saved yet needs one
    const savedHeaderKeys = existing?.auth === 'header' ? existing.headers.map((h) => h.key) : []
    const namedHeaders = headers
        .map((h) => ({ key: h.key.trim(), value: h.value }))
        .filter((h) => h.key)
    const headersReady =
        auth !== 'header' ||
        (namedHeaders.length > 0 &&
            namedHeaders.every((h) => h.value || savedHeaderKeys.includes(h.key)))
    const headerError = touched && !headersReady ? 'Add the header name and value' : null
    const isValid = Boolean(name && url && !nameError && !urlError && headersReady)

    const handleSubmit = async () => {
        setTouched(true)
        if (!isValid || isSaving) return
        const draft: ConnectionsMcp = {
            name,
            url,
            transport,
            auth,
            headers: auth === 'header' ? namedHeaders : [],
            enabled: existing?.enabled ?? true,
            // a session sets the status and the tools. the server keeps what it has
            status: existing?.status ?? 'unknown',
            tools: existing?.tools ?? [],
        }
        setSaveError(null)
        setIsSaving(true)
        try {
            const saved = await saveMcp(draft, existing?.name)
            if (!existing) {
                // going to the new MCP's page drops ?add, which closes this modal
                toItem('mcps', saved.name)
                return
            }
            onClose()
            if (existing.name !== saved.name) toItem('mcps', saved.name, { replace: true })
        } catch (error) {
            setSaveError(connectionErrorMessage(error, 'Could not save the MCP'))
        } finally {
            setIsSaving(false)
        }
    }

    return (
        <Modal
            isOpen
            onClose={onClose}
            title={existing ? `Edit ${existing.name}` : 'Add MCP'}
            variant="premium"
            showLogo={false}
            maxWidth="max-w-[420px]"
            sheetOnPhone
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
                                        placeholder={
                                            savedHeaderKeys.includes(header.key.trim())
                                                ? 'Saved value'
                                                : 'Bearer ...'
                                        }
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
                        <FormError>{headerError}</FormError>
                    </div>
                )}

                <FormError>{saveError}</FormError>

                <ModalActions
                    onCancel={onClose}
                    isPending={isSaving}
                    submitLabel={existing ? 'Save' : 'Add MCP'}
                />
            </form>
        </Modal>
    )
}
