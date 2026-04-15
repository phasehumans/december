import React, { useState } from 'react'
import { motion } from 'framer-motion'
import { useQuery } from '@tanstack/react-query'

import { Icons } from '@/shared/components/ui/Icons'
import { profileAPI } from '@/features/profile/api/profile'

// Mock repos for when GitHub is connected
const MOCK_REPOS = [
    { name: 'my-portfolio', url: 'https://github.com/user/my-portfolio' },
    { name: 'ecommerce-app', url: 'https://github.com/user/ecommerce-app' },
    { name: 'blog-platform', url: 'https://github.com/user/blog-platform' },
    { name: 'weather-dashboard', url: 'https://github.com/user/weather-dashboard' },
    { name: 'task-manager', url: 'https://github.com/user/task-manager' },
]

interface GitHubRepoFormProps {
    onClose: () => void
    onSubmitRepo?: (repoUrl: string) => void
}

export const GitHubRepoForm: React.FC<GitHubRepoFormProps> = ({ onClose, onSubmitRepo }) => {
    const [selectedRepo, setSelectedRepo] = useState('')
    const [isDropdownOpen, setIsDropdownOpen] = useState(false)
    const [connectError, setConnectError] = useState<string | null>(null)

    // Fetch profile to check GitHub connection status
    const { data: profile, isLoading: isProfileLoading } = useQuery({
        queryKey: ['profile'],
        queryFn: profileAPI.getProfile,
    })

    const isGithubConnected = profile?.githubConnected ?? false

    const handleConnectGithub = () => {
        try {
            setConnectError(null)
            const url =
                `https://github.com/login/oauth/authorize` +
                `?client_id=Ov23liFGkTAwCW7E8gtk` +
                `&scope=repo` +
                `&state=${profile?.id}`

            window.location.href = url
        } catch {
            setConnectError('Failed to connect to GitHub. Please try again.')
        }
    }

    const handleSubmit = () => {
        if (selectedRepo.trim()) {
            onSubmitRepo?.(selectedRepo.trim())
        }
    }

    return (
        <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.98 }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
            className="w-full max-w-[638px] mt-3 rounded-[14px] bg-[#1A1918] border border-[#2E2D2C] overflow-hidden shadow-xl shadow-black/30"
        >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-[#2E2D2C]">
                <div className="flex items-center gap-2.5">
                    <Icons.Github className="w-[16px] h-[16px] text-[#A1A1AA]" />
                    <span className="text-[13px] font-medium text-[#D6D5D4]">
                        Import from GitHub
                    </span>
                </div>
                <button
                    onClick={onClose}
                    className="text-[#656565] hover:text-[#A1A1AA] transition-colors p-1 rounded-md hover:bg-white/5"
                >
                    <Icons.X className="w-[14px] h-[14px]" />
                </button>
            </div>

            {/* Body */}
            <div className="px-4 py-3.5">
                {isProfileLoading ? (
                    /* Loading State */
                    <div className="flex items-center justify-center py-6">
                        <div className="w-5 h-5 border-2 border-[#2E2D2C] border-t-[#656565] rounded-full animate-spin" />
                    </div>
                ) : !isGithubConnected ? (
                    /* Not Connected State — styled like upload drop zone */
                    <div
                        onClick={handleConnectGithub}
                        className="relative flex flex-col items-center justify-center gap-2.5 py-5 px-6 rounded-[12px] border-2 border-dashed border-[#2E2D2C] hover:border-[#454443] hover:bg-white/[0.015] cursor-pointer transition-all duration-200 ease-out"
                    >
                        <div className="w-9 h-9 rounded-full bg-[#252422] flex items-center justify-center">
                            <Icons.Github className="w-[17px] h-[17px] text-[#656565]" />
                        </div>
                        <div className="text-center">
                            <p className="text-[13px] font-medium text-[#D6D5D4] mb-0.5">
                                Connect your GitHub account
                            </p>
                            <p className="text-[12px] text-[#4A4A4A]">
                                Click to authorize and import your repositories
                            </p>
                        </div>

                        {connectError && (
                            <p className="text-[12px] text-red-400 mt-1">{connectError}</p>
                        )}
                    </div>
                ) : (
                    /* Connected State — show repo selector */
                    <div className="flex flex-col gap-3">
                        {/* Connected badge */}
                        <div className="flex items-center gap-2 px-1">
                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                            <span className="text-[12px] text-[#656565]">
                                Connected as{' '}
                                <span className="text-[#A1A1AA]">
                                    {profile?.githubUsername || 'user'}
                                </span>
                            </span>
                        </div>

                        {/* Repo Dropdown */}
                        <div className="relative">
                            <button
                                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                                className="w-full flex items-center justify-between bg-[#141312] border border-[#2E2D2C] hover:border-[#454443] rounded-[10px] h-[40px] px-3.5 text-[13px] transition-colors"
                            >
                                <div className="flex items-center gap-2.5">
                                    <Icons.Github className="w-[13px] h-[13px] text-[#4A4A4A]" />
                                    <span
                                        className={
                                            selectedRepo ? 'text-[#D6D5D4]' : 'text-[#4A4A4A]'
                                        }
                                    >
                                        {selectedRepo
                                            ? MOCK_REPOS.find((r) => r.url === selectedRepo)
                                                  ?.name || selectedRepo
                                            : 'Select a repository...'}
                                    </span>
                                </div>
                                <Icons.ChevronDown
                                    className={`w-3.5 h-3.5 text-[#656565] transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`}
                                />
                            </button>

                            {isDropdownOpen && (
                                <div className="absolute top-[calc(100%+4px)] left-0 right-0 bg-[#1A1918] border border-[#2E2D2C] rounded-[10px] overflow-hidden z-10 max-h-[160px] overflow-y-auto no-scrollbar shadow-xl">
                                    {MOCK_REPOS.map((repo) => (
                                        <button
                                            key={repo.url}
                                            onClick={() => {
                                                setSelectedRepo(repo.url)
                                                setIsDropdownOpen(false)
                                            }}
                                            className={`w-full flex items-center gap-2.5 px-3.5 py-2.5 text-left hover:bg-white/5 transition-colors ${selectedRepo === repo.url ? 'bg-white/[0.03]' : ''}`}
                                        >
                                            <Icons.Github className="w-[13px] h-[13px] text-[#4A4A4A] shrink-0" />
                                            <span className="text-[13px] text-[#D6D5D4] truncate">
                                                {repo.name}
                                            </span>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Submit */}
                        <button
                            onClick={handleSubmit}
                            disabled={!selectedRepo}
                            className="w-full h-[40px] rounded-[10px] bg-[#E5E5E5] hover:bg-white text-[#111] text-[13px] font-medium disabled:opacity-30 disabled:hover:bg-[#E5E5E5] transition-colors"
                        >
                            Import Repository
                        </button>
                    </div>
                )}
            </div>
        </motion.div>
    )
}
