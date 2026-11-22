import { useQuery } from '@tanstack/react-query'
import { ArrowUpRight, Eye, EyeOff, Plus, RefreshCw, Search, Trash2 } from 'lucide-react'
import React, { useMemo, useState } from 'react'

import type { ByokCredential, ByokProvider } from '../api/byok'

import { profileAPI } from '@/features/profile/api/profile'
import { useByokList, useByokMutations } from '@/features/profile/hooks/useByokData'
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
    const { data: profile } = useQuery({ queryKey: ['profile'], queryFn: profileAPI.getProfile })
    const { saveKey, refreshKey, removeKey, updateModelSource } = useByokMutations()

    const [isAddOpen, setIsAddOpen] = useState(false)
    const [providerQuery, setProviderQuery] = useState('')
    const [selectedProvider, setSelectedProvider] = useState<ByokProvider | null>(null)
    const [apiKey, setApiKey] = useState('')
    const [showKey, setShowKey] = useState(false)
    const [formError, setFormError] = useState<string | null>(null)
    const [rowError, setRowError] = useState<string | null>(null)

    const providers = useMemo(() => data?.providers ?? [], [data])
    const credentials = useMemo(() => data?.credentials ?? [], [data])
    const nameOf = (id: string) => providers.find((p) => p.id === id)?.name || id
    const defaultSource = profile?.defaultModelSource ?? 'CREDITS'

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
        <div className="flex flex-col w-full max-w-[800px] text-[#D6D5C9]">
            <h1 className="text-[16px] font-medium mb-3">Model keys</h1>
            <div className="flex flex-col border-t border-[#242323] pt-4 gap-4">
                <p className="text-[13px] text-[#7B7A79]">
                    Use your own API key to run December Cloud. Your provider bills you for the
                    tokens, and December does not use your credits. December encrypts each key and
                    never shows it again.
                </p>

                <div className="flex flex-col gap-2 bg-[#191919] border border-[#242323] rounded-xl p-4">
                    <span className="text-[13px] font-medium">Default model source</span>
                    <span className="text-[12.5px] text-[#7B7A79]">
                        The prompt box starts with this source. You can change the model for each
                        message.
                    </span>
                    <div
                        className="flex gap-2 mt-1"
                        role="radiogroup"
                        aria-label="Default model source"
                    >
                        {(
                            [
                                ['CREDITS', 'December credits'],
                                ['OWN_KEY', 'Your keys'],
                            ] as const
                        ).map(([value, label]) => (
                            <button
                                key={value}
                                type="button"
                                role="radio"
                                aria-checked={defaultSource === value}
                                disabled={
                                    updateModelSource.isPending ||
                                    (value === 'OWN_KEY' && credentials.length === 0)
                                }
                                onClick={() => updateModelSource.mutate(value)}
                                className={cn(
                                    'px-3 py-1.5 rounded-lg border text-[12.5px] font-medium transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-default',
                                    defaultSource === value
                                        ? 'border-[#87B2F4] bg-[#87B2F4]/10 text-white'
                                        : 'border-[#282828] bg-[#202020] text-[#D6D5C9] hover:bg-[#282828]'
                                )}
                            >
                                {label}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="flex items-center justify-between">
                    <span className="text-[13px] font-medium">Saved keys</span>
                    <button
                        type="button"
                        onClick={() => openAdd()}
                        className="px-4 py-1.5 rounded-lg bg-[#87B2F4] text-[#100E12] hover:bg-[#A3C7FF] text-[13px] font-medium transition-colors flex items-center gap-1.5 cursor-pointer"
                    >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Add key</span>
                    </button>
                </div>

                {(listError || rowError) && (
                    <p className="text-[12.5px] text-red-500 font-medium">
                        {rowError || errorText(listError, 'December could not load your keys.')}
                    </p>
                )}

                <div className="bg-[#191919] border border-[#242323] rounded-xl overflow-hidden">
                    {isLoading ? (
                        <div className="px-4 py-6 text-[13px] text-[#7B7A79]">Loading keys...</div>
                    ) : credentials.length === 0 ? (
                        <div className="px-4 py-6 text-[13px] text-[#7B7A79]">
                            No keys yet. Add a key to run December Cloud on your own provider
                            account.
                        </div>
                    ) : (
                        credentials.map((credential) => (
                            <div
                                key={credential.provider}
                                data-testid={`byok-row-${credential.provider}`}
                                className="flex items-center justify-between gap-3 px-4 py-3 border-b border-[#242323] last:border-b-0"
                            >
                                <div className="flex flex-col min-w-0">
                                    <span className="text-[13px] font-medium">
                                        {nameOf(credential.provider)}
                                    </span>
                                    <span className="text-[12px] text-[#7B7A79] truncate">
                                        {credential.keyHint ? `••••${credential.keyHint}` : '••••'}{' '}
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
                        ))
                    )}
                </div>
            </div>

            <Modal
                isOpen={isAddOpen}
                onClose={closeAdd}
                title={selectedProvider ? `Add ${selectedProvider.name} key` : 'Add key'}
                description="December checks the key with the provider before it saves it."
                variant="premium"
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
                            <label
                                htmlFor="byok-key-input"
                                className="text-[12px] font-medium text-[#8F8E8D]"
                            >
                                API key
                            </label>
                            <div className="relative">
                                <input
                                    id="byok-key-input"
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

                        <div className="flex items-center justify-between gap-2.5">
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
                            <button
                                type="submit"
                                disabled={!apiKey.trim() || saveKey.isPending}
                                className="bg-white text-black hover:bg-neutral-200 text-[13px] font-medium px-4 py-2 rounded-lg disabled:opacity-40 disabled:pointer-events-none min-w-[120px] cursor-pointer"
                            >
                                {saveKey.isPending ? 'Checking key...' : 'Check and save'}
                            </button>
                        </div>
                    </form>
                )}
            </Modal>
        </div>
    )
}
