import React, { useState } from 'react'
import { Github, ExternalLink, GitBranch, Clock, Plus, ArrowRight } from 'lucide-react'

interface ProfileIntegrationsSettingsProps {
    isGithubConnected: boolean
    onConnectGithub: () => void
}

const mockRepos = [
    {
        name: 'web-app',
        fullName: 'december/web-app',
        description: 'Main web application frontend built with React and TypeScript.',
        language: 'TypeScript',
        languageColor: '#3178c6',
        branch: 'main',
        updatedAt: '2 hours ago',
        stars: 12,
    },
    {
        name: 'core-api',
        fullName: 'december/core-api',
        description: 'Backend API service powering the december platform.',
        language: 'TypeScript',
        languageColor: '#3178c6',
        branch: 'main',
        updatedAt: '5 hours ago',
        stars: 7,
    },
    {
        name: 'documentation',
        fullName: 'december/documentation',
        description: 'Official docs and guides for december developers.',
        language: 'MDX',
        languageColor: '#fcb32c',
        branch: 'main',
        updatedAt: '1 day ago',
        stars: 3,
    },
    {
        name: 'design-system',
        fullName: 'december/design-system',
        description: 'Shared component library and design tokens.',
        language: 'TypeScript',
        languageColor: '#3178c6',
        branch: 'develop',
        updatedAt: '2 days ago',
        stars: 5,
    },
    {
        name: 'cli-tools',
        fullName: 'december/cli-tools',
        description: 'Command-line utilities for the december workflow.',
        language: 'Go',
        languageColor: '#00ADD8',
        branch: 'main',
        updatedAt: '3 days ago',
        stars: 9,
    },
]

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

const integrations = [
    {
        id: 'github',
        name: 'GitHub',
        description: 'Connect your GitHub account to import repositories and track code changes.',
        Icon: Github,
        iconColor: '#D6D5C9',
        connectLabel: 'Connect',
        connectedLabel: 'Connected',
    },
    {
        id: 'vercel',
        name: 'Vercel',
        description: 'Deploy and manage your projects directly from december.',
        Icon: VercelIcon,
        iconColor: '#D6D5C9',
        connectLabel: 'Connect',
        connectedLabel: 'Connected',
    },
    {
        id: 'notion',
        name: 'Notion',
        description: 'Pull in pages and databases from Notion as project context.',
        Icon: NotionIcon,
        iconColor: '#D6D5C9',
        connectLabel: 'Connect',
        connectedLabel: 'Connected',
    },
    {
        id: 'stripe',
        name: 'Stripe',
        description: 'Monitor billing events and subscription data right in your workspace.',
        Icon: StripeIcon,
        iconColor: '#D6D5C9',
        connectLabel: 'Connect',
        connectedLabel: 'Connected',
    },
]

export const ProfileIntegrationsSettings: React.FC<ProfileIntegrationsSettingsProps> = ({
    isGithubConnected,
    onConnectGithub,
}) => {
    const [connected, setConnected] = useState<Record<string, boolean>>({
        github: isGithubConnected,
    })

    const toggle = (id: string) => {
        if (id === 'github') {
            onConnectGithub()
        }
        setConnected((prev) => ({ ...prev, [id]: !prev[id] }))
    }

    const githubConnected = connected['github']

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
                <div className="flex items-center justify-between mb-4">
                    <h1 className="text-[16px] font-medium">GitHub Repositories</h1>
                    {githubConnected && (
                        <a
                            href="#"
                            className="flex items-center gap-1.5 text-[13px] text-[#7B7A79] hover:text-[#D6D5C9] transition-colors"
                        >
                            View all on GitHub
                            <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                    )}
                </div>

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
                ) : (
                    <div className="flex flex-col border border-[#242323] rounded-xl overflow-hidden bg-[#100E12]">
                        {/* Header */}
                        <div className="flex items-center justify-between px-4 py-3 bg-[#171615] border-b border-[#242323]">
                            <span className="text-[12px] text-[#7B7A79] font-medium">
                                5 most recent repositories
                            </span>
                            <button className="flex items-center gap-1.5 px-3 py-1 rounded-lg border border-[#383736] text-[12px] text-[#D6D5C9] hover:bg-[#242323] transition-colors">
                                <Plus className="w-3 h-3" />
                                Import another
                            </button>
                        </div>

                        {/* Repo list */}
                        {mockRepos.map((repo, i) => (
                            <div
                                key={i}
                                className="flex items-center justify-between px-4 py-4 border-b border-[#242323] last:border-b-0 hover:bg-[#171615] transition-colors group"
                            >
                                <div className="flex flex-col gap-1.5 min-w-0">
                                    <div className="flex items-center gap-2">
                                        <span className="text-[14px] font-medium text-[#D6D5C9] truncate">
                                            {repo.fullName}
                                        </span>
                                    </div>
                                    {repo.description && (
                                        <span className="text-[12px] text-[#7B7A79] truncate max-w-[400px]">
                                            {repo.description}
                                        </span>
                                    )}
                                    <div className="flex items-center gap-4 mt-0.5">
                                        <span className="flex items-center gap-1.5 text-[12px] text-[#4A4948]">
                                            <span
                                                className="w-2 h-2 rounded-full inline-block"
                                                style={{ backgroundColor: repo.languageColor }}
                                            />
                                            {repo.language}
                                        </span>
                                        <span className="flex items-center gap-1 text-[12px] text-[#4A4948]">
                                            <GitBranch className="w-3 h-3" />
                                            {repo.branch}
                                        </span>
                                        <span className="flex items-center gap-1 text-[12px] text-[#4A4948]">
                                            <Clock className="w-3 h-3" />
                                            {repo.updatedAt}
                                        </span>
                                    </div>
                                </div>

                                <button className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg border border-[#383736] text-[13px] font-medium text-[#D6D5C9] hover:bg-[#242323] hover:border-[#4A4948] transition-all opacity-0 group-hover:opacity-100 shrink-0 ml-4">
                                    Import
                                    <ArrowRight className="w-3.5 h-3.5" />
                                </button>
                            </div>
                        ))}

                        {/* Footer CTA */}
                        <div className="px-4 py-4 bg-[#171615] border-t border-[#242323] flex items-center justify-between">
                            <span className="text-[13px] text-[#7B7A79]">
                                Import a repo to start collaborating with december on any codebase.
                            </span>
                            <button className="flex items-center gap-2 px-4 py-1.5 rounded-lg bg-[#242323] hover:bg-[#383736] border border-[#383736] text-[13px] font-medium text-[#D6D5C9] transition-colors shrink-0 ml-4">
                                Browse all repos
                                <ArrowRight className="w-3.5 h-3.5" />
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}
