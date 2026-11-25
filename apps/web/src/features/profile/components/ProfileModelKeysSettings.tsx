import { ArrowUpRight, Eye, EyeOff, Plus, RefreshCw, Search, Trash2 } from 'lucide-react'
import React, { useMemo, useState } from 'react'

import { PAGE_SUBTITLES, blueButtonClass, listEmptyClass } from './settingsStyles'
import { SettingsPage, SettingsSection } from './SettingsUi'

import type { ByokCredential, ByokProvider } from '../api/byok'

import { ListBox, ListRows, ModalActions } from '@/features/connections/components/ConnectionsUi'
import { useByokList, useByokMutations } from '@/features/profile/hooks/useByokData'
import { useSettingsTopBarAction } from '@/features/profile/lib/settingsTopBar'
import { ErrorAlert } from '@/shared/components/ui/ErrorAlert'
import { Modal } from '@/shared/components/ui/Modal'
import { cn } from '@/shared/lib/utils'

const errorText = (error: unknown, fallback: string) =>
    error instanceof Error && error.message ? error.message : fallback

const formatDate = (value: string | null) =>
    value
        ? new Date(value).toLocaleDateString(undefined, {
              year: 'numeric',
              month: 'short',
              day: 'numeric',
          })
        : 'Never'

export const ProfileModelKeysSettings: React.FC = () => {
    const { data, isLoading, error: listError } = useByokList(true)
    const { saveKey, refreshKey, removeKey } = useByokMutations()

    const [isAddOpen, setIsAddOpen] = useState(false)
    const [providerQuery, setProviderQuery] = useState('')
    const [selectedProvider, setSelectedProvider] = useState<ByokProvider | null>(null)
    const [apiKey, setApiKey] = useState('')
    const [showKey, setShowKey] = useState(false)
    const [formError, setFormError] = useState<string | null>(null)
    const [rowError, setRowError] = useState<string | null>(null)

    // phones: the + in the top bar opens the Add key dialog (P3)
    useSettingsTopBarAction('Add key', () => setIsAddOpen(true))

    const providers = useMemo(() => data?.providers ?? [], [data])
    const credentials = useMemo(() => data?.credentials ?? [], [data])
    const nameOf = (id: string) => providers.find((p) => p.id === id)?.name || id

    const filteredProviders = useMemo(() => {
        const q = providerQuery.trim().toLowerCase()
        return q
            ? providers.filter(
                  (p) => p.name.toLowerCase().includes(q) || p.id.toLowerCase().includes(q)
              )
            : providers
    }, [providers, providerQuery])

    const closeAdd = () => {
        setIsAddOpen(false)
        setSelectedProvider(null)
        setProviderQuery('')
        setApiKey('')
        setShowKey(false)
        setFormError(null)
    }

    const openAdd = (provider?: ByokProvider) => {
        setSelectedProvider(provider ?? null)
        setIsAddOpen(true)
    }

    const handleSave = async (event: React.FormEvent) => {
        event.preventDefault()
        if (!selectedProvider || !apiKey.trim()) return
        setFormError(null)
        try {
            await saveKey.mutateAsync({ provider: selectedProvider.id, apiKey: apiKey.trim() })
            closeAdd()
        } catch (err) {
            setFormError(errorText(err, 'December could not save this key. Try again.'))
        }
    }

    const handleRefresh = async (credential: ByokCredential) => {
        setRowError(null)
        try {
            await refreshKey.mutateAsync(credential.provider)
        } catch (err) {
            setRowError(errorText(err, 'December could not check this key. Try again.'))
        }
    }

    const handleRemove = async (credential: ByokCredential) => {
        setRowError(null)
        try {
            await removeKey.mutateAsync(credential.provider)
        } catch (err) {
            setRowError(errorText(err, 'December could not remove this key. Try again.'))
        }
    }

    return (
        <>
            <SettingsPage title="API keys" subtitle={PAGE_SUBTITLES.yourKeys}>
                {/* the model source row lives on the Defaults page (N2-B) */}
                <SettingsSection
                    title="Saved keys"
                    description="Keys December can run on."
                    bare
                    action={
                        <button
                            type="button"
                            onClick={() => openAdd()}
                            className={cn(blueButtonClass, 'hidden md:flex items-center gap-1.5')}
                        >
                            <Plus className="w-3.5 h-3.5" />
                            <span>Add key</span>
                        </button>
                    }
                >
                    <ErrorAlert
                        message={
                            rowError ||
                            (listError
                                ? errorText(listError, 'December could not load your keys.')
                                : null)
                        }
                    />

                    <ListBox>
                        {isLoading ? (
                            <div className={listEmptyClass}>Loading keys...</div>
                        ) : credentials.length === 0 ? (
                            <div className={listEmptyClass}>No keys yet</div>
                        ) : (
                            <ListRows>
                                {credentials.map((credential) => (
                                    <div
                                        key={credential.provider}
                                        data-testid={`byok-row-${credential.provider}`}
                                        className="flex items-center justify-between gap-3 px-3.5 md:px-4 py-3"
                                    >
                                        <div className="flex flex-col min-w-0">
                                            <span className="text-[13px] font-medium">
                                                {nameOf(credential.provider)}
                                            </span>
                                            <span className="text-[12px] text-[#7B7A79] truncate">
                                                {credential.keyHint
                                                    ? `••••${credential.keyHint}`
                                                    : '••••'}{' '}
                                                · {credential.models.length} models · checked{' '}
                                                {formatDate(credential.verifiedAt)} · last used{' '}
                                                {formatDate(credential.lastUsedAt)}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-1 shrink-0">
                                            <button
                                                type="button"
                                                onClick={() => handleRefresh(credential)}
                                                disabled={refreshKey.isPending}
                                                aria-label={`Check ${nameOf(credential.provider)} key again`}
                                                title="Check the key again and update its models"
                                                className="p-1.5 rounded-lg text-[#7B7A79] hover:text-[#D6D5C9] hover:bg-white/5 disabled:opacity-40 cursor-pointer"
                                            >
                                                <RefreshCw className="w-3.5 h-3.5" />
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => handleRemove(credential)}
                                                disabled={removeKey.isPending}
                                                aria-label={`Remove ${nameOf(credential.provider)} key`}
                                                title="Remove key"
                                                className="p-1.5 rounded-lg text-[#7B7A79] hover:text-red-400 hover:bg-white/5 disabled:opacity-40 cursor-pointer"
                                            >
                                                <Trash2 className="w-3.5 h-3.5" />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </ListRows>
                        )}
                    </ListBox>
                </SettingsSection>
            </SettingsPage>

            <Modal
                isOpen={isAddOpen}
                onClose={closeAdd}
                title={selectedProvider ? `Add ${selectedProvider.name} key` : 'Add key'}
                description="December checks the key with the provider before it saves it."
                variant="premium"
                showLogo={false}
                sheetOnPhone
            >
                {!selectedProvider ? (
                    <div className="flex flex-col gap-3">
                        <div className="relative">
                            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#7B7A79]" />
                            <input
                                type="text"
                                autoFocus
                                placeholder="Search providers"
                                aria-label="Search providers"
                                value={providerQuery}
                                onChange={(e) => setProviderQuery(e.target.value)}
                                className="w-full pl-9 pr-3 py-2 bg-white/[0.03] border border-[#2B2A27] rounded-lg text-[13px] text-white placeholder:text-[#4A4948] focus:outline-none"
                            />
                        </div>
                        <div className="max-h-[320px] overflow-y-auto flex flex-col">
                            {filteredProviders.map((provider) => {
                                const saved = credentials.some((c) => c.provider === provider.id)
                                return (
                                    <button
                                        key={provider.id}
                                        type="button"
                                        onClick={() => setSelectedProvider(provider)}
                                        className="flex items-center justify-between px-3 py-2 rounded-lg text-left text-[13px] text-[#EDEDEF] hover:bg-white/5 cursor-pointer"
                                    >
                                        <span>{provider.name}</span>
                                        {saved && (
                                            <span className="text-[11px] text-[#7B7A79]">
                                                saved, replace
                                            </span>
                                        )}
                                    </button>
                                )
                            })}
                            {filteredProviders.length === 0 && (
                                <span className="px-3 py-2 text-[13px] text-[#7B7A79]">
                                    No provider matches.
                                </span>
                            )}
                        </div>
                    </div>
                ) : (
                    <form onSubmit={handleSave} className="flex flex-col gap-4">
                        <div className="flex flex-col gap-1.5">
                            <div className="relative">
                                <input
                                    id="byok-key-input"
                                    aria-label="API key"
                                    type={showKey ? 'text' : 'password'}
                                    autoFocus
                                    autoComplete="off"
                                    spellCheck={false}
                                    placeholder={
                                        selectedProvider.keyHint
                                            ? selectedProvider.keyHint
                                            : 'Paste your key'
                                    }
                                    value={apiKey}
                                    onChange={(e) => setApiKey(e.target.value)}
                                    className="w-full bg-white/[0.03] border border-[#2B2A27] rounded-lg pl-3.5 pr-10 py-2.5 text-white text-[13px] font-mono focus:outline-none placeholder:text-[#4A4948]"
                                    required
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowKey(!showKey)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#7B7A79] hover:text-[#D6D5C9] cursor-pointer"
                                    aria-label={showKey ? 'Hide key' : 'Show key'}
                                >
                                    {showKey ? (
                                        <EyeOff className="w-4 h-4" />
                                    ) : (
                                        <Eye className="w-4 h-4" />
                                    )}
                                </button>
                            </div>
                            {selectedProvider.keyHint && (
                                <span className="text-[12px] text-[#7B7A79]">
                                    {selectedProvider.keyHint}
                                </span>
                            )}
                            <a
                                href={selectedProvider.keyUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-[12px] text-[#87B2F4] hover:underline inline-flex items-center gap-1 w-fit"
                            >
                                Get a {selectedProvider.name} key
                                <ArrowUpRight className="w-3 h-3" />
                            </a>
                        </div>

                        {formError && (
                            <p role="alert" className="text-[12.5px] text-red-500 font-medium">
                                {formError}
                            </p>
                        )}

                        <ModalActions
                            onCancel={closeAdd}
                            submitLabel="Add key"
                            submitDisabled={!apiKey.trim()}
                            isPending={saveKey.isPending}
                            leading={
                                <button
                                    type="button"
                                    onClick={() => {
                                        setSelectedProvider(null)
                                        setApiKey('')
                                        setFormError(null)
                                    }}
                                    disabled={saveKey.isPending}
                                    className="text-[13px] text-[#8F8E8D] hover:text-white cursor-pointer disabled:opacity-50"
                                >
                                    Change provider
                                </button>
                            }
                        />
                    </form>
                )}
            </Modal>
        </>
    )
}
