import React, { useState, useRef } from 'react'

import { Icons } from '@/shared/components/ui/Icons'

interface SessionPrTooltipProps {
    session: {
        id: string
        title?: string | null
        prNumber?: number | null
        prState?: string | null
        prTitle?: string | null
        prUrl?: string | null
        branchName?: string | null
        additions?: number | null
        deletions?: number | null
        repoName?: string | null
    }
}

export const SessionPrTooltip: React.FC<SessionPrTooltipProps> = ({ session }) => {
    const [isOpen, setIsOpen] = useState(false)
    const [copied, setCopied] = useState(false)
    const [hoveredIcon, setHoveredIcon] = useState<'copy' | 'github' | null>(null)

    const timeoutRef = useRef<NodeJS.Timeout | null>(null)

    if (!session.prNumber) return null

    const handleMouseEnter = () => {
        if (timeoutRef.current) clearTimeout(timeoutRef.current)
        setIsOpen(true)
    }

    const handleMouseLeave = () => {
        timeoutRef.current = setTimeout(() => {
            setIsOpen(false)
            setHoveredIcon(null)
        }, 150)
    }

    const handleCopyBranch = (e: React.MouseEvent) => {
        e.stopPropagation()
        e.preventDefault()
        const branch =
            session.branchName ||
            (session.title
                ? session.title.toLowerCase().replace(/[^a-z0-9]+/g, '-')
                : `feature/pr-${session.prNumber}`)
        navigator.clipboard.writeText(branch)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
    }

    const handleOpenGithub = (e: React.MouseEvent) => {
        e.stopPropagation()
        e.preventDefault()
        const url =
            session.prUrl || `https://github.com/december-ai/december/pull/${session.prNumber}`
        window.open(url, '_blank', 'noopener,noreferrer')
    }

    const prTitle = session.prTitle || session.title || `feat: PR #${session.prNumber}`
    const repoName = session.repoName || 'december'
    const shortRepo = repoName.length > 6 ? `...${repoName.slice(-3)}` : repoName
    const additions = session.additions ?? 220
    const deletions = session.deletions ?? 82
    const branchName =
        session.branchName ||
        (session.title
            ? session.title.toLowerCase().replace(/[^a-z0-9]+/g, '-')
            : 'devin-ai-integration/restyle-tui')

    return (
        <div
            className="relative inline-flex items-center"
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
            onClick={(e) => e.stopPropagation()}
        >
            {/* PR Status Badge */}
            <span className="flex items-center gap-1 rounded-md bg-[#202020] hover:bg-[#272727] transition-colors px-2 py-0.5 text-[11px] font-medium text-purple-400 cursor-pointer select-none">
                <Icons.GitPullRequest className="h-3 w-3" />#{session.prNumber}
            </span>

            {/* Compact Tooltip Card (#1E1E1E Background, Reduced Vertical Spacing) */}
            {isOpen && (
                <div
                    className="absolute left-0 top-full mt-1 z-50 flex w-[280px] flex-col rounded-xl border border-[#2F2F2F] bg-[#1E1E1E] px-2.5 py-1.5 shadow-2xl animate-in fade-in zoom-in-95 duration-150"
                    onMouseEnter={handleMouseEnter}
                    onMouseLeave={handleMouseLeave}
                    onClick={(e) => e.stopPropagation()}
                >
                    {/* Top Row: PR Title + Action Icons (Copy & GitHub) */}
                    <div className="flex items-center justify-between gap-1.5">
                        <span
                            className="truncate text-[12.5px] font-medium text-[#E1E1E1] max-w-[185px] leading-snug"
                            title={prTitle}
                        >
                            {prTitle}
                        </span>

                        {/* Action Icons Pill Capsule */}
                        <div className="flex items-center gap-0.5 shrink-0 relative bg-[#262626]/90 border border-[#333333] rounded-md p-0.5">
                            {/* Floating Tooltip for Icons */}
                            {hoveredIcon && (
                                <div className="absolute bottom-full mb-1.5 left-1/2 -translate-x-1/2 pointer-events-none z-50">
                                    <div className="rounded-md bg-[#181818] border border-[#333333] px-2 py-0.5 text-[10.5px] font-medium text-[#FFFFFF] shadow-xl whitespace-nowrap">
                                        {hoveredIcon === 'copy'
                                            ? copied
                                                ? 'Copied!'
                                                : 'Copy branch name'
                                            : 'Open in GitHub'}
                                    </div>
                                </div>
                            )}

                            {/* Copy Branch Icon */}
                            <button
                                onClick={handleCopyBranch}
                                onMouseEnter={() => setHoveredIcon('copy')}
                                onMouseLeave={() => setHoveredIcon(null)}
                                className={`flex h-5 w-5 items-center justify-center rounded text-[#999999] transition-colors hover:bg-[#333333] hover:text-[#FFFFFF] ${
                                    copied ? 'bg-[#333333] text-emerald-400' : ''
                                }`}
                                aria-label="Copy branch name"
                            >
                                {copied ? (
                                    <Icons.Check className="h-3 w-3 text-emerald-400" />
                                ) : (
                                    <Icons.Copy className="h-3 w-3" />
                                )}
                            </button>

                            {/* Open in GitHub Icon */}
                            <button
                                onClick={handleOpenGithub}
                                onMouseEnter={() => setHoveredIcon('github')}
                                onMouseLeave={() => setHoveredIcon(null)}
                                className="flex h-5 w-5 items-center justify-center rounded text-[#999999] transition-colors hover:bg-[#333333] hover:text-[#FFFFFF]"
                                aria-label="Open in GitHub"
                            >
                                <Icons.Github className="h-3 w-3" />
                            </button>
                        </div>
                    </div>

                    {/* Bottom Row: Git PR Icon + Repo/PR Ref + Additions/Deletions + Branch (Reduced Vertical Space) */}
                    <div className="mt-0.5 flex items-center gap-1 text-[11px] leading-tight pt-0.5">
                        <Icons.GitPullRequest className="h-3 w-3 text-[#A855F7] shrink-0" />
                        <span className="truncate text-[#999999] font-normal">
                            ...{shortRepo}#{session.prNumber}
                        </span>
                        <span className="text-[#555555] select-none">•</span>
                        <span className="font-mono font-medium text-[#10B981] text-[11px]">
                            +{additions}
                        </span>
                        <span className="font-mono font-medium text-[#EF4444] text-[11px]">
                            -{deletions}
                        </span>
                        <span className="text-[#555555] select-none">•</span>
                        <span
                            className="truncate font-mono text-[10.5px] text-[#888888] max-w-[100px]"
                            title={branchName}
                        >
                            {branchName}
                        </span>
                    </div>
                </div>
            )}
        </div>
    )
}
