import { GitBranch, Clock, Lock, Globe, Search, RotateCw, Plus } from 'lucide-react'
import React, { useState } from 'react'

import { ProfileRepositoriesSkeleton } from './ProfileSettingsSkeleton'
import { SettingsPageHeader } from './SettingsPageHeader'
import { blueButtonClass, boxSurfaceClass, outlineButtonClass } from './settingsStyles'

import { EmptyRow, ListBox } from '@/features/connections/components/ConnectionsUi'
import { type GithubRepo } from '@/features/profile/api/profile'
import { repoKey, useConnectedRepos } from '@/features/profile/hooks/useConnectedRepos'
import { useGitlabConnection } from '@/features/profile/hooks/useGitlabConnection'
import { Tooltip } from '@/shared/components/ui/Tooltip'
import { isSkeletonPreviewActive } from '@/shared/lib/skeletonPreview'

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

export const ProfileRepositoriesSettings: React.FC<ProfileRepositoriesSettingsProps> = ({
    isGithubConnected,
    onConnectGithub,
}) => {
    const [searchQuery, setSearchQuery] = useState('')

    const reposQuery = useConnectedRepos({ enabled: true, isGithubConnected })
    const gitlab = useGitlabConnection()

    const githubConnected = isGithubConnected || gitlab.isConnected
    const allRepos = reposQuery.repos

    const filteredRepos = allRepos.filter(
        (repo) =>
            repo.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
            (repo.description && repo.description.toLowerCase().includes(searchQuery.toLowerCase()))
    )

    return (
        <div className="flex flex-col w-full max-w-[772px] text-[#D6D5C9]">
            <div className="flex flex-col mb-0">
                <SettingsPageHeader
                    title="Repositories"
                    subtitle={
                        <>
                            Use a repository in a prompt as{' '}
                            <span className="text-[#87B2F4]">@repos:name</span>.
                        </>
                    }
                />

                <div className="flex flex-col gap-4">
                    {/* Top Control Bar */}
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                        <div className="relative w-full max-w-full sm:max-w-[340px]">
                            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#7B7A79]" />
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Search repositories..."
                                className="w-full pl-9 pr-3 py-1.5 bg-[#1F1F1F] border border-[#2A2A2A] rounded-lg text-[13px] text-[#D6D5C9] placeholder-[#7B7A79] focus:outline-none focus:border-[#5A5A5A] transition-colors"
                            />
                        </div>

                        <div className="flex items-center gap-2">
                            <Tooltip position="top" content="Refresh repositories">
                                <button
                                    onClick={() => reposQuery.refetch()}
                                    aria-label="Refresh repositories"
                                    className="p-2 rounded-lg border border-[#383736] hover:bg-[#242323] text-[#949494] hover:text-[#D6D5C9] transition-colors cursor-pointer"
                                >
                                    <RotateCw
                                        className={`w-3.5 h-3.5 ${reposQuery.isRefetching ? 'animate-spin text-[#87B2F4]' : ''}`}
                                    />
                                </button>
                            </Tooltip>
                            <button
                                onClick={onConnectGithub}
                                className={`${blueButtonClass} flex-1 sm:flex-initial flex items-center justify-center gap-1.5`}
                            >
                                <Plus className="w-3.5 h-3.5" />
                                <span>Connect GitHub</span>
                            </button>
                            {gitlab.isAvailable && !gitlab.isConnected && (
                                <button
                                    onClick={() => {
                                        window.location.href = gitlab.connectUrl()
                                    }}
                                    className={`${outlineButtonClass} flex-1 sm:flex-initial flex items-center justify-center gap-1.5`}
                                >
                                    <Plus className="w-3.5 h-3.5" />
                                    <span>Connect GitLab</span>
                                </button>
                            )}
                        </div>
                    </div>

                    {gitlab.connectError && (
                        <p role="alert" className="text-[12.5px] text-red-400">
                            {gitlab.connectError}
                        </p>
                    )}

                    {reposQuery.isLoading || isSkeletonPreviewActive() ? (
                        <ProfileRepositoriesSkeleton />
                    ) : !githubConnected ? (
                        // the empty box of every settings list: one line and one outline button
                        <ListBox>
                            <EmptyRow
                                action={
                                    <button
                                        type="button"
                                        onClick={onConnectGithub}
                                        className={outlineButtonClass}
                                    >
                                        Connect GitHub
                                    </button>
                                }
                            >
                                Connect GitHub to view all repositories
                            </EmptyRow>
                        </ListBox>
                    ) : reposQuery.isError ? (
                        <ListBox>
                            <EmptyRow
                                action={
                                    <button
                                        type="button"
                                        onClick={() => reposQuery.refetch()}
                                        className={outlineButtonClass}
                                    >
                                        Retry
                                    </button>
                                }
                            >
                                Failed to load repositories.
                            </EmptyRow>
                        </ListBox>
                    ) : allRepos.length === 0 ? (
                        <ListBox>
                            <EmptyRow>No repositories found on this account.</EmptyRow>
                        </ListBox>
                    ) : (
                        /* Repositories Grid View */
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                            {filteredRepos.map((repo: GithubRepo) => {
                                // a gitlab owner can hold subgroups (a/b), so read the fields
                                const name = repo.name
                                const owner = repo.owner?.login
                                return (
                                    <div
                                        key={repoKey(repo)}
                                        onClick={() => window.open(repo.htmlUrl, '_blank')}
                                        className={`group relative ${boxSurfaceClass} hover:bg-[#242424] p-3.5 transition-colors duration-200 flex flex-col justify-between min-h-[96px] cursor-pointer`}
                                    >
                                        {/* Card Header */}
                                        <div className="flex items-start justify-between gap-2">
                                            <div className="flex flex-col min-w-0">
                                                <span className="text-[13px] font-medium text-white truncate">
                                                    {name || repo.fullName}
                                                </span>
                                                <span className="text-[11.5px] text-[#8F8E8D] truncate">
                                                    {owner || repo.fullName}
                                                </span>
                                            </div>

                                            {/* Public / Private Badge */}
                                            {repo.private ? (
                                                <span className="flex items-center gap-1 px-1.5 py-0.5 rounded border border-[#383736] text-[10px] text-[#8F8E8D] shrink-0">
                                                    <Lock className="w-2.5 h-2.5" />
                                                    Private
                                                </span>
                                            ) : (
                                                <span className="flex items-center gap-1 px-1.5 py-0.5 rounded border border-[#383736] text-[10px] text-[#8F8E8D] shrink-0">
                                                    <Globe className="w-2.5 h-2.5" />
                                                    Public
                                                </span>
                                            )}
                                        </div>

                                        {/* Description */}
                                        {repo.description && (
                                            <p className="text-[12px] text-[#8F8E8D] line-clamp-2 leading-relaxed my-2">
                                                {repo.description}
                                            </p>
                                        )}

                                        {/* Meta Footer */}
                                        <div className="flex items-center gap-3.5 pt-1 text-[11px] text-[#8F8E8D] mt-auto">
                                            {repo.language && (
                                                <span className="flex items-center gap-1.5 truncate">
                                                    <span
                                                        className="w-2 h-2 rounded-full inline-block shrink-0"
                                                        style={{
                                                            backgroundColor:
                                                                languageColors[repo.language] ??
                                                                '#7B7A79',
                                                        }}
                                                    />
                                                    {repo.language}
                                                </span>
                                            )}
                                            <span className="flex items-center gap-1 shrink-0">
                                                <GitBranch className="w-3 h-3 text-[#8F8E8D]" />
                                                {repo.defaultBranch}
                                            </span>
                                            <span className="flex items-center gap-1 shrink-0">
                                                <Clock className="w-3 h-3 text-[#8F8E8D]" />
                                                {formatTimeAgo(repo.updatedAt)}
                                            </span>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
