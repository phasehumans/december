import { Check, Copy, Eye, EyeOff, Trash2 } from 'lucide-react'
import React from 'react'

import { ProfileSecretsSkeleton } from './ProfileSettingsSkeleton'
import {
    listBoxClass,
    listEmptyClass,
    listHeaderClass,
    listRowNoteClass,
    listRowsClass,
    textLinkClass,
} from './settingsStyles'
import { SettingsEmptyArt } from './SettingsUi'

import type { SecretSummary } from '../api/secrets'
import type { ListArtKind } from '@/features/sessions/components/ListParts'

import { MoreMenu } from '@/features/connections/components/ConnectionsUi'
import { Tooltip } from '@/shared/components/ui/Tooltip'

/** the columns of the desktop list: name, use in, note, updated, actions */
export const SECRETS_GRID = 'grid grid-cols-12 items-center gap-x-2'

const iconButtonClass =
    'p-1 rounded text-[#7B7A79] hover:text-[#D6D5C9] hover:bg-[#2A2A2A] transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-default'

export const formatSecretDate = (iso: string) => {
    const date = new Date(iso)
    if (Number.isNaN(date.getTime())) return ''
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export interface SecretRowActions {
    /** the plain value of each shown row, by row id */
    revealed: Record<string, string>
    /** the row whose value is on its way, or null */
    busyId: string | null
    /** the row whose value was just copied, or null */
    copiedId: string | null
    onToggleReveal: (secret: SecretSummary) => void
    onCopy: (secret: SecretSummary) => void
    onDelete: (secret: SecretSummary) => void
}

const SecretRow: React.FC<SecretRowActions & { secret: SecretSummary; usedIn: string | null }> = ({
    secret,
    usedIn,
    revealed,
    busyId,
    copiedId,
    onToggleReveal,
    onCopy,
    onDelete,
}) => {
    const value = revealed[secret.id]
    const isRevealed = value !== undefined
    const isBusy = busyId === secret.id
    const isCopied = copiedId === secret.id
    const date = formatSecretDate(secret.updatedAt)
    const nameOrValue = isRevealed ? (
        <span className="font-mono font-medium text-[#87B2F4] select-all truncate min-w-0">
            {value}
        </span>
    ) : (
        <span className="font-mono font-medium text-[#D6D5C9] truncate min-w-0">
            ${secret.name}
        </span>
    )

    return (
        <div data-secret-row={secret.id}>
            {/* phones: the name with where it is used and its note, the date and a ⋯ menu */}
            <div className="md:hidden flex items-center gap-3 px-3.5 py-3 text-[13px]">
                <div className="flex flex-col min-w-0 flex-1">
                    {nameOrValue}
                    <span className={listRowNoteClass}>
                        {[usedIn ?? 'All repositories', secret.note].filter(Boolean).join(' · ')}
                    </span>
                </div>
                <span className="shrink-0 text-[12px] text-[#7B7A79]">
                    {isCopied ? 'Copied' : date}
                </span>
                <MoreMenu
                    label={`Options for ${secret.name}`}
                    items={[
                        {
                            label: isRevealed ? 'Hide value' : 'Show value',
                            onClick: () => onToggleReveal(secret),
                        },
                        { label: 'Copy value', onClick: () => onCopy(secret) },
                        { label: 'Delete', onClick: () => onDelete(secret), danger: true },
                    ]}
                />
            </div>

            {/* desktop: one grid row, the actions show on hover and on keyboard focus */}
            <div className={`group hidden md:grid ${SECRETS_GRID} px-4 py-3 text-[13px]`}>
                <div className="col-span-3 flex min-w-0">{nameOrValue}</div>
                <div data-use-in="" className="col-span-2 text-[#7B7A79] truncate">
                    {usedIn ?? 'All'}
                </div>
                <div className="col-span-3 text-[#7B7A79] truncate">{secret.note || ''}</div>
                <div className="col-span-2 text-[12px] text-[#7B7A79] truncate">{date}</div>
                <div className="col-span-2 flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity duration-150">
                    <Tooltip position="top" content={isRevealed ? 'Hide value' : 'Show value'}>
                        <button
                            type="button"
                            aria-label={isRevealed ? 'Hide value' : 'Show value'}
                            disabled={isBusy}
                            onClick={() => onToggleReveal(secret)}
                            className={iconButtonClass}
                        >
                            {isRevealed ? (
                                <EyeOff className="w-3.5 h-3.5" />
                            ) : (
                                <Eye className="w-3.5 h-3.5" />
                            )}
                        </button>
                    </Tooltip>
                    <Tooltip position="top" content={isCopied ? 'Copied' : 'Copy value'}>
                        <button
                            type="button"
                            aria-label={isCopied ? 'Copied' : 'Copy value'}
                            disabled={isBusy}
                            onClick={() => onCopy(secret)}
                            className={iconButtonClass}
                        >
                            {isCopied ? (
                                <Check className="w-3.5 h-3.5 text-[#34D399]" />
                            ) : (
                                <Copy className="w-3.5 h-3.5" />
                            )}
                        </button>
                    </Tooltip>
                    <Tooltip position="top" align="end" content="Delete secret">
                        <button
                            type="button"
                            aria-label="Delete secret"
                            onClick={() => onDelete(secret)}
                            className={`${iconButtonClass} hover:text-red-400`}
                        >
                            <Trash2 className="w-3.5 h-3.5" />
                        </button>
                    </Tooltip>
                </div>
            </div>
        </div>
    )
}

/** the list box of secrets: a header band, then the rows, or one line when there are none */
export const SecretsList: React.FC<
    SecretRowActions & {
        secrets: SecretSummary[]
        isLoading: boolean
        loadError: string | null
        emptyText: string
        emptyArt: ListArtKind
        emptyAction?: React.ReactNode
        repoLabel: (repoFullName: string) => string
        onRetry: () => void
    }
> = ({
    secrets,
    isLoading,
    loadError,
    emptyText,
    emptyArt,
    emptyAction,
    repoLabel,
    onRetry,
    ...actions
}) => (
    <div className={listBoxClass}>
        <div className={`hidden md:block ${listHeaderClass}`}>
            <div className={SECRETS_GRID}>
                <div className="col-span-3">Name</div>
                <div className="col-span-2">Use in</div>
                <div className="col-span-3">Note</div>
                <div className="col-span-2">Updated</div>
                <div className="col-span-2" />
            </div>
        </div>

        {isLoading ? (
            <ProfileSecretsSkeleton />
        ) : loadError ? (
            <div className={`${listEmptyClass} flex items-center gap-2 flex-wrap`}>
                <span>Secrets did not load.</span>
                <button type="button" onClick={onRetry} className={textLinkClass}>
                    Try again
                </button>
            </div>
        ) : secrets.length === 0 ? (
            <SettingsEmptyArt art={emptyArt} title={emptyText}>
                {emptyAction}
            </SettingsEmptyArt>
        ) : (
            <div className={listRowsClass}>
                {secrets.map((secret) => (
                    <SecretRow
                        key={secret.id}
                        secret={secret}
                        usedIn={secret.repoFullName ? repoLabel(secret.repoFullName) : null}
                        {...actions}
                    />
                ))}
            </div>
        )}
    </div>
)
