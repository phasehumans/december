import { MoreHorizontal } from 'lucide-react'
import React from 'react'

import { useConnectionsNav } from '../hooks/useConnectionsNav'
import { useConnectionsStore } from '../hooks/useConnectionsStore'

import {
    BackLink,
    ConfirmModal,
    DetailHeader,
    EmptyRow,
    ListBox,
    ListHeader,
    ListRow,
    ListRows,
    MoreMenu,
    RowActions,
    SearchInput,
    SecondaryButton,
    Switch,
    formatShortDate,
    matchesQuery,
} from './ConnectionsUi'

import { cn } from '@/shared/lib/utils'

export const MemoryTab: React.FC<{ itemId?: string }> = ({ itemId }) => {
    if (itemId) return <MemoryNote itemId={itemId} />
    return <MemoryList />
}

const MemoryList: React.FC = () => {
    const { toItem } = useConnectionsNav()
    const memories = useConnectionsStore((s) => s.memories)
    const memoryEnabled = useConnectionsStore((s) => s.memoryEnabled)
    const setMemoryEnabled = useConnectionsStore((s) => s.setMemoryEnabled)
    const deleteMemory = useConnectionsStore((s) => s.deleteMemory)
    const deleteAllMemories = useConnectionsStore((s) => s.deleteAllMemories)
    const [query, setQuery] = React.useState('')
    const [deleting, setDeleting] = React.useState<string | null>(null)
    const [isDeletingAll, setIsDeletingAll] = React.useState(false)
    const [menuOpen, setMenuOpen] = React.useState(false)

    const filtered = memories.filter((m) => matchesQuery(query, m.title, m.body))
    const deletingNote = memories.find((m) => m.id === deleting)

    return (
        <div className="flex flex-col gap-4">
            <div className="flex items-center gap-2">
                {memories.length > 0 && (
                    <SearchInput value={query} onChange={setQuery} placeholder="Search memory" />
                )}
                <span className="flex-1" />
                <div className="relative shrink-0">
                    <button
                        type="button"
                        aria-label="Memory options"
                        onClick={() => setMenuOpen((v) => !v)}
                        className="p-2 rounded-lg border border-[#282828] bg-[#202020] hover:bg-[#282828] text-[#949494] hover:text-white transition-colors cursor-pointer"
                    >
                        <MoreHorizontal className="w-3.5 h-3.5" />
                    </button>
                    {menuOpen && (
                        <>
                            <div
                                className="fixed inset-0 z-40"
                                onClick={() => setMenuOpen(false)}
                            />
                            <div className="absolute right-0 top-full mt-1.5 z-50 w-40 bg-[#1C1C1C] border border-[#2B2A27] rounded-xl shadow-2xl p-1 flex flex-col gap-0.5 animate-in fade-in zoom-in-95 duration-100">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setMenuOpen(false)
                                        setMemoryEnabled(!memoryEnabled)
                                    }}
                                    className="w-full px-2.5 py-1.5 rounded-lg text-[12px] text-[#D6D5C9] hover:text-white hover:bg-[#282828] text-left cursor-pointer"
                                >
                                    {memoryEnabled ? 'Turn off memory' : 'Turn on memory'}
                                </button>
                                {memories.length > 0 && (
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setMenuOpen(false)
                                            setIsDeletingAll(true)
                                        }}
                                        className="w-full px-2.5 py-1.5 rounded-lg text-[12px] text-red-400 hover:text-red-300 hover:bg-red-500/10 text-left cursor-pointer"
                                    >
                                        Delete all
                                    </button>
                                )}
                            </div>
                        </>
                    )}
                </div>
            </div>

            {!memoryEnabled && (
                <ListBox>
                    <div className="flex items-center gap-3 px-3.5 md:px-4 py-3">
                        <span className="flex-1 text-[13px] text-[#D6D5C9]">Memory is off</span>
                        <Switch
                            checked={false}
                            label="Turn on memory"
                            onChange={setMemoryEnabled}
                        />
                    </div>
                </ListBox>
            )}

            <ListBox className={cn(!memoryEnabled && 'opacity-50')}>
                <ListHeader>
                    <span className="flex-1">Memory</span>
                    <span className="w-[160px]">From session</span>
                    <span className="w-[80px]">Saved</span>
                    <span className="w-[40px]" />
                </ListHeader>
                {memories.length === 0 ? (
                    <EmptyRow>No memories yet</EmptyRow>
                ) : filtered.length === 0 ? (
                    <EmptyRow>No results for "{query.trim()}"</EmptyRow>
                ) : (
                    <ListRows>
                        {filtered.map((note) => (
                            <ListRow key={note.id} onClick={() => toItem('memory', note.id)}>
                                <span className="flex-1 min-w-0 flex flex-col">
                                    <span className="text-[#D6D5C9] truncate">{note.title}</span>
                                    <span className="md:hidden text-[12px] text-[#7B7A79] truncate">
                                        {formatShortDate(note.savedAt)} · {note.session}
                                    </span>
                                </span>
                                <span className="hidden md:block w-[160px] truncate text-[12.5px] text-[#7B7A79]">
                                    {note.session}
                                </span>
                                <span className="hidden md:block w-[80px] text-[12.5px] text-[#7B7A79]">
                                    {formatShortDate(note.savedAt)}
                                </span>
                                <span className="md:w-[40px] flex justify-end">
                                    <RowActions
                                        noun="memory"
                                        onDelete={() => setDeleting(note.id)}
                                    />
                                    <MoreMenu
                                        mobileOnly
                                        label={`${note.title} options`}
                                        items={[
                                            {
                                                label: 'Delete',
                                                danger: true,
                                                onClick: () => setDeleting(note.id),
                                            },
                                        ]}
                                    />
                                </span>
                            </ListRow>
                        ))}
                    </ListRows>
                )}
            </ListBox>

            <ConfirmModal
                isOpen={Boolean(deletingNote)}
                title="Delete this memory?"
                body={deletingNote?.title}
                confirmLabel="Delete"
                onClose={() => setDeleting(null)}
                onConfirm={() => {
                    if (deleting) deleteMemory(deleting)
                    setDeleting(null)
                }}
            />
            <ConfirmModal
                isOpen={isDeletingAll}
                title={`Delete all ${memories.length} memories?`}
                confirmLabel="Delete all"
                onClose={() => setIsDeletingAll(false)}
                onConfirm={() => {
                    deleteAllMemories()
                    setIsDeletingAll(false)
                }}
            />
        </div>
    )
}

const MemoryNote: React.FC<{ itemId: string }> = ({ itemId }) => {
    const { toTab } = useConnectionsNav()
    const memories = useConnectionsStore((s) => s.memories)
    const deleteMemory = useConnectionsStore((s) => s.deleteMemory)
    const [isDeleting, setIsDeleting] = React.useState(false)
    const note = memories.find((m) => m.id === itemId)

    if (!note) {
        return (
            <div className="flex flex-col">
                <BackLink label="Memory" onClick={() => toTab('memory')} />
                <ListBox className="mt-4">
                    <EmptyRow>Memory not found</EmptyRow>
                </ListBox>
            </div>
        )
    }

    return (
        <div className="flex flex-col">
            <BackLink label="Memory" onClick={() => toTab('memory')} />
            <DetailHeader title={note.title}>
                <span className="flex-1" />
                <SecondaryButton onClick={() => setIsDeleting(true)}>Delete</SecondaryButton>
            </DetailHeader>
            <p className="-mt-3 mb-4 text-[12.5px] text-[#7B7A79]">
                Saved {formatShortDate(note.savedAt)}, from {note.session}
            </p>
            <div className="rounded-lg border border-[#2B2A27] bg-white/[0.03] px-3.5 py-2.5 text-[13px] text-[#D6D5C9] whitespace-pre-wrap leading-relaxed">
                {note.body}
            </div>
            <ConfirmModal
                isOpen={isDeleting}
                title="Delete this memory?"
                confirmLabel="Delete"
                onClose={() => setIsDeleting(false)}
                onConfirm={() => {
                    deleteMemory(note.id)
                    setIsDeleting(false)
                    toTab('memory')
                }}
            />
        </div>
    )
}
