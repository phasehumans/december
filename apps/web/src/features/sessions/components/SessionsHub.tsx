import React, { useState } from 'react'

export const SessionsHub: React.FC = () => {
    const [searchQuery, setSearchQuery] = useState('')
    const [filterArchived, setFilterArchived] = useState(false)

    // placeholder data
    const sessions = [
        {
            id: '1',
            title: 'React Dashboard',
            tags: ['frontend'],
            isArchived: false,
            status: 'RUNNING',
        },
        { id: '2', title: 'Node API', tags: ['backend'], isArchived: false, status: 'STOPPED' },
        {
            id: '3',
            title: 'Legacy Python Script',
            tags: ['python'],
            isArchived: true,
            status: 'STOPPED',
        },
    ]

    const filteredSessions = sessions.filter((s) => {
        const matchesQuery =
            s.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
            s.tags.some((t) => t.toLowerCase().includes(searchQuery.toLowerCase()))
        const matchesArchive = filterArchived ? true : !s.isArchived
        return matchesQuery && matchesArchive
    })

    return (
        <div className="flex flex-col h-full bg-gray-50 text-gray-900 p-8 max-w-7xl mx-auto w-full">
            <h1 className="text-3xl font-bold mb-8 tracking-tight">Sessions Hub</h1>

            <div className="flex items-center space-x-4 mb-8">
                <input
                    type="text"
                    className="flex-1 bg-white border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none transition-shadow"
                    placeholder="Search sessions or tags..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                />
                <label className="flex items-center space-x-2 text-sm font-medium cursor-pointer">
                    <input
                        type="checkbox"
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        checked={filterArchived}
                        onChange={(e) => setFilterArchived(e.target.checked)}
                    />
                    <span>Show Archived</span>
                </label>
                <button className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-6 rounded-lg transition-colors shadow-sm">
                    New Session
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredSessions.map((session) => (
                    <div
                        key={session.id}
                        className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow cursor-pointer group"
                    >
                        <div className="flex justify-between items-start mb-4">
                            <h3 className="font-semibold text-lg text-gray-900 group-hover:text-blue-600 transition-colors">
                                {session.title}
                            </h3>
                            <span
                                className={`px-2 py-1 rounded text-xs font-medium ${session.status === 'RUNNING' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}
                            >
                                {session.status}
                            </span>
                        </div>
                        <div className="flex flex-wrap gap-2 mb-4">
                            {session.tags.map((tag) => (
                                <span
                                    key={tag}
                                    className="px-2 py-1 bg-blue-50 text-blue-700 rounded-md text-xs font-medium"
                                >
                                    {tag}
                                </span>
                            ))}
                            {session.isArchived && (
                                <span className="px-2 py-1 bg-amber-50 text-amber-700 rounded-md text-xs font-medium">
                                    Archived
                                </span>
                            )}
                        </div>
                        <div className="text-sm text-gray-500 mt-4 flex items-center justify-between">
                            <span>Edited 2 hours ago</span>
                            <button className="text-gray-400 hover:text-gray-600">
                                <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    className="h-5 w-5"
                                    viewBox="0 0 20 20"
                                    fill="currentColor"
                                >
                                    <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
                                </svg>
                            </button>
                        </div>
                    </div>
                ))}
            </div>
            {filteredSessions.length === 0 && (
                <div className="text-center py-20 text-gray-500">
                    <p className="text-lg">No sessions found.</p>
                    <p className="text-sm mt-2">Try adjusting your filters or search query.</p>
                </div>
            )}
        </div>
    )
}
