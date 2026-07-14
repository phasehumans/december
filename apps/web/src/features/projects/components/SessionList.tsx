import React, { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { useSessions } from '../hooks/useSessions'

import { Icons } from '@/shared/components/ui/Icons'

export const SessionList: React.FC<{
    onNewProject: () => void
    onOpenProject: (id: string) => void
}> = ({ onNewProject, onOpenProject }) => {
    const { data: sessions = [], isLoading, isFetching, error } = useSessions()
    const navigate = useNavigate()
    const [searchQuery, setSearchQuery] = useState('')

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

    if (isLoading) {
        return <div className="p-8 text-neutral-400">Loading sessions...</div>
    }

    if (error) {
        return <div className="p-8 text-red-500">Failed to load sessions</div>
    }

    return (
        <div className="relative h-full w-full flex-1 overflow-y-auto bg-background px-8 pb-8 pt-20 font-sans no-scrollbar md:p-16">
            <div className="relative z-10 mx-auto max-w-6xl">
                <div className="mb-6 flex items-start justify-between gap-4">
                    <div className="flex flex-col">
                        <h1 className="text-[24px] font-medium text-[#D6D5C9] mb-1">Sessions</h1>
                        <p className="text-[13px] text-[#7B7A79]">
                            Manage and view all your active sessions and past agent workflows.
                        </p>
                    </div>
                </div>

                <div className="relative z-10 mb-6 flex w-full max-w-[480px] items-center">
                    <Icons.Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#7B7A79]" />
                    <input
                        type="text"
                        placeholder="Search sessions..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full rounded-lg border border-[#383736] bg-[#141414] py-1.5 pl-9 pr-4 text-[13px] text-[#D6D5C9] transition-colors placeholder:text-[#7B7A79] hover:bg-[#191919] focus:border-[#7B7A79] focus:bg-[#191919] focus:outline-none"
                    />
                </div>

                {filteredSessions.length === 0 ? (
                    <div className="text-[#7B7A79] py-8">No sessions found.</div>
                ) : (
                    <div className="flex flex-col gap-3">
                        {filteredSessions.map((session) => {
                            const date = new Date(session.updatedAt)
                            return (
                                <div
                                    key={session.id}
                                    className="flex items-center justify-between rounded-xl border border-[#242323]/50 bg-[#191919]/50 p-4 hover:border-[#383736] transition-colors cursor-pointer"
                                    onClick={() => {
                                        if (session.projectId) {
                                            onOpenProject(session.projectId)
                                        } else {
                                            // TODO: navigate to chat if we support chat-only sessions
                                            console.log('Open session', session.id)
                                        }
                                    }}
                                >
                                    <div className="flex flex-col gap-1">
                                        <div className="font-medium text-[#D6D5C9]">
                                            {session.title || 'Untitled Session'}
                                        </div>
                                        <div className="text-[13px] text-[#7B7A79] max-w-xl truncate">
                                            {session.lastMessage || 'No messages yet'}
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-6">
                                        {session.projectName && (
                                            <div className="text-[12px] px-2 py-1 bg-[#242323] text-[#7B7A79] rounded-md">
                                                {session.projectName}
                                            </div>
                                        )}
                                        <div className="text-[12px] px-2 py-1 bg-[#242323] text-[#7B7A79] rounded-md uppercase">
                                            {session.type}
                                        </div>
                                        <div className="text-[12px] text-[#7B7A79] min-w-[100px] text-right">
                                            {date.toLocaleDateString()}
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
