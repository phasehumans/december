import React, { useRef, useState } from 'react'

import type { BackendSession } from '@/features/sessions/api/session'

import {
    PULL_REQUEST_STATE_CLASS,
    PULL_REQUEST_STATE_LABELS,
    pullRequestUrlOf,
    repoNameOf,
} from '@/features/pullrequests/lib/pullRequests'
import { Icons } from '@/shared/components/ui/Icons'
import { cn } from '@/shared/lib/utils'

interface SessionPrTooltipProps {
    session: BackendSession
}

/**
 * the #number chip on a session row, coloured by pull request state. on hover (desktop) a
 * small card shows the title, repository, branch and state. only saved values are shown:
 * no line counts, no made-up branch, no link when the pull request url is unknown.
 */
export const SessionPrTooltip: React.FC<SessionPrTooltipProps> = ({ session }) => {
    const [isOpen, setIsOpen] = useState(false)
    const [copied, setCopied] = useState(false)
    const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

    if (!session.prNumber) return null

    const state = session.prState ?? 'open'
    const url = pullRequestUrlOf(session)
    const repo = repoNameOf(session)
    const shortRepo = repo ? repo.split('/').pop() : null
    // only the branch of the pull request: session.branch is the base branch
    const branch = session.prBranch ?? null
    const title = session.prTitle || session.title || `Pull request #${session.prNumber}`

    const show = () => {
        if (timeoutRef.current) clearTimeout(timeoutRef.current)
        setIsOpen(true)
    }
    const hide = () => {
        timeoutRef.current = setTimeout(() => setIsOpen(false), 150)
    }

    const openGithub = (e: React.MouseEvent) => {
        e.stopPropagation()
        e.preventDefault()
        if (url) window.open(url, '_blank', 'noopener,noreferrer')
    }

    const copyBranch = (e: React.MouseEvent) => {
        e.stopPropagation()
        e.preventDefault()
        if (!branch) return
        void navigator.clipboard.writeText(branch).then(
            () => {
                setCopied(true)
                setTimeout(() => setCopied(false), 2000)
            },
            () => {
                // Intentionally swallowed: the browser refused clipboard access, nothing to show
            }
        )
    }

    const chipClass = cn(
        'flex items-center gap-1 rounded-md bg-[#202020] px-2 py-0.5 text-[11px] font-medium tabular-nums select-none whitespace-nowrap',
        PULL_REQUEST_STATE_CLASS[state]
    )

    return (
        <div
            className="relative inline-flex items-center"
            onMouseEnter={show}
            onMouseLeave={hide}
            onClick={(e) => e.stopPropagation()}
        >
            {url ? (
                <button
                    type="button"
                    onClick={openGithub}
                    className={cn(chipClass, 'cursor-pointer hover:bg-[#272727] transition-colors')}
                    aria-label={`Open pull request ${session.prNumber} on GitHub`}
                >
                    <Icons.GitPullRequest className="h-3 w-3" />#{session.prNumber}
                </button>
            ) : (
                <span className={chipClass}>
                    <Icons.GitPullRequest className="h-3 w-3" />#{session.prNumber}
                </span>
            )}

            {isOpen && (
                <div
                    className="hidden md:flex absolute left-0 top-full mt-1 z-50 w-[290px] flex-col gap-0.5 rounded-xl border border-[#2F2F2F] bg-[#1E1E1E] px-2.5 py-1.5 shadow-2xl animate-in fade-in zoom-in-95 duration-150"
                    onMouseEnter={show}
                    onMouseLeave={hide}
                >
                    <div className="flex items-center justify-between gap-1.5">
                        <span className="truncate text-[12.5px] font-medium text-[#E1E1E1] leading-snug">
                            {title}
                        </span>
                        {(branch || url) && (
                            <div className="flex items-center gap-0.5 shrink-0 bg-[#262626]/90 border border-[#333333] rounded-md p-0.5">
                                {branch && (
                                    <button
                                        type="button"
                                        onClick={copyBranch}
                                        className="flex h-5 w-5 items-center justify-center rounded text-[#999999] transition-colors hover:bg-[#333333] hover:text-white cursor-pointer"
                                        aria-label={
                                            copied ? 'Branch name copied' : 'Copy branch name'
                                        }
                                        title={copied ? 'Copied' : 'Copy branch name'}
                                    >
                                        {copied ? (
                                            <Icons.Check className="h-3 w-3 text-emerald-400" />
                                        ) : (
                                            <Icons.Copy className="h-3 w-3" />
                                        )}
                                    </button>
                                )}
                                {url && (
                                    <button
                                        type="button"
                                        onClick={openGithub}
                                        className="flex h-5 w-5 items-center justify-center rounded text-[#999999] transition-colors hover:bg-[#333333] hover:text-white cursor-pointer"
                                        aria-label="Open in GitHub"
                                        title="Open in GitHub"
                                    >
                                        <Icons.Github className="h-3 w-3" />
                                    </button>
                                )}
                            </div>
                        )}
                    </div>
                    <div className="flex items-center gap-1 min-w-0 text-[11px] leading-tight text-[#999999]">
                        <Icons.GitPullRequest
                            className={cn('w-3 h-3 shrink-0', PULL_REQUEST_STATE_CLASS[state])}
                        />
                        <span className="truncate shrink-0">
                            {shortRepo ? `${shortRepo} ` : ''}#{session.prNumber}
                        </span>
                        {branch && (
                            <>
                                <span className="text-[#555555]">·</span>
                                <span className="truncate font-mono text-[10.5px] text-[#888888]">
                                    {branch}
                                </span>
                            </>
                        )}
                        <span className="text-[#555555]">·</span>
                        <span className={cn('shrink-0', PULL_REQUEST_STATE_CLASS[state])}>
                            {PULL_REQUEST_STATE_LABELS[state]}
                        </span>
                    </div>
                </div>
            )}
        </div>
    )
}
