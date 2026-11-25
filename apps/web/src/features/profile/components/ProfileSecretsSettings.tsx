import { useQuery } from '@tanstack/react-query'
import {
    Search,
    Plus,
    Eye,
    EyeOff,
    Copy,
    Check,
    Trash2,
    MoreHorizontal,
    ChevronDown,
    ChevronLeft,
    ChevronRight,
} from 'lucide-react'
import React, { useEffect, useState } from 'react'

import { secretsAPI, type SecretSummary } from '../api/secrets'

import { ProfileSecretsSkeleton } from './ProfileSettingsSkeleton'
import { SettingsPageHeader } from './SettingsPageHeader'
import {
    blueButtonClass,
    listBoxClass,
    listEmptyClass,
    listHeaderClass,
    listRowsClass,
    outlineButtonClass,
} from './settingsStyles'
import { SettingsSelect } from './SettingsUi'

import { ModalActions } from '@/features/connections/components/ConnectionsUi'
import { profileAPI } from '@/features/profile/api/profile'
import { useConnectedRepos } from '@/features/profile/hooks/useConnectedRepos'
import { useSettingsTopBarAction } from '@/features/profile/lib/settingsTopBar'
import { ErrorAlert } from '@/shared/components/ui/ErrorAlert'
import { Modal } from '@/shared/components/ui/Modal'
import { Tooltip } from '@/shared/components/ui/Tooltip'
import { isSkeletonPreviewActive } from '@/shared/lib/skeletonPreview'

// the "use in" value of a secret that every repository gets
const ALL_REPOSITORIES = ''

export const ProfileSecretsSettings: React.FC = () => {
    const [secrets, setSecrets] = useState<SecretSummary[]>([])
    const [decryptedValues, setDecryptedValues] = useState<Record<string, string>>({})
    const [revealedNames, setRevealedNames] = useState<Record<string, boolean>>({})
    const [copiedName, setCopiedName] = useState<string | null>(null)
    const [openMobileMenuName, setOpenMobileMenuName] = useState<string | null>(null)
    const [searchQuery, setSearchQuery] = useState('')
    const [isLoading, setIsLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    // Modal state for Add Secret
    const [isAddOpen, setIsAddOpen] = useState(false)
    // a secret for one repository (N8, issue 637): '' is all repositories
    const [newUseIn, setNewUseIn] = useState<string>(ALL_REPOSITORIES)
    const { data: profile } = useQuery({ queryKey: ['profile'], queryFn: profileAPI.getProfile })
    const { repos } = useConnectedRepos({
        enabled: Boolean(profile),
        isGithubConnected: Boolean(profile?.githubAppInstall || profile?.githubConnected),
    })
    // the server keeps a repository in lower case: show the name as the git host writes it
    const repoLabel = (repoFullName: string) =>
        repos.find((repo) => repo.fullName.toLowerCase() === repoFullName.toLowerCase())
            ?.fullName ?? repoFullName
    const useInOptions = [
        { value: ALL_REPOSITORIES, label: 'All repositories' },
        ...repos.map((repo) => ({ value: repo.fullName, label: repo.fullName })),
    ]
    // phones: the + in the top bar opens the Add secret dialog (P3)
    useSettingsTopBarAction('Add secret', () => setIsAddOpen(true))
    const [newName, setNewName] = useState('')
    const [newValue, setNewValue] = useState('')
    const [newNote, setNewNote] = useState('')
    const [showNewValue, setShowNewValue] = useState(false)
    const [isSubmitting, setIsSubmitting] = useState(false)

    // Pagination state
    const [limit, setLimit] = useState(10)
    const [offset, setOffset] = useState(0)
    const [isDropdownOpen, setIsDropdownOpen] = useState(false)

    // Modal state for Bulk Add Secrets
    const [isBulkAddOpen, setIsBulkAddOpen] = useState(false)
    const [bulkContent, setBulkContent] = useState('')
    const [bulkUseIn, setBulkUseIn] = useState<string>(ALL_REPOSITORIES)

    const loadSecrets = async () => {
        setIsLoading(true)
        setError(null)
        try {
            const data = await secretsAPI.getSecrets()
            setSecrets(data.secrets || [])
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : 'Failed to fetch secrets'
            setError(msg)
        } finally {
            setIsLoading(false)
        }
    }

    useEffect(() => {
        loadSecrets()
    }, [])

    useEffect(() => {
        setOffset(0)
    }, [searchQuery])

    const filteredSecrets = secrets.filter((s) => {
        const matchesQuery =
            s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            (s.note && s.note.toLowerCase().includes(searchQuery.toLowerCase()))
        return matchesQuery
    })

    const totalSecrets = filteredSecrets.length
    const paginatedSecrets = filteredSecrets.slice(offset, offset + limit)
    const currentPage = Math.floor(offset / limit) + 1
    const totalPages = Math.max(Math.ceil(totalSecrets / limit), 1)

    const handlePreviousPage = () => {
        if (offset >= limit) {
            setOffset((prev) => prev - limit)
        }
    }

    const handleNextPage = () => {
        if (offset + limit < totalSecrets) {
            setOffset((prev) => prev + limit)
        }
    }

    // a name can be there two times (all repositories and one repository), so the state
    // of a row is kept by its id and each call names the repository of the row
    const toggleReveal = async (sec: SecretSummary) => {
        const currentlyRevealed = Boolean(revealedNames[sec.id])
        if (currentlyRevealed) {
            setRevealedNames((prev) => ({ ...prev, [sec.id]: false }))
            return
        }

        if (!decryptedValues[sec.id]) {
            try {
                const res = await secretsAPI.getSecretValue(sec.name, sec.repoFullName)
                setDecryptedValues((prev) => ({ ...prev, [sec.id]: res.secret.value }))
            } catch (err: unknown) {
                const msg = err instanceof Error ? err.message : 'Failed to fetch secret value'
                setError(msg)
                return
            }
        }
        setRevealedNames((prev) => ({ ...prev, [sec.id]: true }))
    }

    const handleCopy = async (sec: SecretSummary) => {
        let val = decryptedValues[sec.id]
        if (!val) {
            try {
                const res = await secretsAPI.getSecretValue(sec.name, sec.repoFullName)
                val = res.secret.value
                setDecryptedValues((prev) => ({ ...prev, [sec.id]: val }))
            } catch (err: unknown) {
                const msg = err instanceof Error ? err.message : 'Failed to fetch secret value'
                setError(msg)
                return
            }
        }
        if (val) {
            await navigator.clipboard.writeText(val)
            setCopiedName(sec.id)
            setTimeout(() => setCopiedName(null), 2000)
        }
    }

    const handleDelete = async (sec: SecretSummary) => {
        try {
            await secretsAPI.deleteSecret(sec.name, sec.repoFullName)
            setSecrets((prev) => prev.filter((s) => s.id !== sec.id))
            setDecryptedValues((prev) => {
                const copy = { ...prev }
                delete copy[sec.id]
                return copy
            })
            setRevealedNames((prev) => {
                const copy = { ...prev }
                delete copy[sec.id]
                return copy
            })
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : 'Failed to delete secret'
            setError(msg)
        }
    }

    const handleAddSecret = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!newName.trim() || !newValue.trim()) return

        const formattedName = newName
            .trim()
            .toUpperCase()
            .replace(/[^A-Z0-9_]/g, '_')

        setIsSubmitting(true)
        setError(null)
        try {
            await secretsAPI.createSecret({
                name: formattedName,
                value: newValue.trim(),
                note: newNote.trim() || undefined,
                repoFullName: newUseIn || null,
            })
            // the row may be saved again with a new value: drop the value read before
            setDecryptedValues({})
            setRevealedNames({})
            setNewName('')
            setNewValue('')
            setNewNote('')
            setNewUseIn(ALL_REPOSITORIES)
            setShowNewValue(false)
            setIsAddOpen(false)
            await loadSecrets()
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : 'Failed to add secret'
            setError(msg)
        } finally {
            setIsSubmitting(false)
        }
    }

    const handleBulkAddSecrets = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!bulkContent.trim()) return

        const lines = bulkContent.split('\n')
        const items: Array<{ name: string; value: string; note?: string }> = []

        lines.forEach((line) => {
            const trimmed = line.trim()
            if (!trimmed || trimmed.startsWith('#')) return

            const eqIndex = trimmed.indexOf('=')
            if (eqIndex > 0) {
                const rawKey = trimmed.substring(0, eqIndex).trim()
                const rawVal = trimmed.substring(eqIndex + 1).trim()
                const formattedKey = rawKey.toUpperCase().replace(/[^A-Z0-9_]/g, '_')

                if (formattedKey && rawVal) {
                    items.push({
                        name: formattedKey,
                        value: rawVal,
                        note: 'Bulk imported secret',
                    })
                }
            }
        })

        if (items.length === 0) return

        setIsSubmitting(true)
        setError(null)
        try {
            await secretsAPI.bulkCreateSecrets({
                secrets: items,
                repoFullName: bulkUseIn || null,
            })
            setBulkContent('')
            setBulkUseIn(ALL_REPOSITORIES)
            setIsBulkAddOpen(false)
            await loadSecrets()
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : 'Failed to bulk import secrets'
            setError(msg)
        } finally {
            setIsSubmitting(false)
        }
    }

    const formatDate = (dateStr: string) => {
        try {
            const d = new Date(dateStr)
            return d.toLocaleDateString(undefined, {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
            })
        } catch {
            return dateStr
        }
    }

    return (
        <div className="flex flex-col w-full max-w-[772px] text-[#D6D5C9]">
            {/* Header */}
            <div className="flex flex-col mb-0">
                <SettingsPageHeader
                    title="Secrets"
                    subtitle={
                        <>
                            Use a secret in a session as{' '}
                            <span className="text-[#87B2F4]">$NAME</span>.
                        </>
                    }
                />
                <div className="flex flex-col gap-4">
                    <ErrorAlert message={error} onClear={() => setError(null)} />

                    {/* Controls Row: Search Input + Action Buttons */}
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                        {/* Search bar */}
                        <div className="relative flex-1 max-w-full sm:max-w-[280px]">
                            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#7B7A79]" />
                            <input
                                type="text"
                                placeholder="Search secrets"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full pl-9 pr-3 py-1.5 bg-[#1F1F1F] border border-[#2A2A2A] rounded-lg text-[13px] text-[#D6D5C9] placeholder-[#7B7A79] focus:outline-none focus:border-[#5A5A5A] transition-colors"
                            />
                        </div>

                        {/* Action Buttons. phones use the + in the top bar */}
                        <div className="hidden md:flex items-center gap-2">
                            <button
                                onClick={() => setIsBulkAddOpen(true)}
                                className={outlineButtonClass}
                            >
                                Bulk add
                            </button>

                            <button
                                onClick={() => setIsAddOpen(true)}
                                className={`${blueButtonClass} flex items-center justify-center gap-1.5`}
                            >
                                <Plus className="w-3.5 h-3.5" />
                                <span>Add secret</span>
                            </button>
                        </div>
                    </div>

                    {/* Secrets Table Container */}
                    <div className={listBoxClass}>
                        {/* Table Header: desktop only, phone rows explain themselves */}
                        <div className={`hidden md:block ${listHeaderClass}`}>
                            <div className="grid grid-cols-12">
                                <div className="col-span-3">Name</div>
                                <div className="col-span-2">Use in</div>
                                <div className="col-span-3">Note</div>
                                <div className="col-span-2">Updated at</div>
                                <div className="col-span-2 text-right"></div>
                            </div>
                        </div>

                        {/* Table Rows or Loading/Empty State */}
                        {isLoading || isSkeletonPreviewActive() ? (
                            <ProfileSecretsSkeleton />
                        ) : filteredSecrets.length === 0 ? (
                            <div className={listEmptyClass}>
                                {searchQuery.trim() ? 'No secrets match' : 'No secrets yet'}
                            </div>
                        ) : (
                            <div className={listRowsClass}>
                                {paginatedSecrets.map((sec) => {
                                    const isRevealed = Boolean(revealedNames[sec.id])
                                    const decryptedVal = decryptedValues[sec.id]
                                    const usedIn = sec.repoFullName
                                        ? repoLabel(sec.repoFullName)
                                        : null

                                    return (
                                        <React.Fragment key={sec.id}>
                                            {/* Mobile card (< md) */}
                                            <div className="md:hidden p-3.5 flex flex-col gap-1.5 text-[13px] relative">
                                                <div className="flex items-center justify-between gap-3">
                                                    {/* Left: Name (or revealed value) and Note */}
                                                    <div className="flex flex-col min-w-0 pr-2">
                                                        {isRevealed && decryptedVal ? (
                                                            <span className="font-mono font-medium text-[#87B2F4] select-all truncate text-[13px]">
                                                                {decryptedVal}
                                                            </span>
                                                        ) : (
                                                            <span className="font-mono font-medium text-white truncate text-[13px]">
                                                                ${sec.name}
                                                            </span>
                                                        )}
                                                        {usedIn && (
                                                            <span className="text-[12px] text-[#8F8E8D] truncate mt-0.5">
                                                                {usedIn}
                                                            </span>
                                                        )}
                                                        {sec.note && (
                                                            <span className="text-[12px] text-[#8F8E8D] truncate mt-0.5">
                                                                {sec.note}
                                                            </span>
                                                        )}
                                                    </div>

                                                    {/* Right: Date and 3-dots button */}
                                                    <div className="flex items-center gap-2 shrink-0">
                                                        <span className="text-[12px] text-[#7B7A79]">
                                                            {formatDate(sec.updatedAt)}
                                                        </span>

                                                        {/* 3-dots dropdown */}
                                                        <div className="relative">
                                                            <button
                                                                type="button"
                                                                onClick={(e) => {
                                                                    e.stopPropagation()
                                                                    setOpenMobileMenuName(
                                                                        openMobileMenuName ===
                                                                            sec.id
                                                                            ? null
                                                                            : sec.id
                                                                    )
                                                                }}
                                                                className="p-1 rounded text-[#7B7A79] hover:text-white hover:bg-[#2A2A2A] active:scale-95 transition-all cursor-pointer flex items-center justify-center"
                                                                aria-label="Secret options"
                                                            >
                                                                <MoreHorizontal className="w-4 h-4" />
                                                            </button>

                                                            {openMobileMenuName === sec.id && (
                                                                <>
                                                                    <div
                                                                        className="fixed inset-0 z-40"
                                                                        onClick={(e) => {
                                                                            e.stopPropagation()
                                                                            setOpenMobileMenuName(
                                                                                null
                                                                            )
                                                                        }}
                                                                    />
                                                                    <div className="absolute right-0 top-full mt-1.5 z-50 w-36 bg-[#1C1C1C] border border-[#2B2A27] rounded-xl shadow-2xl p-1 flex flex-col gap-0.5 animate-in fade-in zoom-in-95 duration-100">
                                                                        <button
                                                                            type="button"
                                                                            onClick={(e) => {
                                                                                e.stopPropagation()
                                                                                toggleReveal(sec)
                                                                                setOpenMobileMenuName(
                                                                                    null
                                                                                )
                                                                            }}
                                                                            className="flex items-center gap-2.5 w-full px-2.5 py-1.5 rounded-lg text-[12px] text-[#D6D5C9] hover:text-white hover:bg-[#282828] transition-colors text-left cursor-pointer"
                                                                        >
                                                                            {isRevealed ? (
                                                                                <EyeOff className="w-3.5 h-3.5 text-[#8F8E8D]" />
                                                                            ) : (
                                                                                <Eye className="w-3.5 h-3.5 text-[#8F8E8D]" />
                                                                            )}
                                                                            <span>
                                                                                {isRevealed
                                                                                    ? 'Hide value'
                                                                                    : 'Reveal value'}
                                                                            </span>
                                                                        </button>

                                                                        <button
                                                                            type="button"
                                                                            onClick={(e) => {
                                                                                e.stopPropagation()
                                                                                handleCopy(sec)
                                                                                setOpenMobileMenuName(
                                                                                    null
                                                                                )
                                                                            }}
                                                                            className="flex items-center gap-2.5 w-full px-2.5 py-1.5 rounded-lg text-[12px] text-[#D6D5C9] hover:text-white hover:bg-[#282828] transition-colors text-left cursor-pointer"
                                                                        >
                                                                            {copiedName ===
                                                                            sec.id ? (
                                                                                <Check className="w-3.5 h-3.5 text-[#34D399]" />
                                                                            ) : (
                                                                                <Copy className="w-3.5 h-3.5 text-[#8F8E8D]" />
                                                                            )}
                                                                            <span>
                                                                                {copiedName ===
                                                                                sec.id
                                                                                    ? 'Copied'
                                                                                    : 'Copy value'}
                                                                            </span>
                                                                        </button>

                                                                        <button
                                                                            type="button"
                                                                            onClick={(e) => {
                                                                                e.stopPropagation()
                                                                                handleDelete(sec)
                                                                                setOpenMobileMenuName(
                                                                                    null
                                                                                )
                                                                            }}
                                                                            className="flex items-center gap-2.5 w-full px-2.5 py-1.5 rounded-lg text-[12px] text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-colors text-left cursor-pointer"
                                                                        >
                                                                            <Trash2 className="w-3.5 h-3.5 text-red-400" />
                                                                            <span>
                                                                                Delete secret
                                                                            </span>
                                                                        </button>
                                                                    </div>
                                                                </>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Desktop row (>= md) */}
                                            <div className="group hidden md:grid grid-cols-12 items-center px-4 py-3 text-[13px]">
                                                {/* Name / Revealed Value */}
                                                <div className="col-span-3 font-mono font-medium truncate pr-2">
                                                    {isRevealed && decryptedVal ? (
                                                        <span className="text-[#87B2F4] select-all truncate">
                                                            {decryptedVal}
                                                        </span>
                                                    ) : (
                                                        <span className="text-[#D6D5C9]">
                                                            ${sec.name}
                                                        </span>
                                                    )}
                                                </div>

                                                {/* Use in: the repository, or All */}
                                                <div
                                                    data-use-in=""
                                                    className="col-span-2 text-[#7B7A79] truncate pr-2"
                                                >
                                                    {usedIn ?? 'All'}
                                                </div>

                                                {/* Note */}
                                                <div className="col-span-3 text-[#7B7A79] truncate pr-2">
                                                    {sec.note || ''}
                                                </div>

                                                {/* Updated at */}
                                                <div className="col-span-2 text-[12px] text-[#7B7A79]">
                                                    {formatDate(sec.updatedAt)}
                                                </div>

                                                {/* Actions (hover only + tooltips) */}
                                                <div className="col-span-2 flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                                                    <Tooltip
                                                        position="top"
                                                        content={
                                                            isRevealed
                                                                ? 'Hide secret'
                                                                : 'Reveal secret'
                                                        }
                                                    >
                                                        <button
                                                            onClick={() => toggleReveal(sec)}
                                                            className="p-1 rounded text-[#7B7A79] hover:text-[#D6D5C9] hover:bg-[#2A2A2A] transition-colors cursor-pointer"
                                                        >
                                                            {isRevealed ? (
                                                                <EyeOff className="w-3.5 h-3.5" />
                                                            ) : (
                                                                <Eye className="w-3.5 h-3.5" />
                                                            )}
                                                        </button>
                                                    </Tooltip>

                                                    <Tooltip
                                                        position="top"
                                                        content="Copy secret value"
                                                    >
                                                        <button
                                                            onClick={() => handleCopy(sec)}
                                                            className="p-1 rounded text-[#7B7A79] hover:text-[#D6D5C9] hover:bg-[#2A2A2A] transition-colors cursor-pointer"
                                                        >
                                                            {copiedName === sec.id ? (
                                                                <Check className="w-3.5 h-3.5 text-[#34D399]" />
                                                            ) : (
                                                                <Copy className="w-3.5 h-3.5" />
                                                            )}
                                                        </button>
                                                    </Tooltip>

                                                    <Tooltip
                                                        position="top"
                                                        align="end"
                                                        content="Delete secret"
                                                    >
                                                        <button
                                                            onClick={() => handleDelete(sec)}
                                                            className="p-1 rounded text-[#7B7A79] hover:text-red-400 hover:bg-[#2A2A2A] transition-colors cursor-pointer"
                                                        >
                                                            <Trash2 className="w-3.5 h-3.5" />
                                                        </button>
                                                    </Tooltip>
                                                </div>
                                            </div>
                                        </React.Fragment>
                                    )
                                })}
                            </div>
                        )}
                    </div>

                    {/* footer controls */}
                    {/* phones: no "Show" control, and the pager shows only with a second page */}
                    {totalSecrets > 0 && (
                        <div
                            className={`items-center justify-between mt-5 ${totalPages > 1 ? 'flex' : 'hidden md:flex'}`}
                        >
                            {/* left limit selector */}
                            <div className="hidden md:flex items-center gap-2">
                                <span className="text-[12.5px] text-[#7B7A79]">Show</span>
                                <div className="relative">
                                    <button
                                        type="button"
                                        onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                                        className="flex items-center justify-between w-[70px] bg-[#1F1F1F] border border-[#2A2A2A] rounded-lg px-2.5 py-1 text-[12.5px] text-[#D6D5C9] hover:bg-[#242424] transition-colors focus:outline-none focus:border-[#7B7A79] font-medium cursor-pointer"
                                    >
                                        <span>{limit}</span>
                                        <ChevronDown className="w-3.5 h-3.5 text-[#7B7A79]" />
                                    </button>

                                    {isDropdownOpen && (
                                        <>
                                            <div
                                                className="fixed inset-0 z-10"
                                                onClick={() => setIsDropdownOpen(false)}
                                            />
                                            <div className="absolute bottom-full left-0 mb-1 z-20 w-[70px] bg-[#1F1F1F] border border-[#2A2A2A] rounded-lg shadow-xl overflow-hidden py-1">
                                                {[10, 20, 30].map((num) => (
                                                    <button
                                                        key={num}
                                                        type="button"
                                                        onClick={() => {
                                                            setLimit(num)
                                                            setOffset(0)
                                                            setIsDropdownOpen(false)
                                                        }}
                                                        className={`w-full text-left px-2.5 py-1 text-[12.5px] transition-colors cursor-pointer ${
                                                            limit === num
                                                                ? 'bg-[#2B2A29] text-[#D6D5C9] font-medium'
                                                                : 'text-[#7B7A79] hover:bg-[#202020] hover:text-[#D6D5C9]'
                                                        }`}
                                                    >
                                                        {num}
                                                    </button>
                                                ))}
                                            </div>
                                        </>
                                    )}
                                </div>
                            </div>

                            {/* right page selectors */}
                            <div className="flex items-center gap-4 text-[12.5px] text-[#7B7A79] font-medium">
                                <span>
                                    {currentPage} of {totalPages}
                                </span>
                                <div className="flex items-center gap-1.5">
                                    <button
                                        onClick={handlePreviousPage}
                                        disabled={offset === 0}
                                        aria-label="Previous page"
                                        className="p-1.5 rounded-lg border border-[#383736] disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[#191919] transition-colors bg-[#141414] text-[#D6D5C9] cursor-pointer"
                                    >
                                        <ChevronLeft className="w-4 h-4" />
                                    </button>
                                    <button
                                        onClick={handleNextPage}
                                        disabled={offset + limit >= totalSecrets}
                                        aria-label="Next page"
                                        className="p-1.5 rounded-lg border border-[#383736] disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[#191919] transition-colors bg-[#141414] text-[#D6D5C9] cursor-pointer"
                                    >
                                        <ChevronRight className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Modal: Add Single Secret */}
            <Modal
                isOpen={isAddOpen}
                onClose={() => {
                    setIsAddOpen(false)
                    setNewName('')
                    setNewValue('')
                    setNewNote('')
                    setNewUseIn(ALL_REPOSITORIES)
                    setShowNewValue(false)
                }}
                title="Add secret"
                description="Use it in a session as $NAME."
                variant="premium"
                showLogo={false}
                sheetOnPhone
            >
                <form onSubmit={handleAddSecret} className="flex flex-col gap-4">
                    <div className="flex flex-col gap-1.5">
                        <label
                            htmlFor="secret-name-input"
                            className="text-[12px] font-medium text-[#8F8E8D]"
                        >
                            Name
                        </label>
                        <input
                            id="secret-name-input"
                            type="text"
                            autoFocus
                            placeholder="SERVICE_USERNAME"
                            value={newName}
                            onChange={(e) => setNewName(e.target.value)}
                            className="w-full bg-white/[0.03] border border-[#2B2A27] rounded-lg px-3.5 py-2.5 text-white text-[13px] font-mono focus:outline-none transition-[border-color,box-shadow] duration-200 placeholder:text-[#4A4948]"
                            required
                        />
                    </div>

                    <div className="flex flex-col gap-1.5">
                        <label
                            htmlFor="secret-value-input"
                            className="text-[12px] font-medium text-[#8F8E8D]"
                        >
                            Value
                        </label>
                        <div className="relative">
                            <input
                                id="secret-value-input"
                                type={showNewValue ? 'text' : 'password'}
                                placeholder="Key or token"
                                value={newValue}
                                onChange={(e) => setNewValue(e.target.value)}
                                className="w-full bg-white/[0.03] border border-[#2B2A27] rounded-lg pl-3.5 pr-10 py-2.5 text-white text-[13px] font-mono focus:outline-none transition-[border-color,box-shadow] duration-200 placeholder:text-[#4A4948]"
                                required
                            />
                            <button
                                type="button"
                                onClick={() => setShowNewValue(!showNewValue)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#7B7A79] hover:text-[#D6D5C9] transition-colors cursor-pointer"
                                aria-label={
                                    showNewValue ? 'Hide secret value' : 'Show secret value'
                                }
                            >
                                {showNewValue ? (
                                    <EyeOff className="w-4 h-4" />
                                ) : (
                                    <Eye className="w-4 h-4" />
                                )}
                            </button>
                        </div>
                    </div>

                    <div className="flex flex-col gap-1.5">
                        <span className="text-[12px] font-medium text-[#8F8E8D]">Use in</span>
                        <SettingsSelect
                            label="Use in"
                            value={newUseIn}
                            options={useInOptions}
                            onChange={setNewUseIn}
                            className="w-full"
                        />
                    </div>
                    <div className="flex flex-col gap-1.5">
                        <label
                            htmlFor="secret-note-input"
                            className="text-[12px] font-medium text-[#8F8E8D]"
                        >
                            Note
                        </label>
                        <input
                            id="secret-note-input"
                            type="text"
                            placeholder="Optional"
                            value={newNote}
                            onChange={(e) => setNewNote(e.target.value)}
                            className="w-full bg-white/[0.03] border border-[#2B2A27] rounded-lg px-3.5 py-2.5 text-white text-[13px] focus:outline-none transition-[border-color,box-shadow] duration-200 placeholder:text-[#4A4948]"
                        />
                    </div>

                    <ModalActions
                        onCancel={() => setIsAddOpen(false)}
                        submitLabel="Add secret"
                        submitDisabled={!newName.trim() || !newValue.trim()}
                        isPending={isSubmitting}
                        leading={
                            <button
                                type="button"
                                onClick={() => {
                                    setIsAddOpen(false)
                                    setIsBulkAddOpen(true)
                                }}
                                className="text-[12.5px] font-medium text-[#87B2F4] hover:underline cursor-pointer"
                            >
                                Paste a .env file
                            </button>
                        }
                    />
                </form>
            </Modal>

            {/* Modal: Bulk Add Secrets */}
            <Modal
                isOpen={isBulkAddOpen}
                onClose={() => {
                    setIsBulkAddOpen(false)
                    setBulkContent('')
                    setBulkUseIn(ALL_REPOSITORIES)
                }}
                title="Add secrets"
                description="One NAME=value on each line."
                variant="premium"
                showLogo={false}
                sheetOnPhone
            >
                <form onSubmit={handleBulkAddSecrets} className="flex flex-col gap-4">
                    <div className="flex flex-col gap-1.5">
                        <textarea
                            autoFocus
                            placeholder={`SERVICE_USERNAME=admin\nSTRIPE_API_KEY=sk_test_12345\nDATABASE_URL=postgres://...`}
                            value={bulkContent}
                            onChange={(e) => setBulkContent(e.target.value)}
                            rows={8}
                            className="w-full bg-white/[0.03] border border-[#2B2A27] rounded-lg px-3.5 py-2.5 text-white text-[13px] font-mono focus:outline-none transition-[border-color,box-shadow] duration-200 placeholder:text-[#4A4948] resize-none"
                            required
                        />
                    </div>
                    <div className="flex flex-col gap-1.5">
                        <span className="text-[12px] font-medium text-[#8F8E8D]">Use in</span>
                        <SettingsSelect
                            label="Use in"
                            value={bulkUseIn}
                            options={useInOptions}
                            onChange={setBulkUseIn}
                            className="w-full"
                        />
                    </div>

                    <ModalActions
                        onCancel={() => setIsBulkAddOpen(false)}
                        submitLabel="Add secrets"
                        submitDisabled={!bulkContent.trim()}
                        isPending={isSubmitting}
                    />
                </form>
            </Modal>
        </div>
    )
}
