import React, { useState } from 'react'
import { Github, GitBranch, Clock, ArrowRight, Loader2, Lock, Globe } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'

import { profileAPI, type GithubRepo } from '@/features/profile/api/profile'

interface ProfileIntegrationsSettingsProps {
    isGithubConnected: boolean
    onConnectGithub: () => void
}

// Simple SVG icons for services not in lucide-react
const VercelIcon = () => (
    <svg viewBox="0 0 76 65" fill="currentColor" className="w-5 h-5">
        <path d="M37.5274 0L75.0548 65H0L37.5274 0Z" />
    </svg>
)

const NotionIcon = () => (
    <svg viewBox="0 0 100 100" fill="currentColor" className="w-5 h-5">
        <path d="M6.017 4.313l55.333-4.087c6.797-.583 8.543-.19 12.817 2.917l17.663 12.443c2.913 2.14 3.883 2.723 3.883 5.053v68.243c0 4.277-1.553 6.807-6.99 7.193L24.467 99.967c-4.08.193-6.023-.39-8.16-3.113L3.3 79.94c-2.333-3.113-3.3-5.443-3.3-8.167V10.89c0-3.497 1.553-6.413 6.017-6.577z" />
    </svg>
)

const StripeIcon = () => (
    <svg viewBox="0 0 28 28" fill="currentColor" className="w-5 h-5">
        <path
            fillRule="evenodd"
            clipRule="evenodd"
            d="M2 0C.9 0 0 .9 0 2v24c0 1.1.9 2 2 2h24c1.1 0 2-.9 2-2V2c0-1.1-.9-2-2-2H2zm9.4 17.7l.6-3.6c.8.4 2.1.8 3.3.8 1.4 0 2.1-.5 2.1-1.3 0-.7-.5-1.1-2.1-1.6-2.4-.8-4-2-4-4.2 0-2.5 2.2-4.3 5.5-4.3 1.5 0 2.7.3 3.5.7l-.6 3.5c-.6-.3-1.7-.7-2.9-.7-1.3 0-1.9.5-1.9 1.2 0 .7.6 1 2.3 1.6 2.5.9 3.9 2.1 3.9 4.2 0 2.5-2 4.4-5.8 4.4-1.6 0-3.2-.4-3.9-.7z"
        />
    </svg>
)

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

const integrations = [
    {
        id: 'github',
        name: 'GitHub',
        description: 'Connect your GitHub account to import repositories and track code changes.',
        Icon: Github,
        iconColor: '#D6D5C9',
    },
    {
        id: 'vercel',
        name: 'Vercel',
        description: 'Deploy and manage your projects directly from december.',
        Icon: VercelIcon,
        iconColor: '#D6D5C9',
    },
    {
        id: 'notion',
        name: 'Notion',
        description: 'Pull in pages and databases from Notion as project context.',
        Icon: NotionIcon,
        iconColor: '#D6D5C9',
    },
    {
        id: 'stripe',
        name: 'Stripe',
        description: 'Monitor billing events and subscription data right in your workspace.',
        Icon: StripeIcon,
        iconColor: '#D6D5C9',
    },
]

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

export const ProfileIntegrationsSettings: React.FC<ProfileIntegrationsSettingsProps> = ({
    isGithubConnected,
    onConnectGithub,
}) => {
    const [connected, setConnected] = useState<Record<string, boolean>>({
        github: isGithubConnected,
    })
    const [showAllRepos, setShowAllRepos] = useState(false)

    const reposQuery = useQuery({
        queryKey: ['integrations', 'github', 'repos'],
        queryFn: profileAPI.getGithubRepos,
        enabled: isGithubConnected,
        staleTime: 5 * 60 * 1000,
    })

    const toggle = (id: string) => {
        if (id === 'github') {
            onConnectGithub()
        }
        setConnected((prev) => ({ ...prev, [id]: !prev[id] }))
    }

    const githubConnected = connected['github']
    const allRepos = reposQuery.data ?? []
    const displayedRepos = showAllRepos ? allRepos : allRepos.slice(0, INITIAL_REPOS_COUNT)
    const hasMoreRepos = allRepos.length > INITIAL_REPOS_COUNT

    return (
        <div className="flex flex-col w-full max-w-[720px] text-[#D6D5C9]">
            {/* Integrations */}
            <div className="flex flex-col mb-10">
                <h1 className="text-[16px] font-medium mb-4">Integrations</h1>
                <div className="flex flex-col gap-5 border-t border-[#242323] pt-6">
                    {integrations.map(({ id, name, description, Icon, iconColor }) => {
                        const isConnected = !!connected[id]
                        return (
                            <div key={id} className="flex items-center justify-between">
                                <div className="flex items-center gap-4">
                                    <div
                                        className="w-10 h-10 rounded-lg bg-[#1E1D1B] border border-[#383736] flex items-center justify-center shrink-0"
                                        style={{ color: iconColor }}
                                    >
                                        <Icon />
                                    </div>
                                    <div className="flex flex-col gap-0.5">
                                        <span className="text-[14px] font-medium text-[#D6D5C9]">
                                            {name}
                                        </span>
                                        <span className="text-[13px] text-[#7B7A79] max-w-[380px]">
                                            {description}
                                        </span>
                                    </div>
                                </div>
                                <button
                                    onClick={() => toggle(id)}
                                    className={`px-4 py-1.5 rounded-lg border text-[13px] font-medium transition-all shrink-0 ${
                                        isConnected
                                            ? 'border-[#383736] bg-[#1E1D1B] text-[#7B7A79] hover:text-[#D6D5C9]'
                                            : 'border-[#383736] text-[#D6D5C9] hover:bg-[#1E1D1B]'
                                    }`}
                                >
                                    {isConnected ? 'Disconnect' : 'Connect'}
                                </button>
                            </div>
                        )
                    })}
                </div>
            </div>

            {/* GitHub Repositories */}
            <div className="flex flex-col mb-10">
                <h1 className="text-[16px] font-medium mb-4">GitHub Repositories</h1>

                {!githubConnected ? (
                    <div className="border border-dashed border-[#383736] rounded-xl py-16 flex flex-col items-center justify-center gap-4 bg-[#100E12]/30 hover:border-[#4A4948] transition-colors">
                        <div className="w-12 h-12 rounded-xl bg-[#1E1D1B] border border-[#383736] flex items-center justify-center">
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
                            onClick={() => toggle('github')}
                            className="flex items-center gap-2 px-5 py-2 rounded-lg border border-[#383736] text-[13px] font-medium text-[#D6D5C9] hover:bg-[#1E1D1B] transition-colors mt-1"
                        >
                            <Github className="w-4 h-4" />
                            Connect GitHub
                        </button>
                    </div>
                ) : reposQuery.isLoading ? (
                    <div className="border border-[#242323] rounded-xl py-16 flex flex-col items-center justify-center gap-3 bg-[#131211]">
                        <Loader2 className="w-5 h-5 text-[#7B7A79] animate-spin" />
                        <span className="text-[13px] text-[#7B7A79]">
                            Fetching your repositories...
                        </span>
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
                        <div className="flex items-center px-5 py-3 bg-[#171615] border-b border-[#2B2A29]">
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
                                className="flex items-center justify-between px-5 py-3.5 border-b border-[#1E1D1B] last:border-b-0 hover:bg-[#1A1918] transition-colors group"
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
                            <div className="px-5 py-3.5 bg-[#171615] border-t border-[#2B2A29] flex items-center justify-between">
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
