import React from 'react'

import { useConnectionsNav } from '../hooks/useConnectionsNav'
import { usePlugins } from '../hooks/usePlugins'

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
    ListSkeleton,
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

import type { ApiMarketplacePlugin, ApiPlugin } from '../api/plugins'

import { Modal } from '@/shared/components/ui/Modal'
import { apiErrorMessage } from '@/shared/lib/apiErrorMessage'
import { cn } from '@/shared/lib/utils'

// plugins in the cli's format (plugin.json, skills/, mcp.json), from the built-in
// marketplace or a public github repository. cloud sessions get their files, skills and
// mcp servers in the sandbox

const RUNS_COMMANDS = 'Plugins can run commands in your sessions.'

const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`

/** "2 skills, 1 MCP" */
export const describeContents = (plugin: Pick<ApiPlugin, 'skills' | 'mcpServers'>) =>
    [
        plugin.skills.length > 0 ? plural(plugin.skills.length, 'skill', 'skills') : '',
        plugin.mcpServers.length > 0 ? plural(plugin.mcpServers.length, 'MCP', 'MCPs') : '',
    ]
        .filter(Boolean)
        .join(', ')

const formatSize = (bytes: number) =>
    bytes < 1024
        ? `${bytes} B`
        : bytes < 1024 * 1024
          ? `${Math.round(bytes / 1024)} KB`
          : `${(bytes / 1024 / 1024).toFixed(1)} MB`

export const PluginsTab: React.FC<{ itemId?: string }> = ({ itemId }) => {
    const { addParam, closeAdd } = useConnectionsNav()
    return (
        <>
            {itemId ? <PluginPage itemId={itemId} /> : <PluginsList />}
            {!itemId && addParam !== null && <AddPluginModal onClose={closeAdd} />}
        </>
    )
}

const PluginsList: React.FC = () => {
    const { toItem, openAdd } = useConnectionsNav()
    const {
        plugins,
        isLoading,
        loadFailed,
        marketplaces,
        marketplaceLoading,
        marketplaceFailed,
        install,
        setEnabled,
        uninstall,
        update,
    } = usePlugins({ withMarketplace: true })
    const [query, setQuery] = React.useState('')
    const [uninstalling, setUninstalling] = React.useState<ApiPlugin | null>(null)
    const [installing, setInstalling] = React.useState<ApiMarketplacePlugin | null>(null)
    const [busy, setBusy] = React.useState<string | null>(null)
    const [justInstalled, setJustInstalled] = React.useState<string | null>(null)
    const [actionError, setActionError] = React.useState<string | null>(null)

    /** runs a change from a row; a change the server refuses shows above the list */
    const run = async (name: string, change: () => Promise<unknown>, fallback: string) => {
        setActionError(null)
        setBusy(name)
        try {
            await change()
            return true
        } catch (error) {
            setActionError(apiErrorMessage(error, fallback))
            return false
        } finally {
            setBusy(null)
        }
    }

    const filtered = plugins.filter((plugin) =>
        matchesQuery(query, plugin.name, plugin.description, plugin.source)
    )
    const catalog = marketplaces.flatMap((market) => market.plugins)
    const available = catalog.filter(
        (entry) =>
            (!entry.installed || entry.name === justInstalled) &&
            !plugins.some((plugin) => plugin.name === entry.name && entry.name !== justInstalled) &&
            matchesQuery(query, entry.name, entry.description, entry.category)
    )

    return (
        <div className="flex flex-col gap-4">
            <div className="flex items-center gap-2">
                <SearchInput value={query} onChange={setQuery} placeholder="Search plugins" />
                <span className="hidden md:block flex-1" />
                <PrimaryButton onClick={() => openAdd('repo')}>Add plugin</PrimaryButton>
            </div>
            <FormError>{actionError}</FormError>

            <div className="flex flex-col gap-2">
                <SectionTitle>Installed</SectionTitle>
                <ListBox>
                    <ListHeader>
                        <span className="w-7" />
                        <span className="flex-1">Name</span>
                        <span className="w-[140px]">Contains</span>
                        <span className="w-[70px]">Version</span>
                        <span className="w-[150px]" />
                    </ListHeader>
                    {isLoading ? (
                        <ListSkeleton />
                    ) : loadFailed ? (
                        <EmptyRow>Could not load plugins</EmptyRow>
                    ) : plugins.length === 0 ? (
                        <EmptyRow
                            action={
                                <SecondaryButton onClick={() => openAdd('repo')}>
                                    Add plugin
                                </SecondaryButton>
                            }
                        >
                            No plugins yet
                        </EmptyRow>
                    ) : filtered.length === 0 ? (
                        <EmptyRow>No results for "{query.trim()}"</EmptyRow>
                    ) : (
                        <ListRows>
                            {filtered.map((plugin) => (
                                <ListRow
                                    key={plugin.name}
                                    onClick={() => toItem('plugins', plugin.name)}
                                >
                                    <span className={cn(!plugin.enabled && 'opacity-50')}>
                                        <LogoTile name={plugin.name} />
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
                                    <span className="hidden md:block w-[140px] truncate text-[12.5px] text-[#7B7A79]">
                                        {describeContents(plugin)}
                                    </span>
                                    <span className="hidden md:block w-[70px] truncate font-mono text-[12px] text-[#7B7A79]">
                                        {plugin.version ?? ''}
                                    </span>
                                    <span className="md:w-[150px] flex items-center justify-end gap-2 shrink-0">
                                        {plugin.name === justInstalled && (
                                            <DoneHint>Installed</DoneHint>
                                        )}
                                        {plugin.updateAvailable && <Pill tone="warn">Update</Pill>}
                                        <RowActions
                                            noun="plugin"
                                            onDelete={() => setUninstalling(plugin)}
                                        />
                                        <Switch
                                            checked={plugin.enabled}
                                            label={`Turn ${plugin.name} on or off`}
                                            onChange={(on) =>
                                                void run(
                                                    plugin.name,
                                                    () => setEnabled(plugin.name, on),
                                                    'Could not update the plugin'
                                                )
                                            }
                                        />
                                        <MoreMenu
                                            mobileOnly
                                            label={`${plugin.name} options`}
                                            items={[
                                                {
                                                    label: 'Update',
                                                    hidden: busy === plugin.name,
                                                    onClick: () =>
                                                        void run(
                                                            plugin.name,
                                                            () => update(plugin.name),
                                                            'Could not update the plugin'
                                                        ),
                                                },
                                                {
                                                    label: 'Uninstall',
                                                    danger: true,
                                                    onClick: () => setUninstalling(plugin),
                                                },
                                            ]}
                                        />
                                    </span>
                                </ListRow>
                            ))}
                        </ListRows>
                    )}
                </ListBox>
            </div>

            <div className="flex flex-col gap-2">
                <SectionTitle>Marketplace</SectionTitle>
                {marketplaceLoading ? (
                    <ListBox>
                        <ListSkeleton />
                    </ListBox>
                ) : marketplaceFailed ? (
                    <ListBox>
                        <EmptyRow>Could not load the marketplace</EmptyRow>
                    </ListBox>
                ) : available.length === 0 ? (
                    <ListBox>
                        <EmptyRow>
                            {query.trim()
                                ? `No results for "${query.trim()}"`
                                : 'Everything is installed'}
                        </EmptyRow>
                    </ListBox>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                        {available.map((entry) => (
                            <div
                                key={entry.name}
                                title={entry.description}
                                className="bg-[#1F1F1F] border border-[#2A2A2A] rounded-xl p-3 flex items-center gap-2.5 min-w-0"
                            >
                                <LogoTile name={entry.name} />
                                <span className="flex-1 min-w-0 truncate text-[13px] text-[#D6D5C9]">
                                    {entry.name}
                                </span>
                                {entry.name === justInstalled ? (
                                    <DoneHint>Installed</DoneHint>
                                ) : (
                                    <SecondaryButton
                                        small
                                        disabled={busy !== null}
                                        onClick={() => setInstalling(entry)}
                                    >
                                        {busy === entry.name ? (
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

            <Modal
                isOpen={installing !== null}
                onClose={() => setInstalling(null)}
                title={`Install ${installing?.name ?? ''}?`}
                description={RUNS_COMMANDS}
                variant="premium"
                showLogo={false}
                sheetOnPhone
            >
                <form
                    onSubmit={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        const entry = installing
                        setInstalling(null)
                        if (!entry) return
                        void run(
                            entry.name,
                            () => install(entry.name),
                            'Could not install the plugin'
                        ).then((ok) => {
                            if (ok) setJustInstalled(entry.name)
                        })
                    }}
                    className="flex flex-col gap-4"
                >
                    <ModalActions onCancel={() => setInstalling(null)} submitLabel="Install" />
                </form>
            </Modal>
            <ConfirmModal
                isOpen={uninstalling !== null}
                title={`Uninstall ${uninstalling?.name ?? ''}?`}
                body={
                    uninstalling && describeContents(uninstalling)
                        ? `Its ${describeContents(uninstalling)} are removed too.`
                        : undefined
                }
                confirmLabel="Uninstall"
                onClose={() => setUninstalling(null)}
                onConfirm={() => {
                    const plugin = uninstalling
                    setUninstalling(null)
                    if (plugin) {
                        void run(
                            plugin.name,
                            () => uninstall(plugin.name),
                            'Could not uninstall the plugin'
                        )
                    }
                }}
            />
        </div>
    )
}

const PluginPage: React.FC<{ itemId: string }> = ({ itemId }) => {
    const { toTab } = useConnectionsNav()
    const { plugins, isLoading, loadFailed, setEnabled, update, uninstall } = usePlugins()
    const [isUninstalling, setIsUninstalling] = React.useState(false)
    const [busy, setBusy] = React.useState<'update' | 'uninstall' | 'switch' | null>(null)
    const [notice, setNotice] = React.useState<string | null>(null)
    const [error, setError] = React.useState<string | null>(null)

    const back = <BackLink label="Plugins" onClick={() => toTab('plugins')} />
    const plugin = plugins.find((row) => row.name === itemId)
    if (isLoading || loadFailed || !plugin) {
        return (
            <div className="flex flex-col">
                {back}
                <ListBox className="mt-4">
                    {isLoading ? (
                        <ListSkeleton />
                    ) : (
                        <EmptyRow>
                            {loadFailed ? 'Could not load plugins' : 'Plugin not found'}
                        </EmptyRow>
                    )}
                </ListBox>
            </div>
        )
    }

    const act = async (
        kind: 'update' | 'uninstall' | 'switch',
        change: () => Promise<void>,
        fallback: string
    ) => {
        setError(null)
        setNotice(null)
        setBusy(kind)
        try {
            await change()
        } catch (failure) {
            setError(apiErrorMessage(failure, fallback))
        } finally {
            setBusy(null)
        }
    }

    const facts = [
        {
            label: 'Source',
            value: <span className="font-mono text-[12.5px]">{plugin.source}</span>,
        },
        {
            label: 'Version',
            value: (
                <span className="font-mono text-[12.5px]">
                    {[plugin.version, plugin.commitSha?.slice(0, 7)].filter(Boolean).join(' · ') ||
                        '-'}
                </span>
            ),
        },
        {
            label: 'Files',
            value: `${plural(plugin.fileCount, 'file', 'files')} · ${formatSize(plugin.sizeBytes)}`,
        },
        ...(plugin.env.length > 0
            ? [
                  {
                      label: 'Needs secrets',
                      value: (
                          <span className="font-mono text-[12.5px]">{plugin.env.join(', ')}</span>
                      ),
                  },
              ]
            : []),
    ]
    const contents = [
        ...plugin.skills.map((skill) => ({
            key: `skill-${skill.name}`,
            name: skill.name,
            type: 'Skill',
        })),
        ...plugin.mcpServers.map((server) => ({
            key: `mcp-${server.name}`,
            name: server.name,
            type: server.transport === 'stdio' ? 'MCP (command)' : 'MCP (url)',
        })),
    ]

    return (
        <div className="flex flex-col">
            {back}
            <DetailHeader title={plugin.name} logo={<LogoTile name={plugin.name} large />}>
                <Switch
                    checked={plugin.enabled}
                    disabled={busy === 'switch'}
                    label="Turn this plugin on or off"
                    onChange={(on) =>
                        void act(
                            'switch',
                            () => setEnabled(plugin.name, on),
                            'Could not update the plugin'
                        )
                    }
                />
                <span className="flex-1" />
                <SecondaryButton
                    disabled={busy !== null}
                    onClick={() =>
                        void act(
                            'update',
                            async () => {
                                const { changed } = await update(plugin.name)
                                setNotice(changed ? 'Updated' : 'Up to date')
                            },
                            'Could not update the plugin'
                        )
                    }
                >
                    {busy === 'update' ? (
                        <>
                            <Spinner />
                            Updating
                        </>
                    ) : plugin.updateAvailable ? (
                        'Update available'
                    ) : (
                        'Update'
                    )}
                </SecondaryButton>
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
            </DetailHeader>
            {plugin.description && (
                <p className="-mt-3 mb-4 text-[13px] text-[#9A9998]">{plugin.description}</p>
            )}
            <div className="flex items-center gap-2 mb-3 min-h-0 empty:hidden">
                {notice && <DoneHint>{notice}</DoneHint>}
                <FormError>{error}</FormError>
            </div>

            <div className="mb-6">
                <FactsBox rows={facts} />
            </div>

            <ListBox>
                <ListHeader>
                    <span className="flex-1">Contains</span>
                    <span className="w-[120px]">Type</span>
                </ListHeader>
                {contents.length === 0 ? (
                    <EmptyRow>No skills or MCP servers</EmptyRow>
                ) : (
                    <ListRows>
                        {contents.map((item) => (
                            <ListRow key={item.key}>
                                <span className="flex-1 min-w-0 truncate font-mono text-[12.5px] text-[#D6D5C9]">
                                    {item.name}
                                </span>
                                <span className="w-[120px] shrink-0 text-right md:text-left text-[12.5px] text-[#7B7A79]">
                                    {item.type}
                                </span>
                            </ListRow>
                        ))}
                    </ListRows>
                )}
            </ListBox>

            <ConfirmModal
                isOpen={isUninstalling}
                title={`Uninstall ${plugin.name}?`}
                body={
                    describeContents(plugin)
                        ? `Its ${describeContents(plugin)} are removed too.`
                        : undefined
                }
                confirmLabel="Uninstall"
                onClose={() => setIsUninstalling(false)}
                onConfirm={() => {
                    setIsUninstalling(false)
                    void act(
                        'uninstall',
                        async () => {
                            await uninstall(plugin.name)
                            toTab('plugins')
                        },
                        'Could not uninstall the plugin'
                    )
                }}
            />
        </div>
    )
}

/** owner/repo, a github.com link or a marketplace name, like `december plugin install` */
const AddPluginModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
    const { toItem } = useConnectionsNav()
    const { install } = usePlugins()
    const [source, setSource] = React.useState('')
    const [error, setError] = React.useState<string | null>(null)
    const [isPending, setIsPending] = React.useState(false)

    const handleSubmit = async () => {
        const value = source.trim()
        if (!value || isPending) return
        setError(null)
        setIsPending(true)
        try {
            const plugin = await install(value)
            onClose()
            toItem('plugins', plugin.name)
        } catch (failure) {
            setError(apiErrorMessage(failure, 'Could not install the plugin'))
        } finally {
            setIsPending(false)
        }
    }

    return (
        <Modal
            isOpen
            onClose={onClose}
            title="Add plugin"
            description={RUNS_COMMANDS}
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
                    <label htmlFor="plugin-source" className={fieldLabelClass}>
                        GitHub repository or plugin name
                    </label>
                    <input
                        id="plugin-source"
                        autoFocus
                        value={source}
                        maxLength={300}
                        placeholder="owner/repo"
                        autoCapitalize="off"
                        autoCorrect="off"
                        spellCheck={false}
                        onChange={(e) => setSource(e.target.value)}
                        className={cn(inputClass, 'font-mono')}
                    />
                </div>
                <FormError>{error}</FormError>
                <ModalActions
                    onCancel={onClose}
                    submitLabel="Install"
                    submitDisabled={!source.trim()}
                    isPending={isPending}
                />
            </form>
        </Modal>
    )
}
