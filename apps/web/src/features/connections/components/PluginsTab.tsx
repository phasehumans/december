import { ChevronDown, ChevronRight, Upload } from 'lucide-react'
import React from 'react'

import { useConnectionsNav } from '../hooks/useConnectionsNav'
import { useConnectionsStore } from '../hooks/useConnectionsStore'

import {
    BackLink,
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
    RowActions,
    SearchInput,
    SecondaryButton,
    SectionTitle,
    Spinner,
    Switch,
    fieldLabelClass,
    inputClass,
    matchesQuery,
} from './ConnectionsUi'

import type { ConnectionsPlugin, ConnectionsTab, PluginItemType } from '../types'

import { Modal } from '@/shared/components/ui/Modal'
import { cn } from '@/shared/lib/utils'

const ITEM_LABEL: Record<PluginItemType, [string, string]> = {
    skill: ['skill', 'skills'],
    mcp: ['MCP', 'MCPs'],
    hook: ['hook', 'hooks'],
    rule: ['rule', 'rules'],
}

const ITEM_TAB: Record<PluginItemType, ConnectionsTab> = {
    skill: 'skills',
    mcp: 'mcps',
    hook: 'hooks',
    rule: 'rules',
}

const describeContents = (plugin: ConnectionsPlugin) => {
    const counts = new Map<PluginItemType, number>()
    for (const item of plugin.contents) counts.set(item.type, (counts.get(item.type) ?? 0) + 1)
    return [...counts.entries()]
        .map(([type, n]) => `${n} ${ITEM_LABEL[type][n === 1 ? 0 : 1]}`)
        .join(', ')
}

const REPO_PATTERN = /^(?:https:\/\/github\.com\/)?([\w.-]+\/[\w.-]+?)(?:\.git)?\/?$/

export const PluginsTab: React.FC<{ itemId?: string }> = ({ itemId }) => {
    const { addParam, closeAdd } = useConnectionsNav()
    return (
        <>
            {itemId ? <PluginPage itemId={itemId} /> : <PluginsList />}
            {!itemId && addParam === 'repo' && <AddFromRepoModal onClose={closeAdd} />}
            {!itemId && addParam === 'zip' && <UploadZipModal onClose={closeAdd} />}
        </>
    )
}

/** runs the one-time "plugins can run commands" notice before the first install */
const useInstall = () => {
    const hasSeenInstallNotice = useConnectionsStore((s) => s.hasSeenInstallNotice)
    const markInstallNoticeSeen = useConnectionsStore((s) => s.markInstallNoticeSeen)
    const setPluginInstalled = useConnectionsStore((s) => s.setPluginInstalled)
    const [installing, setInstalling] = React.useState<string | null>(null)
    const [justInstalled, setJustInstalled] = React.useState<string | null>(null)
    const [asking, setAsking] = React.useState<string | null>(null)
    const timers = React.useRef<ReturnType<typeof setTimeout>[]>([])

    React.useEffect(() => {
        const list = timers.current
        return () => list.forEach(clearTimeout)
    }, [])

    const runInstall = (name: string) => {
        setInstalling(name)
        // demo only: pretend the install takes a moment
        timers.current.push(
            setTimeout(() => {
                setPluginInstalled(name, true)
                setInstalling(null)
                setJustInstalled(name)
                timers.current.push(setTimeout(() => setJustInstalled(null), 2000))
            }, 900)
        )
    }

    const install = (name: string) => {
        if (!hasSeenInstallNotice) setAsking(name)
        else runInstall(name)
    }

    const notice = (
        <Modal
            isOpen={asking !== null}
            onClose={() => setAsking(null)}
            title={`Install ${asking ?? ''}?`}
            variant="premium"
            showLogo={false}
        >
            <form
                onSubmit={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    if (asking) runInstall(asking)
                    markInstallNoticeSeen()
                    setAsking(null)
                }}
                className="flex flex-col gap-4"
            >
                <p className="text-[13px] text-[#8F8E8D] leading-relaxed">
                    Plugins can run commands in your sessions.
                </p>
                <ModalActions onCancel={() => setAsking(null)} submitLabel="Install" />
            </form>
        </Modal>
    )

    return { install, installing, justInstalled, notice }
}

const PluginsList: React.FC = () => {
    const { toItem, openAdd } = useConnectionsNav()
    const plugins = useConnectionsStore((s) => s.plugins)
    const setPluginEnabled = useConnectionsStore((s) => s.setPluginEnabled)
    const setPluginInstalled = useConnectionsStore((s) => s.setPluginInstalled)
    const [query, setQuery] = React.useState('')
    const [menuOpen, setMenuOpen] = React.useState(false)
    const [uninstalling, setUninstalling] = React.useState<ConnectionsPlugin | null>(null)
    const { install, installing, justInstalled, notice } = useInstall()

    const installed = plugins.filter((p) => p.installed && matchesQuery(query, p.name))
    const marketplace = plugins.filter(
        (p) => (!p.installed || p.name === justInstalled) && matchesQuery(query, p.name)
    )

    return (
        <div className="flex flex-col gap-4">
            <div className="flex items-center gap-2">
                <SearchInput value={query} onChange={setQuery} placeholder="Search plugins" />
                <span className="hidden md:block flex-1" />
                <div className="relative">
                    <PrimaryButton
                        onClick={() => setMenuOpen((v) => !v)}
                        trailing={<ChevronDown className="w-3.5 h-3.5" />}
                    >
                        Add plugin
                    </PrimaryButton>
                    {menuOpen && (
                        <>
                            <div
                                className="fixed inset-0 z-40"
                                onClick={() => setMenuOpen(false)}
                            />
                            <div className="absolute right-0 top-full mt-1.5 z-50 w-44 bg-[#1C1C1C] border border-[#2B2A27] rounded-xl shadow-2xl p-1 flex flex-col gap-0.5 animate-in fade-in zoom-in-95 duration-100">
                                {(
                                    [
                                        ['repo', 'From GitHub repo'],
                                        ['zip', 'Upload .zip'],
                                    ] as const
                                ).map(([kind, label]) => (
                                    <button
                                        key={kind}
                                        type="button"
                                        onClick={() => {
                                            setMenuOpen(false)
                                            openAdd(kind)
                                        }}
                                        className="w-full px-2.5 py-1.5 rounded-lg text-[12px] text-[#D6D5C9] hover:text-white hover:bg-[#282828] text-left cursor-pointer"
                                    >
                                        {label}
                                    </button>
                                ))}
                            </div>
                        </>
                    )}
                </div>
            </div>

            {installed.length > 0 && (
                <div className="flex flex-col gap-2">
                    <SectionTitle>Installed</SectionTitle>
                    <ListBox>
                        <ListHeader>
                            <span className="w-7" />
                            <span className="flex-1">Name</span>
                            <span className="w-[160px]">Contains</span>
                            <span className="w-[70px]">Version</span>
                            <span className="w-[150px]" />
                        </ListHeader>
                        <ListRows>
                            {installed.map((plugin) => (
                                <ListRow
                                    key={plugin.name}
                                    onClick={() => toItem('plugins', plugin.name)}
                                >
                                    <span className={cn(!plugin.enabled && 'opacity-50')}>
                                        <LogoTile brand={plugin.brand} name={plugin.name} />
                                    </span>
                                    <span className="flex-1 min-w-0 flex flex-col">
                                        <span
                                            className={cn(
                                                'truncate',
                                                plugin.enabled ? 'text-[#D6D5C9]' : 'text-[#7B7A79]'
                                            )}
                                        >
                                            {plugin.name}
                                        </span>
                                        <span className="md:hidden text-[12px] text-[#7B7A79] truncate">
                                            {describeContents(plugin) || plugin.source}
                                        </span>
                                    </span>
                                    <span className="hidden md:block w-[160px] truncate text-[12.5px] text-[#7B7A79]">
                                        {describeContents(plugin)}
                                    </span>
                                    <span className="hidden md:block w-[70px] font-mono text-[12px] text-[#7B7A79]">
                                        {plugin.version}
                                    </span>
                                    <span className="md:w-[150px] flex items-center justify-end gap-2">
                                        {plugin.name === justInstalled && (
                                            <DoneHint>Installed</DoneHint>
                                        )}
                                        {plugin.updateTo && <Pill tone="warn">Update</Pill>}
                                        {!plugin.enabled && <Pill>Off</Pill>}
                                        <RowActions
                                            noun="plugin"
                                            onDelete={() => setUninstalling(plugin)}
                                        />
                                        <Switch
                                            checked={plugin.enabled}
                                            label={`Turn ${plugin.name} on or off`}
                                            onChange={(on) => setPluginEnabled(plugin.name, on)}
                                        />
                                    </span>
                                </ListRow>
                            ))}
                        </ListRows>
                    </ListBox>
                </div>
            )}

            <div className="flex flex-col gap-2">
                <SectionTitle>Marketplace</SectionTitle>
                {marketplace.length === 0 ? (
                    <ListBox>
                        <EmptyRow>
                            {query.trim()
                                ? `No results for "${query.trim()}"`
                                : 'Everything is installed'}
                        </EmptyRow>
                    </ListBox>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                        {marketplace.map((plugin) => (
                            <div
                                key={plugin.name}
                                className="bg-[#1F1F1F] border border-[#2A2A2A] rounded-xl p-3 flex items-center gap-2.5 min-w-0"
                            >
                                <LogoTile brand={plugin.brand} name={plugin.name} />
                                <span className="flex-1 min-w-0 truncate text-[13px] text-[#D6D5C9]">
                                    {plugin.name}
                                </span>
                                {plugin.name === justInstalled ? (
                                    <DoneHint>Installed</DoneHint>
                                ) : (
                                    <SecondaryButton
                                        small
                                        disabled={installing !== null}
                                        onClick={() => install(plugin.name)}
                                    >
                                        {installing === plugin.name ? (
                                            <>
                                                <Spinner />
                                                Installing
                                            </>
                                        ) : (
                                            'Install'
                                        )}
                                    </SecondaryButton>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {notice}
            <ConfirmModal
                isOpen={uninstalling !== null}
                title={`Uninstall ${uninstalling?.name ?? ''}?`}
                body={
                    uninstalling && uninstalling.contents.length > 0
                        ? `Its ${describeContents(uninstalling)} are removed too.`
                        : undefined
                }
                confirmLabel="Uninstall"
                onClose={() => setUninstalling(null)}
                onConfirm={() => {
                    if (uninstalling) setPluginInstalled(uninstalling.name, false)
                    setUninstalling(null)
                }}
            />
        </div>
    )
}

const PluginPage: React.FC<{ itemId: string }> = ({ itemId }) => {
    const { toTab, toItem } = useConnectionsNav()
    const plugins = useConnectionsStore((s) => s.plugins)
    const setPluginEnabled = useConnectionsStore((s) => s.setPluginEnabled)
    const setPluginInstalled = useConnectionsStore((s) => s.setPluginInstalled)
    const updatePlugin = useConnectionsStore((s) => s.updatePlugin)
    const [isUninstalling, setIsUninstalling] = React.useState(false)
    const { install, installing, notice } = useInstall()

    const plugin = plugins.find((p) => p.name === itemId)
    if (!plugin) {
        return (
            <div className="flex flex-col">
                <BackLink label="Plugins" onClick={() => toTab('plugins')} />
                <ListBox className="mt-4">
                    <EmptyRow>Plugin not found</EmptyRow>
                </ListBox>
            </div>
        )
    }

    const openItem = (type: PluginItemType, name: string) => {
        if (type === 'hook') toTab('hooks')
        else toItem(ITEM_TAB[type], name)
    }

    return (
        <div className="flex flex-col">
            <BackLink label="Plugins" onClick={() => toTab('plugins')} />
            <DetailHeader
                title={plugin.name}
                logo={<LogoTile brand={plugin.brand} name={plugin.name} large />}
            >
                {plugin.installed && (
                    <Switch
                        checked={plugin.enabled}
                        label="Turn this plugin on or off"
                        onChange={(on) => setPluginEnabled(plugin.name, on)}
                    />
                )}
                <span className="flex-1" />
                {plugin.installed ? (
                    <>
                        {plugin.updateTo && (
                            <SecondaryButton onClick={() => updatePlugin(plugin.name)}>
                                Update to {plugin.updateTo}
                            </SecondaryButton>
                        )}
                        <MoreMenu
                            label="Plugin options"
                            items={[
                                {
                                    label: 'Uninstall',
                                    danger: true,
                                    onClick: () => setIsUninstalling(true),
                                },
                            ]}
                        />
                    </>
                ) : (
                    <SecondaryButton
                        disabled={installing !== null}
                        onClick={() => install(plugin.name)}
                    >
                        {installing === plugin.name ? (
                            <>
                                <Spinner />
                                Installing
                            </>
                        ) : (
                            'Install'
                        )}
                    </SecondaryButton>
                )}
            </DetailHeader>

            <div className="mb-8">
                <FactsBox
                    rows={[
                        { label: 'Source', value: plugin.source },
                        {
                            label: 'Version',
                            value: (
                                <span className="font-mono text-[12.5px]">
                                    {plugin.version} · {plugin.commit}
                                </span>
                            ),
                        },
                    ]}
                />
            </div>

            {plugin.contents.length > 0 && (
                <ListBox>
                    <ListHeader>
                        <span className="flex-1">Contains</span>
                        <span className="w-[80px]">Type</span>
                        <span className="w-4" />
                    </ListHeader>
                    <ListRows>
                        {plugin.contents.map((item) => (
                            <ListRow
                                key={`${item.type}-${item.name}`}
                                onClick={
                                    plugin.installed
                                        ? () => openItem(item.type, item.name)
                                        : undefined
                                }
                            >
                                <span className="flex-1 min-w-0 truncate font-mono text-[12.5px] text-[#D6D5C9]">
                                    {item.name}
                                </span>
                                <span className="w-[80px] text-[12.5px] text-[#7B7A79] capitalize">
                                    {ITEM_LABEL[item.type][0]}
                                </span>
                                {plugin.installed && (
                                    <ChevronRight className="w-4 h-4 text-[#7B7A79]" />
                                )}
                            </ListRow>
                        ))}
                    </ListRows>
                </ListBox>
            )}

            {notice}
            <ConfirmModal
                isOpen={isUninstalling}
                title={`Uninstall ${plugin.name}?`}
                body={
                    plugin.contents.length > 0
                        ? `Its ${describeContents(plugin)} are removed too.`
                        : undefined
                }
                confirmLabel="Uninstall"
                onClose={() => setIsUninstalling(false)}
                onConfirm={() => {
                    setPluginInstalled(plugin.name, false)
                    setIsUninstalling(false)
                    toTab('plugins')
                }}
            />
        </div>
    )
}

const AddFromRepoModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
    const { toItem } = useConnectionsNav()
    const plugins = useConnectionsStore((s) => s.plugins)
    const addPluginFromRepo = useConnectionsStore((s) => s.addPluginFromRepo)
    const [repo, setRepo] = React.useState('')
    const [folder, setFolder] = React.useState('')
    const [error, setError] = React.useState<string | null>(null)
    const [isPending, setIsPending] = React.useState(false)

    const handleSubmit = () => {
        const match = REPO_PATTERN.exec(repo.trim())
        if (!match) {
            setError('Enter owner/repo or a GitHub URL')
            return
        }
        const fullName = match[1]
        const name = fullName.split('/')[1]
        if (plugins.some((p) => p.name === name && p.installed)) {
            setError('Already installed')
            return
        }
        setError(null)
        setIsPending(true)
        // demo only: pretend to fetch the repo
        setTimeout(() => {
            addPluginFromRepo(folder.trim() ? `${fullName}/${folder.trim()}` : fullName)
            setIsPending(false)
            toItem('plugins', folder.trim().split('/').pop() || name)
        }, 900)
    }

    return (
        <Modal
            isOpen
            onClose={onClose}
            title="Add plugin from GitHub"
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
                    <label htmlFor="plugin-repo" className={fieldLabelClass}>
                        Repository
                    </label>
                    <input
                        id="plugin-repo"
                        autoFocus
                        value={repo}
                        placeholder="owner/repo"
                        onChange={(e) => setRepo(e.target.value)}
                        className={cn(inputClass, 'font-mono')}
                    />
                </div>
                <div className="flex flex-col gap-1.5">
                    <label htmlFor="plugin-folder" className={fieldLabelClass}>
                        Folder (optional)
                    </label>
                    <input
                        id="plugin-folder"
                        value={folder}
                        placeholder="plugins/release"
                        onChange={(e) => setFolder(e.target.value)}
                        className={cn(inputClass, 'font-mono')}
                    />
                </div>
                <FormError>{error}</FormError>
                <ModalActions
                    onCancel={onClose}
                    submitLabel="Add plugin"
                    submitDisabled={!repo.trim()}
                    isPending={isPending}
                />
            </form>
        </Modal>
    )
}

const UploadZipModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
    const { toItem } = useConnectionsNav()
    const addPluginFromRepo = useConnectionsStore((s) => s.addPluginFromRepo)
    const [file, setFile] = React.useState<File | null>(null)
    const [error, setError] = React.useState<string | null>(null)
    const inputRef = React.useRef<HTMLInputElement>(null)

    const pick = (picked: File | undefined) => {
        if (!picked) return
        if (!picked.name.toLowerCase().endsWith('.zip')) {
            setError('Choose a .zip file')
            setFile(null)
            return
        }
        setError(null)
        setFile(picked)
    }

    return (
        <Modal isOpen onClose={onClose} title="Upload plugin" variant="premium" showLogo={false}>
            <form
                onSubmit={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    if (!file) return
                    const name = file.name.replace(/\.zip$/i, '')
                    addPluginFromRepo(name)
                    toItem('plugins', name)
                }}
                className="flex flex-col gap-4"
            >
                <button
                    type="button"
                    onClick={() => inputRef.current?.click()}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                        e.preventDefault()
                        pick(e.dataTransfer.files?.[0])
                    }}
                    className="border border-dashed border-[#383736] hover:border-[#4A4948] rounded-xl py-10 flex flex-col items-center justify-center gap-2 bg-[#100E12]/30 transition-colors cursor-pointer"
                >
                    <Upload className="w-5 h-5 text-[#7B7A79]" />
                    <span className="text-[13px] text-[#D6D5C9]">
                        {file ? file.name : 'Drop a .zip or click to choose'}
                    </span>
                </button>
                <input
                    ref={inputRef}
                    type="file"
                    accept=".zip"
                    className="hidden"
                    onChange={(e) => pick(e.target.files?.[0])}
                />
                <FormError>{error}</FormError>
                <ModalActions onCancel={onClose} submitLabel="Upload" submitDisabled={!file} />
            </form>
        </Modal>
    )
}
