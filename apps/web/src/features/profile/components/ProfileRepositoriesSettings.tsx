import { useQuery } from '@tanstack/react-query'
import { Github, GitBranch, Clock, ArrowRight, Lock, Globe } from 'lucide-react'
import React, { useState } from 'react'

import { profileAPI, type GithubRepo } from '@/features/profile/api/profile'
import { Skeleton } from '@/shared/components/ui/Skeleton'

interface ProfileRepositoriesSettingsProps {
    isGithubConnected: boolean
    onConnectGithub: () => void
}

const languageColors: Record<string, string> = {
    TypeScript: '#3178c6',
    JavaScript: '#f1e05a',
    Python: '#3572A5',
    Rust: '#dea584',
    Go: '#00ADD8',
    Java: '#b07219',
    Ruby: '#701516',
    PHP: '#4F5D95',
    'C#': '#178600',
    'C++': '#f34b7d',
    C: '#555555',
    Swift: '#F05138',
    Kotlin: '#A97BFF',
    Dart: '#00B4AB',
    HTML: '#e34c26',
    CSS: '#563d7c',
    Shell: '#89e051',
    Lua: '#000080',
    Vue: '#41b883',
    Svelte: '#ff3e00',
    MDX: '#fcb32c',
}

const formatTimeAgo = (dateString: string): string => {
    const now = new Date()
    const date = new Date(dateString)
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 1) return 'just now'
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    if (diffDays < 30) return `${diffDays}d ago`
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

const INITIAL_REPOS_COUNT = 5

export const ProfileRepositoriesSettings: React.FC<ProfileRepositoriesSettingsProps> = ({
    isGithubConnected,
    onConnectGithub,
}) => {
    const [showAllRepos, setShowAllRepos] = useState(false)

    const reposQuery = useQuery({
        queryKey: ['integrations', 'github', 'repos'],
        queryFn: profileAPI.getGithubRepos,
        enabled: isGithubConnected,
        staleTime: 5 * 60 * 1000,
    })

    const githubConnected = isGithubConnected
    const allRepos = reposQuery.data ?? []
    const displayedRepos = showAllRepos ? allRepos : allRepos.slice(0, INITIAL_REPOS_COUNT)
    const hasMoreRepos = allRepos.length > INITIAL_REPOS_COUNT

    return (
        <div className="flex flex-col w-full max-w-[720px] text-[#D6D5C9]">
            {/* GitHub Repositories */}
            <div className="flex flex-col mb-10">
                <h1 className="text-[16px] font-medium mb-4">GitHub Repositories</h1>

                {!githubConnected ? (
                    <div className="border border-dashed border-[#383736] rounded-xl py-16 flex flex-col items-center justify-center gap-4 bg-[#100E12]/30 hover:border-[#4A4948] transition-colors">
                        <div className="w-12 h-12 rounded-xl bg-[#191919] border border-[#383736] flex items-center justify-center">
                            <Github className="w-6 h-6 text-[#7B7A79]" />
                        </div>
                        <div className="flex flex-col items-center gap-1 text-center">
                            <span className="text-[14px] font-medium text-[#D6D5C9]">
                                Connect GitHub to see your repos
                            </span>
                            <span className="text-[13px] text-[#7B7A79] max-w-[320px]">
                                Import any repository to start working on it with december.
                            </span>
                        </div>
                        <button
                            onClick={onConnectGithub}
                            className="flex items-center gap-2 px-5 py-2 rounded-lg border border-[#383736] text-[13px] font-medium text-[#D6D5C9] hover:bg-[#191919] transition-colors mt-1"
                        >
                            <Github className="w-4 h-4" />
                            Connect GitHub
                        </button>
                    </div>
                ) : reposQuery.isLoading ? (
                    <div className="flex flex-col border border-[#2B2A29] rounded-xl overflow-hidden bg-[#131211]">
                        {/* Header skeleton */}
                        <div className="flex items-center px-5 py-3 bg-[#141414] border-b border-[#2B2A29]">
                            <Skeleton className="h-4.5 w-40 bg-white/[0.06] rounded" />
                        </div>
                        {/* Repo list skeleton */}
                        {Array.from({ length: INITIAL_REPOS_COUNT }).map((_, i) => (
                            <div
                                key={i}
                                className="flex items-center justify-between px-5 py-4 border-b border-[#191919] last:border-b-0"
                            >
                                <div className="flex flex-col gap-2 min-w-0 flex-1">
                                    <div className="flex items-center gap-2">
                                        <Skeleton className="h-4.5 w-44 bg-white/[0.06] rounded" />
                                        <Skeleton className="h-4.5 w-16 bg-white/[0.04] rounded" />
                                    </div>
                                    <Skeleton className="h-3.5 w-[75%] bg-white/[0.04] mt-0.5 rounded" />
                                    <div className="flex items-center gap-3.5 mt-1.5">
                                        <Skeleton className="h-3 w-16 bg-white/[0.04] rounded" />
                                        <Skeleton className="h-3 w-14 bg-white/[0.04] rounded" />
                                        <Skeleton className="h-3 w-20 bg-white/[0.04] rounded" />
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : reposQuery.isError ? (
                    <div className="border border-[#242323] rounded-xl py-16 flex flex-col items-center justify-center gap-3 bg-[#131211]">
                        <span className="text-[13px] text-red-400">
                            Failed to load repositories.
                        </span>
                        <button
                            onClick={() => reposQuery.refetch()}
                            className="px-4 py-1.5 rounded-lg border border-[#383736] text-[13px] text-[#D6D5C9] hover:bg-[#242323] transition-colors"
                        >
                            Retry
                        </button>
                    </div>
                ) : allRepos.length === 0 ? (
                    <div className="border border-[#242323] rounded-xl py-16 flex flex-col items-center justify-center gap-3 bg-[#131211]">
                        <Github className="w-6 h-6 text-[#4A4948]" />
                        <span className="text-[13px] text-[#7B7A79]">
                            No repositories found on this account.
                        </span>
                    </div>
                ) : (
                    <div className="flex flex-col border border-[#2B2A29] rounded-xl overflow-hidden bg-[#131211]">
                        {/* Header */}
                        <div className="flex items-center px-5 py-3 bg-[#141414] border-b border-[#2B2A29]">
                            <span className="text-[12px] text-[#7B7A79] font-medium">
                                {showAllRepos
                                    ? `All repositories · ${allRepos.length}`
                                    : `Recent · ${Math.min(INITIAL_REPOS_COUNT, allRepos.length)} of ${allRepos.length}`}
                            </span>
                        </div>

                        {/* Repo list */}
                        {displayedRepos.map((repo: GithubRepo) => (
                            <div
                                key={repo.id}
                                className="flex items-center justify-between px-5 py-3.5 border-b border-[#191919] last:border-b-0 hover:bg-[#1A1918] transition-colors group"
                            >
                                <div className="flex flex-col gap-1 min-w-0 flex-1">
                                    <div className="flex items-center gap-2">
                                        <span className="text-[13.5px] font-medium truncate">
                                            <span className="text-[#7B7A79]">
                                                {repo.fullName.split('/')[0]}/
                                            </span>
                                            <span className="text-[#D6D5C9]">
                                                {repo.fullName.split('/')[1]}
                                            </span>
                                        </span>
                                        {repo.private ? (
                                            <span className="flex items-center gap-1 px-1.5 py-0.5 rounded border border-[#2B2A29] text-[10px] text-[#4A4948]">
                                                <Lock className="w-2.5 h-2.5" />
                                                Private
                                            </span>
                                        ) : (
                                            <span className="flex items-center gap-1 px-1.5 py-0.5 rounded border border-[#2B2A29] text-[10px] text-[#4A4948]">
                                                <Globe className="w-2.5 h-2.5" />
                                                Public
                                            </span>
                                        )}
                                    </div>
                                    {repo.description && (
                                        <span className="text-[12px] text-[#5A5958] truncate max-w-[420px]">
                                            {repo.description}
                                        </span>
                                    )}
                                    <div className="flex items-center gap-3.5 mt-0.5">
                                        {repo.language && (
                                            <span className="flex items-center gap-1.5 text-[11px] text-[#5A5958]">
                                                <span
                                                    className="w-[7px] h-[7px] rounded-full inline-block"
                                                    style={{
                                                        backgroundColor:
                                                            languageColors[repo.language] ??
                                                            '#7B7A79',
                                                    }}
                                                />
                                                {repo.language}
                                            </span>
                                        )}
                                        <span className="flex items-center gap-1 text-[11px] text-[#5A5958]">
                                            <GitBranch className="w-3 h-3" />
                                            {repo.defaultBranch}
                                        </span>
                                        <span className="flex items-center gap-1 text-[11px] text-[#5A5958]">
                                            <Clock className="w-3 h-3" />
                                            {formatTimeAgo(repo.updatedAt)}
                                        </span>
                                    </div>
                                </div>

                                <button className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg border border-[#383736] text-[12px] font-medium text-[#D6D5C9] hover:bg-[#242323] hover:border-[#4A4948] transition-all opacity-0 group-hover:opacity-100 shrink-0 ml-4">
                                    Import
                                    <ArrowRight className="w-3 h-3" />
                                </button>
                            </div>
                        ))}

                        {/* Footer - Browse all repos */}
                        {hasMoreRepos && (
                            <div className="px-5 py-3.5 bg-[#141414] border-t border-[#2B2A29] flex items-center justify-between">
                                <span className="text-[12px] text-[#5A5958]">
                                    {showAllRepos
                                        ? `Showing all ${allRepos.length} repositories`
                                        : `${allRepos.length - INITIAL_REPOS_COUNT} more available`}
                                </span>
                                <button
                                    onClick={() => setShowAllRepos(!showAllRepos)}
                                    className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg border border-[#383736] text-[12px] font-medium text-[#D6D5C9] hover:bg-[#242323] transition-colors shrink-0"
                                >
                                    {showAllRepos ? 'Show less' : 'Browse all repos'}
                                    <ArrowRight
                                        className={`w-3 h-3 transition-transform ${showAllRepos ? '-rotate-90' : ''}`}
                                    />
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    )
}
