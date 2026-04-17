import React, { useState } from 'react'
import { motion } from 'framer-motion'
import { useQuery } from '@tanstack/react-query'

import { Icons } from '@/shared/components/ui/Icons'
import { profileAPI } from '@/features/profile/api/profile'

interface GitHubRepoFormProps {
    onClose: () => void
    onSubmitRepo?: (repoUrl: string) => void
}

export const GitHubRepoForm: React.FC<GitHubRepoFormProps> = ({ onClose, onSubmitRepo }) => {
    const [selectedRepo, setSelectedRepo] = useState('')
    const [connectError, setConnectError] = useState<string | null>(null)

    // Fetch quickInfo to check GitHub connection status
    const { data: quickInfo, isLoading: isQuickInfoLoading } = useQuery({
        queryKey: ['quickinfo'],
        queryFn: profileAPI.getQuickInfo,
    })

    // Profile for github auth state ID
    const { data: profile } = useQuery({
        queryKey: ['profile'],
        queryFn: profileAPI.getProfile,
    })

    const isGithubConnected = profile?.githubConnected || (quickInfo?.githubConnected ?? false)

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
            className="w-full max-w-[638px] mt-3 rounded-[14px] bg-[#171615] border border-[#242322]"
        >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-2.5 bg-[#242322] rounded-t-[13px]">
                <div className="flex items-center gap-2.5">
                    <Icons.Github className="w-[16px] h-[16px] text-[#989796]" />
                    <span className="text-[13px] font-medium text-[#989796]">
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
                {isQuickInfoLoading ? (
                    /* Loading State */
                    <div className="flex items-center justify-center py-6">
                        <div className="w-5 h-5 border-2 border-[#2E2D2C] border-t-[#656565] rounded-full animate-spin" />
                    </div>
                ) : !isGithubConnected ? (
                    /* Not Connected State — styled like upload drop zone */
                    <div
                        onClick={handleConnectGithub}
                        className="relative flex flex-col items-center justify-center gap-2.5 px-6 rounded-[12px] border-2 border-dashed border-[#2E2D2C] hover:border-[#454443] hover:bg-white/[0.015] cursor-pointer transition-all duration-200 ease-out h-[160px]"
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
                    /* Connected State — Manual Repo Input */
                    <div className="relative flex flex-col justify-center px-6 rounded-[12px] border-2 border-dashed border-[#2E2D2C] h-[160px]">
                        <div className="flex items-center gap-2">
                            <div className="relative flex-1">
                                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                                    <Icons.Github className="w-[14px] h-[14px] text-[#656565]" />
                                </div>
                                <input
                                    type="text"
                                    value={selectedRepo}
                                    onChange={(e) => setSelectedRepo(e.target.value)}
                                    placeholder="https://github.com/user/repo"
                                    className="w-full bg-[#141312] border border-[#2E2D2C] focus:border-[#454443] rounded-[10px] h-[40px] pl-9 pr-3.5 text-[13px] text-[#D6D5D4] placeholder-[#4A4A4A] outline-none transition-colors"
                                />
                            </div>
                            {/* Submit */}
                            <button
                                onClick={handleSubmit}
                                disabled={!selectedRepo}
                                className="h-[40px] px-5 rounded-[10px] bg-[#D6D5D4] hover:bg-[#EAE9E8] text-[#111] text-[13px] font-medium disabled:opacity-40 disabled:pointer-events-none transition-colors duration-200 shrink-0"
                            >
                                Import
                            </button>
                        </div>
                        <p className="text-[12px] text-[#656565] mt-3 ml-1">
                            Enter the URL of your repository or any public GitHub repository.
                        </p>
                    </div>
                )}
            </div>
        </motion.div>
    )
}
