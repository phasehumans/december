import { MEMORIES_PER_USER_MAX, MEMORY_MAX_CHARS } from '@december/shared/agent-context'
import React from 'react'

import { useMemories } from '../hooks/useAccountContext'
import { connectionErrorMessage } from '../hooks/useConnectionsData'
import { useConnectionsNav } from '../hooks/useConnectionsNav'

import {
    ConfirmModal,
    EmptyRow,
    FormError,
    ListBox,
    ListHeader,
    ListRow,
    ListRows,
    ListSkeleton,
    ModalActions,
    MoreMenu,
    PrimaryButton,
    RowActions,
    SearchInput,
    SecondaryButton,
    Switch,
    fieldLabelClass,
    formatShortDate,
    matchesQuery,
    textareaClass,
} from './ConnectionsUi'

import type { ApiMemory } from '../api/memory'

import { sectionBoxClass } from '@/features/profile/components/settingsStyles'
import { SettingsRow } from '@/features/profile/components/SettingsUi'
import { Modal } from '@/shared/components/ui/Modal'
import { cn } from '@/shared/lib/utils'

/** where a memory came from: the session that saved it, or the user */
const sourceLabel = (memory: ApiMemory) =>
    memory.source === 'user' ? 'You' : memory.sessionTitle || 'A session'

export const MemoryTab: React.FC = () => {
    const { addParam, openAdd, closeAdd } = useConnectionsNav()
    const {
        enabled,
        memories,
        isLoading,
        loadFailed,
        retry,
        setEnabled,
        addMemory,
        updateMemory,
        deleteMemory,
        deleteAll,
    } = useMemories()
    const [query, setQuery] = React.useState('')
    const [editing, setEditing] = React.useState<ApiMemory | null>(null)
    const [deleting, setDeleting] = React.useState<ApiMemory | null>(null)
    const [isDeletingAll, setIsDeletingAll] = React.useState(false)
    const [actionError, setActionError] = React.useState<string | null>(null)

    /** runs a change. a change the server refuses shows above the list */
    const run = (change: Promise<unknown>, fallback: string) => {
        setActionError(null)
        change.catch((error) => setActionError(connectionErrorMessage(error, fallback)))
    }

    const filtered = memories.filter((memory) =>
        matchesQuery(query, memory.content, memory.sessionTitle ?? undefined)
    )
    const isFull = memories.length >= MEMORIES_PER_USER_MAX

    return (
        <div className="flex flex-col gap-4">
            <div className={sectionBoxClass}>
                <SettingsRow label="Use memory in cloud sessions">
                    <Switch
                        checked={enabled}
                        disabled={isLoading || loadFailed}
                        label="Use memory"
                        onChange={(on) => run(setEnabled(on), 'Could not change memory')}
                    />
                </SettingsRow>
            </div>

            {memories.length > 0 && (
                <div className="flex items-center gap-2">
                    <SearchInput value={query} onChange={setQuery} placeholder="Search memory" />
                    <span className="hidden md:block flex-1" />
                    <PrimaryButton onClick={() => openAdd()}>Add memory</PrimaryButton>
                    <MoreMenu
                        label="Memory options"
                        items={[
                            {
                                label: 'Delete all',
                                danger: true,
                                onClick: () => setIsDeletingAll(true),
                            },
                        ]}
                    />
                </div>
            )}
            <FormError>{actionError}</FormError>

            <ListBox className={cn(!enabled && !isLoading && memories.length > 0 && 'opacity-60')}>
                <ListHeader>
                    <span className="flex-1">Memory</span>
                    <span className="w-[150px]">From</span>
                    <span className="w-[64px]">Saved</span>
                    <span className="w-[56px] text-right">
                        {memories.length > 0 && `${memories.length} / ${MEMORIES_PER_USER_MAX}`}
                    </span>
                </ListHeader>
                {isLoading ? (
                    <ListSkeleton />
                ) : loadFailed ? (
                    <EmptyRow
                        action={
                            <SecondaryButton onClick={() => retry()}>Try again</SecondaryButton>
                        }
                    >
                        Could not load memory
                    </EmptyRow>
                ) : memories.length === 0 ? (
                    <EmptyRow
                        action={
                            <SecondaryButton onClick={() => openAdd()}>Add memory</SecondaryButton>
                        }
                    >
                        No memories yet
                    </EmptyRow>
                ) : filtered.length === 0 ? (
                    <EmptyRow>No results for "{query.trim()}"</EmptyRow>
                ) : (
                    <ListRows>
                        {filtered.map((memory) => (
                            <ListRow key={memory.id} onClick={() => setEditing(memory)}>
                                <span className="flex-1 min-w-0 flex flex-col">
                                    <span className="text-[#D6D5C9] truncate">
                                        {memory.content}
                                    </span>
                                    <span className="md:hidden text-[12px] text-[#7B7A79] truncate">
                                        {formatShortDate(memory.updatedAt)} · {sourceLabel(memory)}
                                    </span>
                                </span>
                                <span className="hidden md:block w-[150px] truncate text-[12.5px] text-[#7B7A79]">
                                    {sourceLabel(memory)}
                                </span>
                                <span className="hidden md:block w-[64px] text-[12.5px] text-[#7B7A79]">
                                    {formatShortDate(memory.updatedAt)}
                                </span>
                                <span className="md:w-[56px] flex justify-end">
                                    <RowActions
                                        noun="memory"
                                        onEdit={() => setEditing(memory)}
                                        onDelete={() => setDeleting(memory)}
                                    />
                                    <MoreMenu
                                        mobileOnly
                                        label="Memory row options"
                                        items={[
                                            { label: 'Edit', onClick: () => setEditing(memory) },
                                            {
                                                label: 'Delete',
                                                danger: true,
                                                onClick: () => setDeleting(memory),
                                            },
                                        ]}
                                    />
                                </span>
                            </ListRow>
                        ))}
                    </ListRows>
                )}
            </ListBox>

            {(addParam !== null || editing) && (
                <MemoryForm
                    existing={editing}
                    isFull={isFull}
                    onClose={() => {
                        setEditing(null)
                        closeAdd()
                    }}
                    onSave={(content) =>
                        editing ? updateMemory(editing.id, content) : addMemory(content)
                    }
                />
            )}
            <ConfirmModal
                isOpen={deleting !== null}
                title="Delete this memory?"
                body={deleting?.content}
                confirmLabel="Delete"
                onClose={() => setDeleting(null)}
                onConfirm={() => {
                    if (deleting) run(deleteMemory(deleting.id), 'Could not delete the memory')
                    setDeleting(null)
                }}
            />
            <ConfirmModal
                isOpen={isDeletingAll}
                title={`Delete all ${memories.length} memories?`}
                body="The agent forgets what it saved. You cannot undo this."
                confirmLabel="Delete all"
                onClose={() => setIsDeletingAll(false)}
                onConfirm={() => {
                    run(deleteAll(), 'Could not delete the memories')
                    setIsDeletingAll(false)
                }}
            />
        </div>
    )
}

const MemoryForm: React.FC<{
    existing: ApiMemory | null
    isFull: boolean
    onClose: () => void
    onSave: (content: string) => Promise<unknown>
}> = ({ existing, isFull, onClose, onSave }) => {
    const [content, setContent] = React.useState(existing?.content ?? '')
    const [isSaving, setIsSaving] = React.useState(false)
    const [error, setError] = React.useState<string | null>(null)

    const text = content.trim()
    const isOver = text.length > MEMORY_MAX_CHARS
    const unchanged = Boolean(existing && text === existing.content)
    const blockedFull = !existing && isFull

    const submit = async () => {
        if (!text || isOver || unchanged || blockedFull || isSaving) return
        setError(null)
        setIsSaving(true)
        try {
            await onSave(text)
            onClose()
        } catch (failure) {
            setError(connectionErrorMessage(failure, 'Could not save the memory'))
            setIsSaving(false)
        }
    }

    return (
        <Modal
            isOpen
            onClose={onClose}
            title={existing ? 'Edit memory' : 'Add memory'}
            description="One short fact the agent keeps across sessions."
            variant="premium"
            showLogo={false}
            maxWidth="max-w-[460px]"
            sheetOnPhone
        >
            <form
                onSubmit={(e) => {
                    // the modal is portaled, so stop the submit reaching a form behind it
                    e.preventDefault()
                    e.stopPropagation()
                    void submit()
                }}
                className="flex flex-col gap-4"
            >
                <div className="flex flex-col gap-1.5">
                    <div className="flex items-center justify-between">
                        <label htmlFor="memory-content" className={fieldLabelClass}>
                            Memory
                        </label>
                        <span
                            className={cn(
                                'text-[12px] font-medium',
                                isOver ? 'text-red-500' : 'text-[#7B7A79]'
                            )}
                        >
                            {text.length} / {MEMORY_MAX_CHARS}
                        </span>
                    </div>
                    <textarea
                        id="memory-content"
                        autoFocus
                        rows={4}
                        value={content}
                        placeholder="Prefers bun over npm"
                        onChange={(e) => setContent(e.target.value)}
                        className={cn(textareaClass, 'font-sans')}
                    />
                    {blockedFull && (
                        <FormError>
                            {`You can keep up to ${MEMORIES_PER_USER_MAX} memories. Delete one first.`}
                        </FormError>
                    )}
                    <FormError>{error}</FormError>
                </div>
                <ModalActions
                    onCancel={onClose}
                    submitLabel={existing ? 'Save' : 'Add memory'}
                    submitDisabled={!text || isOver || unchanged || blockedFull}
                    isPending={isSaving}
                />
            </form>
        </Modal>
    )
}
