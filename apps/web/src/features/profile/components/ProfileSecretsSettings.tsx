import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus } from 'lucide-react'
import React, { useEffect, useRef, useState } from 'react'

import { SECRETS_KEY, SECRETS_LIST_KEY, secretsAPI, type SecretSummary } from '../api/secrets'

import { ListPager } from './ListPager'
import {
    ALL_REPOSITORIES,
    AddSecretModal,
    BulkAddSecretsModal,
    DeleteSecretModal,
    type AddSecretInput,
    type BulkAddSecretsInput,
} from './SecretDialogs'
import { SecretsList } from './SecretsList'
import { blueButtonClass, outlineButtonClass } from './settingsStyles'
import { SettingsPage } from './SettingsUi'

import { SearchInput, matchesQuery } from '@/features/connections/components/ConnectionsUi'
import { profileAPI } from '@/features/profile/api/profile'
import { useConnectedRepos } from '@/features/profile/hooks/useConnectedRepos'
import { useSettingsTopBarAction } from '@/features/profile/lib/settingsTopBar'
import { listActionButtonClass } from '@/features/sessions/components/ListParts'
import { ErrorAlert } from '@/shared/components/ui/ErrorAlert'
import { isSkeletonPreviewActive } from '@/shared/lib/skeletonPreview'

const COPIED_MS = 2000

const errorText = (error: unknown, fallback: string) =>
    error instanceof Error && error.message ? error.message : fallback

export const ProfileSecretsSettings: React.FC = () => {
    const queryClient = useQueryClient()
    const {
        data,
        isLoading,
        error: loadError,
        refetch,
    } = useQuery({ queryKey: SECRETS_LIST_KEY, queryFn: secretsAPI.getSecrets })
    const secrets = React.useMemo(() => data?.secrets ?? [], [data])

    const { data: profile } = useQuery({ queryKey: ['profile'], queryFn: profileAPI.getProfile })
    const { repos } = useConnectedRepos({
        enabled: Boolean(profile),
        isGithubConnected: Boolean(profile?.githubAppInstall || profile?.githubConnected),
    })
    // the server keeps a repository in lower case: show the name as the git host writes it
    const repoLabel = React.useCallback(
        (repoFullName: string) =>
            repos.find((repo) => repo.fullName.toLowerCase() === repoFullName.toLowerCase())
                ?.fullName ?? repoFullName,
        [repos]
    )
    const useInOptions = React.useMemo(
        () => [
            { value: ALL_REPOSITORIES, label: 'All repositories' },
            ...repos.map((repo) => ({ value: repo.fullName, label: repo.fullName })),
        ],
        [repos]
    )

    const [searchQuery, setSearchQuery] = useState('')
    const [limit, setLimit] = useState(10)
    const [offset, setOffset] = useState(0)
    const [isAddOpen, setIsAddOpen] = useState(false)
    const [isBulkOpen, setIsBulkOpen] = useState(false)
    const [toDelete, setToDelete] = useState<SecretSummary | null>(null)
    const [error, setError] = useState<string | null>(null)

    // a shown value lives only in this page, and is gone when the row is hidden
    const [revealed, setRevealed] = useState<Record<string, string>>({})
    const [busyId, setBusyId] = useState<string | null>(null)
    const [copiedId, setCopiedId] = useState<string | null>(null)
    const copiedTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
    useEffect(
        () => () => {
            if (copiedTimer.current) clearTimeout(copiedTimer.current)
        },
        []
    )

    // phones: the + in the top bar opens the Add secret dialog
    useSettingsTopBarAction('Add secret', () => setIsAddOpen(true))

    // a save or a delete changes this list and the @secrets: list of the prompt box
    const refreshSecrets = () => queryClient.invalidateQueries({ queryKey: SECRETS_KEY })
    const forgetValue = (id: string) =>
        setRevealed((prev) => {
            if (!(id in prev)) return prev
            const next = { ...prev }
            delete next[id]
            return next
        })

    const createSecret = useMutation({
        mutationFn: (input: AddSecretInput) => secretsAPI.createSecret(input),
        onSuccess: () => {
            // the row may have a new value now: no old value stays on the screen
            setRevealed({})
            return refreshSecrets()
        },
    })
    const bulkCreate = useMutation({
        mutationFn: (input: BulkAddSecretsInput) => secretsAPI.bulkCreateSecrets(input),
        onSuccess: () => {
            setRevealed({})
            return refreshSecrets()
        },
    })
    const deleteSecret = useMutation({
        mutationFn: (secret: SecretSummary) =>
            secretsAPI.deleteSecret(secret.name, secret.repoFullName),
        onSuccess: (_result, secret) => {
            forgetValue(secret.id)
            queryClient.setQueryData<{ secrets: SecretSummary[] }>(SECRETS_LIST_KEY, (old) =>
                old ? { secrets: old.secrets.filter((row) => row.id !== secret.id) } : old
            )
            return refreshSecrets()
        },
    })

    const readValue = async (secret: SecretSummary): Promise<string | null> => {
        setBusyId(secret.id)
        try {
            const res = await secretsAPI.getSecretValue(secret.name, secret.repoFullName)
            return res.secret.value
        } catch (err) {
            setError(errorText(err, 'The value did not load. Try again.'))
            return null
        } finally {
            setBusyId(null)
        }
    }

    // a name can be there two times (all repositories and one repository), so the state of
    // a row is kept by its id and each call names the repository of the row
    const toggleReveal = async (secret: SecretSummary) => {
        if (busyId) return
        if (revealed[secret.id] !== undefined) {
            forgetValue(secret.id)
            return
        }
        const value = await readValue(secret)
        if (value !== null) setRevealed((prev) => ({ ...prev, [secret.id]: value }))
    }

    const copyValue = async (secret: SecretSummary) => {
        if (busyId) return
        const value = revealed[secret.id] ?? (await readValue(secret))
        if (value === null) return
        try {
            await navigator.clipboard.writeText(value)
        } catch (err) {
            // no clipboard (an http page, or the browser said no)
            setError(errorText(err, 'The value was not copied.'))
            return
        }
        setCopiedId(secret.id)
        if (copiedTimer.current) clearTimeout(copiedTimer.current)
        copiedTimer.current = setTimeout(() => setCopiedId(null), COPIED_MS)
    }

    const filtered = secrets.filter((secret) =>
        matchesQuery(
            searchQuery,
            secret.name,
            secret.note ?? undefined,
            secret.repoFullName ? repoLabel(secret.repoFullName) : 'All repositories'
        )
    )
    const total = filtered.length
    // after a delete or a search the page may be past the end: show the last page
    const lastPageOffset = Math.max(0, Math.floor((total - 1) / limit) * limit)
    const pageOffset = Math.min(offset, lastPageOffset)
    const pageRows = filtered.slice(pageOffset, pageOffset + limit)

    const showSkeleton = isLoading || isSkeletonPreviewActive()

    return (
        <SettingsPage
            title="Secrets"
            subtitle={
                <>
                    Use a secret in a session as <span className="text-[#87B2F4]">$NAME</span>.
                </>
            }
        >
            <ErrorAlert message={error} onClear={() => setError(null)} />

            <div className="flex flex-col gap-4">
                <div className="flex items-center justify-between gap-3">
                    <SearchInput
                        value={searchQuery}
                        onChange={(value) => {
                            setSearchQuery(value)
                            setOffset(0)
                        }}
                        placeholder="Search secrets"
                    />
                    {/* phones use the + in the top bar */}
                    <div className="hidden md:flex items-center gap-2">
                        <button
                            type="button"
                            onClick={() => setIsBulkOpen(true)}
                            className={outlineButtonClass}
                        >
                            Bulk add
                        </button>
                        <button
                            type="button"
                            onClick={() => setIsAddOpen(true)}
                            className={`${blueButtonClass} flex items-center gap-1.5 whitespace-nowrap`}
                        >
                            <Plus className="w-3.5 h-3.5" />
                            <span>Add secret</span>
                        </button>
                    </div>
                </div>

                <SecretsList
                    secrets={pageRows}
                    isLoading={showSkeleton}
                    loadError={
                        loadError && !data ? errorText(loadError, 'Secrets did not load') : null
                    }
                    emptyText={searchQuery.trim() ? 'No secrets match' : 'No secrets yet'}
                    emptyArt={searchQuery.trim() ? 'noResults' : 'secrets'}
                    emptyAction={
                        searchQuery.trim() ? undefined : (
                            <button
                                type="button"
                                onClick={() => setIsAddOpen(true)}
                                className={`bg-[#191919] ${listActionButtonClass}`}
                            >
                                Add secret
                            </button>
                        )
                    }
                    repoLabel={repoLabel}
                    onRetry={() => void refetch()}
                    revealed={revealed}
                    busyId={busyId}
                    copiedId={copiedId}
                    onToggleReveal={(secret) => void toggleReveal(secret)}
                    onCopy={(secret) => void copyValue(secret)}
                    onDelete={setToDelete}
                />

                {!showSkeleton && (
                    <ListPager
                        total={total}
                        limit={limit}
                        offset={pageOffset}
                        onLimitChange={(next) => {
                            setLimit(next)
                            setOffset(0)
                        }}
                        onOffsetChange={setOffset}
                    />
                )}
            </div>

            <AddSecretModal
                isOpen={isAddOpen}
                secrets={secrets}
                useInOptions={useInOptions}
                onClose={() => setIsAddOpen(false)}
                onSubmit={(input) => createSecret.mutateAsync(input)}
                onPasteEnv={() => {
                    setIsAddOpen(false)
                    setIsBulkOpen(true)
                }}
            />
            <BulkAddSecretsModal
                isOpen={isBulkOpen}
                useInOptions={useInOptions}
                onClose={() => setIsBulkOpen(false)}
                onSubmit={(input) => bulkCreate.mutateAsync(input)}
            />
            <DeleteSecretModal
                secret={toDelete}
                repoLabel={repoLabel}
                onClose={() => setToDelete(null)}
                onConfirm={(secret) => deleteSecret.mutateAsync(secret)}
            />
        </SettingsPage>
    )
}
