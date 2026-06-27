import { useQuery } from '@tanstack/react-query'
import { Github, GitBranch, Clock, ArrowRight, Lock, Globe } from 'lucide-react'
import React, { useState } from 'react'

import { profileAPI, type GithubRepo } from '@/features/profile/api/profile'
import { Skeleton } from '@/shared/components/ui/Skeleton'

type IntegrationId =
    | 'github'
    | 'vercel'
    | 'supabase'
    | 'notion'
    | 'figma'
    | 'railway'
    | 'render'
    | 'mongodb'
    | 'razorpay'
    | 'framer'
    | 'spline'

interface ProfileIntegrationsSettingsProps {
    isGithubConnected: boolean
    isVercelConnected: boolean
    isSupabaseConnected: boolean
    isNotionConnected: boolean
    onConnectGithub: () => void
    onConnectVercel: () => void
    onConnectSupabase: () => void
    onConnectNotion: () => void
}

// Simple SVG icons for services not in lucide-react
const GithubIcon = () => (
    <svg viewBox="0 0 24 24" fill="white" className="w-5 h-5">
        <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
    </svg>
)

const VercelIcon = () => (
    <svg viewBox="0 0 76 65" fill="white" className="w-5 h-5">
        <path d="M37.5274 0L75.0548 65H0L37.5274 0Z" />
    </svg>
)

const NotionIcon = () => (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
        <path d="M4.46 4.21c.75.6 1.03.56 2.43.46L20.1 3.88c.28 0 .05-.28-.04-.33L17.86 1.97c-.42-.33-.98-.7-2.05-.61L3.01 2.3c-.47.04-.56.28-.37.47zm.79 3.08v13.9c0 .75.37 1.03 1.21.98l14.53-.84c.84-.04.93-.56.93-1.17V6.35c0-.6-.23-.93-.75-.89l-15.17.89c-.56.04-.75.33-.75.93zm14.34.74c.09.42 0 .84-.42.89l-.7.14v10.26c-.61.33-1.17.52-1.64.52-.75 0-.93-.23-1.5-.93l-4.57-7.19v6.95l1.45-.19s0 .84-1.17.84l-3.22.19c-.09-.19 0-.66.33-.75l.84-.23V9.85l-1.45-.1c-.09-.42.14-1.03.79-1.07l3.46-.23 4.76 7.28v-6.44l-1.21-.14c-.1-.51.27-.89.74-.93zM1.94 1.04l13.3-.98c1.64-.14 2.06-.05 3.08.7l4.25 2.99c.7.51.94.65.94 1.21v16.38c0 1.03-.37 1.63-1.68 1.73l-15.46.93c-.98.05-1.45-.09-1.96-.75L1.28 17.5c-.56-.75-.79-1.3-.79-1.96V2.67c0-.84.37-1.54 1.45-1.63z" />
    </svg>
)

const SupabaseIcon = () => (
    <svg viewBox="0 0 24 24" fill="#3ECF8E" className="w-5 h-5">
        <path d="M11.9 1.036c-.015-.986-1.26-1.41-1.874-.637L.764 12.05C-.33 13.427.65 15.455 2.409 15.455h9.579l.113 7.51c.014.985 1.259 1.408 1.873.636l9.262-11.653c1.093-1.375.113-3.403-1.645-3.403h-9.642z" />
    </svg>
)

const FigmaIcon = () => (
    <svg viewBox="0 0 38 57" fill="none" className="w-5 h-5">
        <path
            d="M19 28.5C19 33.7467 14.7467 38 9.5 38C4.25329 38 0 33.7467 0 28.5C0 23.2533 4.25329 19 9.5 19H19V28.5Z"
            fill="#A259FF"
        />
        <path
            d="M9.5 0H19V19H9.5C4.25329 19 0 14.7467 0 9.5C0 4.2533 4.25329 0 9.5 0Z"
            fill="#F24E1E"
        />
        <path
            d="M28.5 0H19V19H28.5C33.7467 19 38 14.7467 38 9.5C38 4.2533 33.7467 0 28.5 0Z"
            fill="#FF7262"
        />
        <path
            d="M38 28.5C38 33.7467 33.7467 38 28.5 38C23.2533 38 19 33.7467 19 28.5C19 23.2533 23.2533 19 28.5 19C33.7467 19 38 23.2533 38 28.5Z"
            fill="#1ABCFE"
        />
        <path
            d="M9.5 57C14.7467 57 19 52.7467 19 47.5V38H9.5C4.25329 38 0 42.2533 0 47.5C0 52.7467 4.25329 57 9.5 57Z"
            fill="#0ACF83"
        />
    </svg>
)

const RailwayIcon = () => (
    <svg viewBox="0 0 512 512" fill="currentColor" className="w-5 h-5 text-white">
        <path d="M375.7 64h-239.4c-22.6 0-41.2 18.2-41.7 40.8-.8 33.7-.8 268.6 0 302.3.6 22.7 19.1 40.9 41.7 40.9h239.4c22.6 0 41.2-18.2 41.7-40.8.8-33.7.8-268.6 0-302.3-.5-22.7-19-40.9-41.7-40.9zm-192.1 63.9h144.9v56.5H183.6v-56.5zm0 110.1h144.9v56.5H183.6v-56.5zm0 110h144.9v56.5H183.6v-56.5z" />
    </svg>
)

const RenderIcon = () => (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 text-[#46E3B7]">
        <path d="M12 1L21 6V18L12 23L3 18V6L12 1ZM12 4.1L6.1 7.4V14.1L12 17.4L17.9 14.1V7.4L12 4.1Z" />
    </svg>
)

const MongodbIcon = () => (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 text-[#47A248]">
        <path d="M17.14 8.24c.05-1.1-.38-2.31-1.32-3.64C14.7 3.01 13.04 1 12 1s-2.7 2.01-3.82 3.6c-.94 1.33-1.37 2.54-1.32 3.64.09 1.7.97 4.1 3.52 7.02l.74.83v2.81s-.01 1.05.88 1.1c.9 0 .88-1.1.88-1.1v-2.81l.74-.83c2.55-2.92 3.43-5.32 3.52-7.02z" />
    </svg>
)

const RazorpayIcon = () => (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 text-[#0274EB]">
        <path d="M2.047 18.064h4.482l3.414-12.128h-4.482L2.047 18.064zm15.422-5.462c1.787 0 2.923-1.077 3.257-2.981.282-1.635-.455-3.04-2.123-3.04h-7.142l-3.328 11.483h4.44l1.328-4.582h3.568zm-2.097-2.611c-.083.564-.595.961-1.229.961h-2.203l.551-1.921h2.158c.456 0 .807.396.723.96z" />
    </svg>
)

const FramerIcon = () => (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 text-white">
        <path d="M4 2h16v8h-8l8 8H12v6l-8-8h8l-8-8V2z" />
    </svg>
)

const SplineIcon = () => (
    <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        className="w-5 h-5 text-[#FF3366]"
    >
        <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
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
        id: 'github' as const,
        name: 'GitHub',
        description: 'Connect your GitHub account to import repositories and track code changes.',
        Icon: GithubIcon,
        iconColor: '#D6D5C9',
    },
    {
        id: 'vercel' as const,
        name: 'Vercel',
        description: 'Deploy and manage your projects directly from december.',
        Icon: VercelIcon,
        iconColor: '#D6D5C9',
    },
    {
        id: 'supabase' as const,
        name: 'Supabase',
        description: 'Connect your Supabase project to manage database schemas and tables.',
        Icon: SupabaseIcon,
        iconColor: '#D6D5C9',
    },
    {
        id: 'notion' as const,
        name: 'Notion',
        description: 'Pull in pages and databases from Notion as project context.',
        Icon: NotionIcon,
        iconColor: '#D6D5C9',
    },
    {
        id: 'figma' as const,
        name: 'Figma',
        description: 'Import styles, components, and design tokens directly from your Figma files.',
        Icon: FigmaIcon,
        iconColor: '#D6D5C9',
    },
    {
        id: 'railway' as const,
        name: 'Railway',
        description: 'Deploy backend services, databases, and microservices instantly on Railway.',
        Icon: RailwayIcon,
        iconColor: '#D6D5C9',
    },
    {
        id: 'render' as const,
        name: 'Render',
        description:
            'Host your cloud infrastructure, static sites, and cron jobs seamlessly with Render.',
        Icon: RenderIcon,
        iconColor: '#D6D5C9',
    },
    {
        id: 'mongodb' as const,
        name: 'MongoDB',
        description:
            'Connect your MongoDB Atlas clusters to inspect and manage your cloud databases.',
        Icon: MongodbIcon,
        iconColor: '#D6D5C9',
    },
    {
        id: 'razorpay' as const,
        name: 'Razorpay',
        description:
            'Integrate payment gateways, subscriptions, and webhooks effortlessly with Razorpay.',
        Icon: RazorpayIcon,
        iconColor: '#D6D5C9',
    },
    {
        id: 'framer' as const,
        name: 'Framer',
        description:
            'Export motion animations, interactive prototypes, and production-ready components.',
        Icon: FramerIcon,
        iconColor: '#D6D5C9',
    },
    {
        id: 'spline' as const,
        name: 'Spline',
        description:
            'Embed interactive 3D scenes, immersive animations, and real-time 3D web assets.',
        Icon: SplineIcon,
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
    isVercelConnected,
    isSupabaseConnected,
    isNotionConnected,
    onConnectVercel,
    onConnectSupabase,
    onConnectNotion,
}) => {
    const [showAllRepos, setShowAllRepos] = useState(false)

    const reposQuery = useQuery({
        queryKey: ['integrations', 'github', 'repos'],
        queryFn: profileAPI.getGithubRepos,
        enabled: isGithubConnected,
        staleTime: 5 * 60 * 1000,
    })

    const getIntegrationState = (id: IntegrationId) => {
        if (id === 'github') {
            return { isConnected: isGithubConnected, onConnect: onConnectGithub }
        }

        if (id === 'vercel') {
            return { isConnected: isVercelConnected, onConnect: onConnectVercel }
        }

        if (id === 'supabase') {
            return { isConnected: isSupabaseConnected, onConnect: onConnectSupabase }
        }

        if (id === 'notion') {
            return { isConnected: isNotionConnected, onConnect: onConnectNotion }
        }

        return { isConnected: false, onConnect: undefined }
    }

    const githubConnected = isGithubConnected
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
                        const { isConnected, onConnect } = getIntegrationState(id)
                        const isUnavailable = !onConnect
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
                                    onClick={onConnect}
                                    disabled={isConnected || isUnavailable}
                                    className={`px-4 py-1.5 rounded-lg border text-[13px] font-medium transition-all shrink-0 ${
                                        isConnected
                                            ? 'border-[#383736] bg-[#1E1D1B] text-[#6A6968] cursor-default'
                                            : isUnavailable
                                              ? 'border-[#2B2A29] text-[#4A4948] cursor-not-allowed'
                                              : 'border-[#383736] text-[#D6D5C9] hover:bg-[#1E1D1B]'
                                    }`}
                                >
                                    {isConnected ? 'Connected' : isUnavailable ? 'Soon' : 'Connect'}
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
                            onClick={onConnectGithub}
                            className="flex items-center gap-2 px-5 py-2 rounded-lg border border-[#383736] text-[13px] font-medium text-[#D6D5C9] hover:bg-[#1E1D1B] transition-colors mt-1"
                        >
                            <Github className="w-4 h-4" />
                            Connect GitHub
                        </button>
                    </div>
                ) : reposQuery.isLoading ? (
                    <div className="flex flex-col border border-[#2B2A29] rounded-xl overflow-hidden bg-[#131211]">
                        {/* Header skeleton */}
                        <div className="flex items-center px-5 py-3 bg-[#171615] border-b border-[#2B2A29]">
                            <Skeleton className="h-4.5 w-40 bg-white/[0.06] rounded" />
                        </div>
                        {/* Repo list skeleton */}
                        {Array.from({ length: INITIAL_REPOS_COUNT }).map((_, i) => (
                            <div
                                key={i}
                                className="flex items-center justify-between px-5 py-4 border-b border-[#1E1D1B] last:border-b-0"
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
