import React, { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQueryClient, useMutation } from '@tanstack/react-query'

import { useSessions } from '../hooks/useSessions'
import { sessionAPI } from '../api/session'
import { SessionFilterPopover, type SessionFiltersState } from './SessionFilterPopover'

import { Icons } from '@/shared/components/ui/Icons'
import { Skeleton } from '@/shared/components/ui/Skeleton'

export const SessionList: React.FC<{
    onNewProject: () => void
    onOpenProject: (id: string) => void
}> = ({ onNewProject, onOpenProject }) => {
    const queryClient = useQueryClient()
    const [searchQuery, setSearchQuery] = useState('')
    const [filters, setFilters] = useState<SessionFiltersState>({})

    // Default sorting for UI
    const apiFilters = {
        ...filters,
        sortBy: 'updatedAt' as const,
        sortOrder: 'desc' as const,
    }

    const { data: sessions = [], isLoading, isFetching, error } = useSessions(apiFilters)

    const togglePinMutation = useMutation({
        mutationFn: ({ id, isPinned }: { id: string; isPinned: boolean }) =>
            sessionAPI.updateSessionSettings(id, { isPinned }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['sessions'] })
        },
    })

    const toggleArchiveMutation = useMutation({
        mutationFn: ({ id, isArchived }: { id: string; isArchived: boolean }) =>
            sessionAPI.updateSessionSettings(id, { isArchived }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['sessions'] })
        },
    })

    const filteredSessions = useMemo(() => {
        if (!searchQuery) return sessions
        const q = searchQuery.toLowerCase()
        return sessions.filter(
            (s) =>
                (s.title && s.title.toLowerCase().includes(q)) ||
                (s.projectName && s.projectName.toLowerCase().includes(q)) ||
                (s.lastMessage && s.lastMessage.toLowerCase().includes(q))
        )
    }, [sessions, searchQuery])

    if (error) {
        return (
            <div className="flex h-full items-center justify-center p-8">
                <div className="text-red-500 bg-red-500/10 px-4 py-2 rounded-lg border border-red-500/20">
                    Failed to load sessions. Please try again.
                </div>
            </div>
        )
    }

    return (
        <div className="relative h-full w-full flex-1 overflow-y-auto bg-[#0a0a0a] px-4 md:px-8 pb-8 pt-16 font-sans no-scrollbar">
            <div className="relative z-10 mx-auto max-w-[1000px]">
                {/* Header Section */}
                <div className="mb-8 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
                    <div className="flex flex-col gap-1">
                        <h1 className="text-3xl font-semibold tracking-tight text-white/95">
                            Sessions
                        </h1>
                        <p className="text-sm text-neutral-400">
                            Manage your active workspaces, terminal sessions, and AI searches.
                        </p>
                    </div>
                    <div className="flex items-center gap-3">
                        <button
                            onClick={onNewProject}
                            className="flex items-center gap-2 rounded-lg bg-white px-4 py-2 text-sm font-medium text-black transition-transform hover:scale-105 active:scale-95"
                        >
                            <Icons.Plus className="h-4 w-4" />
                            New Session
                        </button>
                    </div>
                </div>

                {/* Filters & Search Toolbar */}
                <div className="sticky top-0 z-40 mb-6 flex flex-col gap-3 md:flex-row md:items-center bg-[#0a0a0a]/80 py-2 backdrop-blur-xl">
                    <div className="relative flex-1 max-w-[400px]">
                        <Icons.Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-500" />
                        <input
                            type="text"
                            placeholder="Search sessions..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full rounded-full border border-neutral-800 bg-neutral-900/50 py-2 pl-9 pr-4 text-sm text-neutral-200 transition-all placeholder:text-neutral-500 hover:border-neutral-700 focus:border-neutral-500 focus:bg-neutral-900 focus:outline-none focus:ring-1 focus:ring-neutral-500"
                        />
                    </div>
                    <div className="flex items-center gap-2">
                        <SessionFilterPopover filters={filters} onFiltersChange={setFilters} />
                    </div>
                    {isFetching && !isLoading && (
                        <div className="ml-auto flex items-center gap-2 text-xs text-neutral-500">
                            <Icons.Loader className="h-3 w-3 animate-spin" />
                            Syncing...
                        </div>
                    )}
                </div>

                {/* Session List */}
                {isLoading ? (
                    <div className="flex flex-col gap-3">
                        {[1, 2, 3, 4, 5].map((i) => (
                            <div
                                key={i}
                                className="flex h-24 items-center gap-4 rounded-xl border border-neutral-800/50 bg-neutral-900/20 p-4"
                            >
                                <Skeleton className="h-10 w-10 rounded-lg bg-neutral-800/50" />
                                <div className="flex flex-col gap-2 flex-1">
                                    <Skeleton className="h-5 w-48 bg-neutral-800/50" />
                                    <Skeleton className="h-4 w-72 bg-neutral-800/50" />
                                </div>
                            </div>
                        ))}
                    </div>
                ) : filteredSessions.length === 0 ? (
                    <div className="flex min-h-[300px] flex-col items-center justify-center rounded-2xl border border-neutral-800/50 bg-neutral-900/10 text-center backdrop-blur-sm">
                        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-neutral-800/50 mb-4 text-neutral-400">
                            <Icons.Archive className="h-6 w-6" />
                        </div>
                        <h3 className="text-lg font-medium text-neutral-200">No sessions found</h3>
                        <p className="mt-1 text-sm text-neutral-500 max-w-sm">
                            Try adjusting your filters or search query to find what you're looking
                            for.
                        </p>
                        {Object.keys(filters).length > 0 && (
                            <button
                                onClick={() => setFilters({})}
                                className="mt-6 text-sm text-blue-400 hover:text-blue-300"
                            >
                                Clear all filters
                            </button>
                        )}
                    </div>
                ) : (
                    <div className="flex flex-col gap-3 pb-24">
                        {filteredSessions.map((session) => {
                            const date = new Date(session.updatedAt)

                            let TypeIcon = Icons.Robot
                            if (session.type === 'SEARCH') TypeIcon = Icons.Search
                            if (session.type === 'CLI') TypeIcon = Icons.Terminal

                            return (
                                <div
                                    key={session.id}
                                    className="group relative flex flex-col md:flex-row md:items-center justify-between rounded-xl border border-neutral-800/60 bg-neutral-900/40 p-4 hover:border-neutral-600 hover:bg-neutral-900/80 transition-all duration-200 cursor-pointer overflow-hidden"
                                    onClick={() => {
                                        if (session.projectId) {
                                            onOpenProject(session.projectId)
                                        } else {
                                            onOpenProject(session.id)
                                        }
                                    }}
                                >
                                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/[0.02] to-transparent -translate-x-[100%] group-hover:translate-x-[100%] transition-transform duration-700 pointer-events-none" />

                                    <div className="flex items-start md:items-center gap-4 flex-1 min-w-0">
                                        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-neutral-800/80 border border-neutral-700/50 text-neutral-300 shadow-sm">
                                            <TypeIcon className="h-5 w-5" />
                                        </div>
                                        <div className="flex flex-col gap-1 min-w-0 flex-1">
                                            <div className="flex items-center gap-2">
                                                <span className="font-medium text-neutral-200 truncate">
                                                    {session.title || 'Untitled Session'}
                                                </span>
                                                {session.isPinned && (
                                                    <Icons.Pin
                                                        className="h-3.5 w-3.5 text-yellow-500/80"
                                                        fill="currentColor"
                                                    />
                                                )}
                                                {session.isArchived && (
                                                    <span className="px-1.5 py-0.5 rounded text-[10px] uppercase font-bold bg-neutral-800 text-neutral-400 border border-neutral-700">
                                                        Archived
                                                    </span>
                                                )}
                                            </div>
                                            <div className="text-xs text-neutral-500 truncate max-w-[500px]">
                                                {session.lastMessage || 'No messages yet...'}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="mt-3 md:mt-0 flex items-center justify-between md:justify-end gap-4 text-sm w-full md:w-auto ml-14 md:ml-0">
                                        <div className="flex gap-2">
                                            <div className="px-2.5 py-1 text-[11px] font-medium bg-neutral-800/80 text-neutral-400 rounded-md uppercase tracking-wider border border-neutral-700/50">
                                                {session.type}
                                            </div>
                                            {session.projectName && (
                                                <div className="px-2.5 py-1 text-[11px] font-medium bg-blue-900/20 text-blue-400 rounded-md border border-blue-800/30 truncate max-w-[120px]">
                                                    {session.projectName}
                                                </div>
                                            )}
                                        </div>

                                        <div className="flex items-center gap-3">
                                            <span className="text-[12px] text-neutral-500 font-mono">
                                                {date.toLocaleDateString(undefined, {
                                                    month: 'short',
                                                    day: 'numeric',
                                                })}
                                            </span>

                                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation()
                                                        togglePinMutation.mutate({
                                                            id: session.id,
                                                            isPinned: !session.isPinned,
                                                        })
                                                    }}
                                                    className="p-1.5 rounded-md hover:bg-neutral-800 text-neutral-400 hover:text-white transition-colors"
                                                    title={
                                                        session.isPinned
                                                            ? 'Unpin session'
                                                            : 'Pin session'
                                                    }
                                                >
                                                    <Icons.Pin className="h-4 w-4" />
                                                </button>
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation()
                                                        toggleArchiveMutation.mutate({
                                                            id: session.id,
                                                            isArchived: !session.isArchived,
                                                        })
                                                    }}
                                                    className="p-1.5 rounded-md hover:bg-neutral-800 text-neutral-400 hover:text-white transition-colors"
                                                    title={
                                                        session.isArchived
                                                            ? 'Unarchive session'
                                                            : 'Archive session'
                                                    }
                                                >
                                                    <Icons.Archive className="h-4 w-4" />
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                )}
            </div>
        </div>
    )
}
