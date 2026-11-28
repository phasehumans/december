import { ArrowUpRight, Eye, EyeOff, Loader2, Plus, RefreshCw, Search, Trash2 } from 'lucide-react'
import React, { useMemo, useState } from 'react'

import {
    PAGE_SUBTITLES,
    blueButtonClass,
    listEmptyClass,
    listRowClass,
    listRowNoteClass,
    listRowTitleClass,
} from './settingsStyles'
import { SettingsEmptyArt, SettingsPage, SettingsSection } from './SettingsUi'

import type { ByokCredential, ByokProvider } from '../api/byok'

import {
    FormError,
    ListBox,
    ListRows,
    ListSkeleton,
    ModalActions,
    inputClass,
} from '@/features/connections/components/ConnectionsUi'
import { useByokList, useByokMutations } from '@/features/profile/hooks/useByokData'
import { useSettingsTopBarAction } from '@/features/profile/lib/settingsTopBar'
import { listActionButtonClass } from '@/features/sessions/components/ListParts'
import { ErrorAlert } from '@/shared/components/ui/ErrorAlert'
import { Modal } from '@/shared/components/ui/Modal'
import { cn } from '@/shared/lib/utils'

const errorText = (error: unknown, fallback: string) =>
    error instanceof Error && error.message ? error.message : fallback

const formatDate = (value: string) =>
    new Date(value).toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
    })

// one line under the provider name: hint, model count, when it was checked and last used
const credentialNote = (credential: ByokCredential) => {
    const parts = [
        credential.keyHint ? `••••${credential.keyHint}` : '••••',
        `${credential.models.length} ${credential.models.length === 1 ? 'model' : 'models'}`,
        `checked ${formatDate(credential.verifiedAt)}`,
    ]
    if (credential.lastUsedAt) parts.push(`last used ${formatDate(credential.lastUsedAt)}`)
    return parts.join(' · ')
}

// icon buttons of a row: a larger tap area on phones, the usual size on desktop
const rowIconButtonClass =
    'p-2 md:p-1.5 rounded-lg text-[#7B7A79] hover:bg-white/5 disabled:opacity-40 disabled:cursor-default cursor-pointer transition-colors'

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
    const [removing, setRemoving] = useState<ByokCredential | null>(null)
    const [removeError, setRemoveError] = useState<string | null>(null)

    const providers = useMemo(() => data?.providers ?? [], [data])
    const credentials = useMemo(() => data?.credentials ?? [], [data])
    const nameOf = (id: string) => providers.find((p) => p.id === id)?.name || id
    const isSaved = (id: string) => credentials.some((c) => c.provider === id)

    const filteredProviders = useMemo(() => {
        const q = providerQuery.trim().toLowerCase()
        return q
            ? providers.filter(
                  (p) => p.name.toLowerCase().includes(q) || p.id.toLowerCase().includes(q)
              )
            : providers
    }, [providers, providerQuery])

    const openAdd = () => {
        setSelectedProvider(null)
        setIsAddOpen(true)
    }

    // phones: the + in the top bar opens the Add key dialog
    useSettingsTopBarAction('Add key', openAdd)

    const closeAdd = () => {
        setIsAddOpen(false)
        setSelectedProvider(null)
        setProviderQuery('')
        setApiKey('')
        setShowKey(false)
        setFormError(null)
    }

    const pickProvider = (provider: ByokProvider | null) => {
        setSelectedProvider(provider)
        setApiKey('')
        setShowKey(false)
        setFormError(null)
    }

    const handleSave = async (event: React.FormEvent) => {
        event.preventDefault()
        // the modal is portaled, so stop the submit reaching a form behind it
        event.stopPropagation()
        const key = apiKey.trim()
        // Enter while a save runs must not send the key twice
        if (!selectedProvider || !key || saveKey.isPending) return
        setFormError(null)
        try {
            await saveKey.mutateAsync({ provider: selectedProvider.id, apiKey: key })
            closeAdd()
        } catch (err) {
            setFormError(errorText(err, 'December could not save this key. Try again.'))
        }
    }

    const handleRefresh = async (credential: ByokCredential) => {
        if (refreshKey.isPending) return
        setRowError(null)
        try {
            await refreshKey.mutateAsync(credential.provider)
        } catch (err) {
            setRowError(errorText(err, 'December could not check this key. Try again.'))
        }
    }

    const openRemove = (credential: ByokCredential) => {
        setRemoveError(null)
        setRemoving(credential)
    }

    const closeRemove = () => {
        if (removeKey.isPending) return
        setRemoving(null)
        setRemoveError(null)
    }

    const handleRemove = async (event: React.FormEvent) => {
        event.preventDefault()
        event.stopPropagation()
        if (!removing || removeKey.isPending) return
        setRemoveError(null)
        try {
            await removeKey.mutateAsync(removing.provider)
            setRemoving(null)
        } catch (err) {
            setRemoveError(errorText(err, 'December could not remove this key. Try again.'))
        }
    }

    const checkingProvider = refreshKey.isPending ? refreshKey.variables : null
    const replacing = selectedProvider ? isSaved(selectedProvider.id) : false

    return (
        <>
            <SettingsPage title="API keys" subtitle={PAGE_SUBTITLES.yourKeys}>
                <SettingsSection
                    title="Saved keys"
                    description="Keys December can run on."
                    bare
                    action={
                        <button
                            type="button"
                            onClick={openAdd}
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
                            (listError && data
                                ? errorText(listError, 'December could not load your keys.')
                                : null)
                        }
                        onClear={() => setRowError(null)}
                    />

                    <ListBox>
                        {isLoading ? (
                            <div aria-label="Loading keys">
                                <ListSkeleton />
                            </div>
                        ) : listError && !data ? (
                            <div role="alert" className={listEmptyClass}>
                                {errorText(listError, 'December could not load your keys.')}
                            </div>
                        ) : credentials.length === 0 ? (
                            <SettingsEmptyArt art="keys" title="No keys yet">
                                <button
                                    type="button"
                                    onClick={openAdd}
                                    className={`bg-[#191919] ${listActionButtonClass}`}
                                >
                                    Add key
                                </button>
                            </SettingsEmptyArt>
                        ) : (
                            <ListRows>
                                {credentials.map((credential) => {
                                    const name = nameOf(credential.provider)
                                    const isChecking = checkingProvider === credential.provider
                                    return (
                                        <div
                                            key={credential.provider}
                                            data-testid={`byok-row-${credential.provider}`}
                                            className={listRowClass}
                                        >
                                            <div className="flex flex-col min-w-0 flex-1">
                                                <span className={listRowTitleClass}>{name}</span>
                                                <span className={listRowNoteClass}>
                                                    {isChecking
                                                        ? 'Checking...'
                                                        : credentialNote(credential)}
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-1 shrink-0">
                                                <button
                                                    type="button"
                                                    onClick={() => handleRefresh(credential)}
                                                    disabled={refreshKey.isPending}
                                                    aria-label={`Check ${name} key again`}
                                                    title="Check again"
                                                    className={cn(
                                                        rowIconButtonClass,
                                                        'hover:text-[#D6D5C9]'
                                                    )}
                                                >
                                                    {isChecking ? (
                                                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                                    ) : (
                                                        <RefreshCw className="w-3.5 h-3.5" />
                                                    )}
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => openRemove(credential)}
                                                    disabled={isChecking}
                                                    aria-label={`Remove ${name} key`}
                                                    title="Remove"
                                                    className={cn(
                                                        rowIconButtonClass,
                                                        'hover:text-red-400'
                                                    )}
                                                >
                                                    <Trash2 className="w-3.5 h-3.5" />
                                                </button>
                                            </div>
                                        </div>
                                    )
                                })}
                            </ListRows>
                        )}
                    </ListBox>
                </SettingsSection>
            </SettingsPage>

            <Modal
                isOpen={isAddOpen}
                onClose={closeAdd}
                title={
                    selectedProvider
                        ? `${replacing ? 'Replace' : 'Add'} ${selectedProvider.name} key`
                        : 'Add key'
                }
                description={
                    selectedProvider?.keyHint ||
                    'December checks the key with the provider before it saves it.'
                }
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
                                className={cn(inputClass, 'pl-9')}
                            />
                        </div>
                        <div className="max-h-[320px] overflow-y-auto flex flex-col">
                            {filteredProviders.map((provider) => (
                                <button
                                    key={provider.id}
                                    type="button"
                                    onClick={() => pickProvider(provider)}
                                    className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg text-left text-[13px] text-[#D6D5C9] hover:bg-white/5 hover:text-white cursor-pointer"
                                >
                                    <span className="truncate">{provider.name}</span>
                                    {isSaved(provider.id) && (
                                        <span className="shrink-0 text-[12px] text-[#7B7A79]">
                                            Saved
                                        </span>
                                    )}
                                </button>
                            ))}
                            {filteredProviders.length === 0 && (
                                <span className="px-3 py-2 text-[13px] text-[#7B7A79]">
                                    No provider matches
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
                                    autoCapitalize="off"
                                    spellCheck={false}
                                    maxLength={4096}
                                    placeholder="Paste your key"
                                    value={apiKey}
                                    onChange={(e) => setApiKey(e.target.value)}
                                    disabled={saveKey.isPending}
                                    className={cn(inputClass, 'pr-10 font-mono')}
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

                        <FormError>{formError}</FormError>

                        <ModalActions
                            onCancel={closeAdd}
                            submitLabel={replacing ? 'Replace key' : 'Add key'}
                            submitDisabled={!apiKey.trim()}
                            isPending={saveKey.isPending}
                            leading={
                                <button
                                    type="button"
                                    onClick={() => pickProvider(null)}
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

            <Modal
                isOpen={removing !== null}
                onClose={closeRemove}
                title={removing ? `Remove ${nameOf(removing.provider)} key` : 'Remove key'}
                description="December stops using this key. You can add it again later."
                variant="premium"
                showLogo={false}
                sheetOnPhone
            >
                <form onSubmit={handleRemove} className="flex flex-col gap-4">
                    <FormError>{removeError}</FormError>
                    <ModalActions
                        onCancel={closeRemove}
                        submitLabel="Remove"
                        isPending={removeKey.isPending}
                        danger
                    />
                </form>
            </Modal>
        </>
    )
}
