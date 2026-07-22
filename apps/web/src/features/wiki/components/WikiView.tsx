import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import React, { useState, useMemo } from 'react'

import { apiFetch } from '@/shared/api/client'
import { Icons } from '@/shared/components/ui/Icons'

export interface UserGitHubRepo {
    id: string
    name: string
    fullName: string
    owner: string
    isPrivate: boolean
    description: string | null
    status: 'IDLE' | 'GENERATING' | 'COMPLETED' | 'FAILED'
    wikiId?: string
}

export interface GitHubReposResponse {
    githubConnected: boolean
    repos: UserGitHubRepo[]
}

export interface WikiViewProps {
    onConnectGitHub?: () => void
    onOpenWiki?: (wikiId: string) => void
    initialData?: GitHubReposResponse
}

export const WikiView: React.FC<WikiViewProps> = ({ onConnectGitHub, onOpenWiki, initialData }) => {
    const queryClient = useQueryClient()
    const [searchQuery, setSearchQuery] = useState('')

    const { data, isLoading } = useQuery<GitHubReposResponse>({
        queryKey: ['wiki', 'github-repos'],
        queryFn: async () => {
            const res = await apiFetch('/wiki/github-repos')
            if (!res.ok) {
                throw new Error('Failed to fetch GitHub repositories')
            }
            return res.json()
        },
        initialData,
        enabled: !initialData,
    })

    const generateWikiMutation = useMutation({
        mutationFn: async ({ owner, name }: { owner: string; name: string }) => {
            const res = await apiFetch('/wiki/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ repoOwner: owner, repoName: name }),
            })
            if (!res.ok) {
                throw new Error('Failed to generate wiki')
            }
            return res.json()
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['wiki', 'github-repos'] })
        },
    })

    const filteredRepos = useMemo(() => {
        if (!data?.repos) return []
        if (!searchQuery.trim()) return data.repos
        const q = searchQuery.toLowerCase()
        return data.repos.filter(
            (repo) =>
                repo.name.toLowerCase().includes(q) ||
                repo.fullName.toLowerCase().includes(q) ||
                (repo.description && repo.description.toLowerCase().includes(q))
        )
    }, [data?.repos, searchQuery])

    if (isLoading && !data) {
        return (
            <div className="flex flex-col h-full bg-[#141414] text-gray-100 p-6 md:p-8 overflow-y-auto">
                <div className="max-w-6xl mx-auto w-full animate-pulse">
                    <div className="h-8 w-48 bg-[#222222] rounded mb-2" />
                    <div className="h-4 w-96 bg-[#1F1F1F] rounded mb-8" />
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="h-36 bg-[#1A1A1A] rounded-xl border border-[#262626]" />
                        <div className="h-36 bg-[#1A1A1A] rounded-xl border border-[#262626]" />
                    </div>
                </div>
            </div>
        )
    }

    if (data && !data.githubConnected) {
        return (
            <div className="flex items-center justify-center h-full bg-[#141414] text-gray-100 p-6 font-sans">
                <div className="max-w-md w-full bg-[#1A1A1A] border border-[#2A2A2A] rounded-2xl p-8 text-center shadow-2xl flex flex-col items-center">
                    <div className="w-16 h-16 rounded-full bg-[#252525] border border-[#333333] flex items-center justify-center mb-5 text-white shadow-inner">
                        <Icons.Globe className="w-8 h-8 text-[#E8E8E8]" />
                    </div>
                    <h2 className="text-xl font-semibold text-white tracking-tight mb-2">
                        Connect GitHub
                    </h2>
                    <p className="text-sm text-[#919191] leading-relaxed mb-6">
                        Link your GitHub account to discover repositories, automatically generate
                        AI-powered wikis, and search project documentation.
                    </p>
                    <button
                        onClick={() => {
                            if (onConnectGitHub) {
                                onConnectGitHub()
                            } else {
                                window.location.href = '/settings/integrations'
                            }
                        }}
                        className="w-full py-3 px-5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-medium text-sm transition-all shadow-lg shadow-blue-500/20 hover:shadow-blue-500/30 flex items-center justify-center gap-2 group cursor-pointer"
                    >
                        <span>Connect GitHub</span>
                        <Icons.ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                    </button>
                </div>
            </div>
        )
    }

    return (
        <div className="flex flex-col h-full bg-[#141414] text-gray-100 p-6 md:p-8 overflow-y-auto font-sans">
            <div className="max-w-6xl mx-auto w-full">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                    <div>
                        <div className="flex items-center gap-2.5 mb-1">
                            <div className="p-2 rounded-lg bg-[#1F1F1F] border border-[#2A2A2A] text-[#D6D5C9]">
                                <Icons.DocsBook className="w-5 h-5" />
                            </div>
                            <h1 className="text-2xl font-bold text-white tracking-tight">
                                Repository Wikis
                            </h1>
                        </div>
                        <p className="text-sm text-[#8F8E8D]">
                            Generate and explore AI documentation for your GitHub repositories
                        </p>
                    </div>

                    <div className="relative w-full md:w-72">
                        <Icons.Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#8F8E8D]" />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Search repositories..."
                            className="w-full pl-10 pr-4 py-2 bg-[#1A1A1A] border border-[#2A2A2A] rounded-xl text-sm text-white placeholder-[#616161] focus:outline-none focus:border-[#444444] transition-colors"
                        />
                    </div>
                </div>

                {filteredRepos.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {filteredRepos.map((repo) => (
                            <div
                                key={repo.id}
                                className="bg-[#1A1A1A] border border-[#282828] hover:border-[#383838] rounded-xl p-5 transition-all flex flex-col justify-between group hover:shadow-lg hover:shadow-black/40"
                            >
                                <div>
                                    <div className="flex items-start justify-between gap-2 mb-2">
                                        <h3 className="font-semibold text-base text-white group-hover:text-blue-400 transition-colors truncate">
                                            {repo.name}
                                        </h3>
                                        <span className="shrink-0 px-2 py-0.5 text-[11px] font-medium rounded-full bg-[#242424] text-[#A1A1AA] border border-[#333333]">
                                            {repo.isPrivate ? 'Private' : 'Public'}
                                        </span>
                                    </div>
                                    <p className="text-xs text-[#8F8E8D] line-clamp-2 leading-relaxed mb-4 min-h-[32px]">
                                        {repo.description || 'No description provided.'}
                                    </p>
                                </div>

                                <div className="flex items-center justify-between pt-3 border-t border-[#242424]">
                                    <span className="text-[11px] font-medium text-[#71717A]">
                                        {repo.fullName}
                                    </span>
                                    {repo.status === 'COMPLETED' ? (
                                        <button
                                            onClick={() => repo.wikiId && onOpenWiki?.(repo.wikiId)}
                                            className="px-3 py-1.5 rounded-lg bg-[#252525] hover:bg-[#303030] border border-[#383838] text-xs font-medium text-emerald-400 hover:text-emerald-300 transition-colors flex items-center gap-1.5 cursor-pointer"
                                        >
                                            <Icons.Check className="w-3.5 h-3.5" />
                                            <span>View Wiki</span>
                                        </button>
                                    ) : repo.status === 'GENERATING' ? (
                                        <button
                                            disabled
                                            className="px-3 py-1.5 rounded-lg bg-[#252525] border border-[#333333] text-xs font-medium text-amber-400 flex items-center gap-1.5 opacity-80"
                                        >
                                            <Icons.Sparkles className="w-3.5 h-3.5 animate-spin" />
                                            <span>Generating...</span>
                                        </button>
                                    ) : (
                                        <button
                                            onClick={() =>
                                                generateWikiMutation.mutate({
                                                    owner: repo.owner,
                                                    name: repo.name,
                                                })
                                            }
                                            disabled={generateWikiMutation.isPending}
                                            className="px-3 py-1.5 rounded-lg bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/30 text-xs font-medium text-blue-400 hover:text-blue-300 transition-colors flex items-center gap-1.5 cursor-pointer"
                                        >
                                            <Icons.Sparkles className="w-3.5 h-3.5" />
                                            <span>Generate Wiki</span>
                                        </button>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="bg-[#1A1A1A] border border-[#282828] rounded-xl p-12 text-center flex flex-col items-center">
                        <Icons.Search className="w-8 h-8 text-[#444444] mb-3" />
                        <h3 className="text-base font-medium text-white mb-1">
                            No repositories found
                        </h3>
                        <p className="text-xs text-[#8F8E8D]">
                            {searchQuery
                                ? `No repos matching "${searchQuery}"`
                                : 'No GitHub repositories available'}
                        </p>
                    </div>
                )}
            </div>
        </div>
    )
}
