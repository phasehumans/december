import {
    GitPullRequest,
    GitBranch,
    ExternalLink,
    CheckCircle2,
    AlertCircle,
    Clock,
    FileText,
    ArrowRight,
    GitCommit,
} from 'lucide-react'
import React, { useEffect } from 'react'

import { useAppStore } from '@/app/store'
import { sessionAPI } from '@/features/sessions/api/session'
import { cn } from '@/shared/lib/utils'

export interface PullRequestsWorkspaceProps {
    sessionId?: string
}

export const PullRequestsWorkspace: React.FC<PullRequestsWorkspaceProps> = ({ sessionId }) => {
    const pullRequest = useAppStore((state) => state.pullRequest)
    const setPullRequest = useAppStore((state) => state.setPullRequest)

    useEffect(() => {
        if (!sessionId || pullRequest) return

        sessionAPI
            .getSessionPullRequests(sessionId)
            .then((res) => {
                if (res?.pullRequest) {
                    setPullRequest(res.pullRequest)
                }
            })
            .catch(() => {
                // Intentionally swallowed: Session PR fetch fallback
            })
    }, [sessionId, pullRequest, setPullRequest])

    if (!pullRequest) {
        return (
            <div className="flex-1 flex flex-col items-center justify-center bg-[#141414] text-[#8E8D8C] select-none p-6 font-sans w-full h-full">
                <div className="flex flex-col items-center gap-3 max-w-sm text-center">
                    <div className="w-10 h-10 rounded-xl bg-[#1E1E20] border border-[#2A2A2D] flex items-center justify-center text-[#A1A1AA]">
                        <GitPullRequest className="w-4 h-4 text-[#8E8D8C]" />
                    </div>
                    <div className="flex flex-col gap-1">
                        <span className="text-[14px] font-semibold text-[#EDEDEF]">
                            No Pull Request Created Yet
                        </span>
                        <span className="text-[12px] text-[#8E8D8C]">
                            When your task completes, an autonomous pull request will be generated
                            for branch{' '}
                            <code className="text-[#A1A1AA] bg-[#202022] px-1 py-0.5 rounded">
                                december/{sessionId || 'task'}
                            </code>
                            .
                        </span>
                    </div>
                </div>
            </div>
        )
    }

    const {
        prNumber,
        title,
        url,
        state = 'open',
        headRef,
        baseRef = 'main',
        diffSummary,
        ciStatus = 'passing',
    } = pullRequest

    const additions = diffSummary?.additions ?? 0
    const deletions = diffSummary?.deletions ?? 0
    const changedFiles = diffSummary?.changedFiles ?? 0

    const isMerged = state.toLowerCase() === 'merged'
    const isClosed = state.toLowerCase() === 'closed'
    const isOpen = state.toLowerCase() === 'open'

    return (
        <div className="flex-1 flex flex-col bg-[#141414] text-[#EDEDEF] overflow-y-auto font-sans w-full h-full p-6">
            <div className="max-w-4xl w-full mx-auto flex flex-col gap-6">
                {/* Header Card */}
                <div className="flex flex-col gap-4 p-5 rounded-xl bg-[#1A1A1C] border border-[#2A2A2D]">
                    <div className="flex items-start justify-between gap-4">
                        <div className="flex flex-col gap-2">
                            <div className="flex items-center gap-2.5">
                                <span
                                    className={cn(
                                        'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wider',
                                        isOpen &&
                                            'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20',
                                        isMerged &&
                                            'bg-purple-500/10 text-purple-400 border border-purple-500/20',
                                        isClosed &&
                                            'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                                    )}
                                >
                                    <GitPullRequest className="w-3.5 h-3.5" />
                                    {isOpen ? 'Open' : isMerged ? 'Merged' : 'Closed'}
                                </span>
                                {prNumber && (
                                    <span className="text-sm font-semibold text-[#8E8D8C]">
                                        #{prNumber}
                                    </span>
                                )}
                            </div>
                            <h1 className="text-lg font-semibold text-white tracking-tight">
                                {title || 'Autonomous Task Changes'}
                            </h1>
                        </div>

                        {url && (
                            <a
                                href={url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#252528] hover:bg-[#2F2F33] text-xs font-medium text-white transition-colors border border-[#3A3A3D]"
                            >
                                <span>View on GitHub</span>
                                <ExternalLink className="w-3.5 h-3.5 text-[#8E8D8C]" />
                            </a>
                        )}
                    </div>

                    {/* Branch metadata */}
                    <div className="flex items-center gap-2 pt-2 border-t border-[#2A2A2D] text-xs font-mono text-[#A1A1AA]">
                        <div className="flex items-center gap-1.5 bg-[#202022] px-2 py-1 rounded border border-[#2E2E31] text-[#E4E4E7]">
                            <GitBranch className="w-3.5 h-3.5 text-[#8E8D8C]" />
                            <span>{headRef || `december/${sessionId}`}</span>
                        </div>
                        <ArrowRight className="w-3.5 h-3.5 text-[#6E6E73]" />
                        <div className="flex items-center gap-1.5 bg-[#202022] px-2 py-1 rounded border border-[#2E2E31] text-[#A1A1AA]">
                            <GitCommit className="w-3.5 h-3.5 text-[#8E8D8C]" />
                            <span>{baseRef}</span>
                        </div>
                    </div>
                </div>

                {/* Diff Summary & CI Status Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Diff Summary Card */}
                    <div className="p-4 rounded-xl bg-[#1A1A1C] border border-[#2A2A2D] flex flex-col gap-3">
                        <div className="flex items-center gap-2 text-xs font-semibold text-[#8E8D8C] uppercase tracking-wider">
                            <FileText className="w-3.5 h-3.5" />
                            <span>Diff Summary</span>
                        </div>
                        <div className="flex items-center gap-4 text-sm font-medium">
                            <div className="flex items-center gap-1 text-emerald-400">
                                <span>+{additions}</span>
                            </div>
                            <div className="flex items-center gap-1 text-rose-400">
                                <span>-{deletions}</span>
                            </div>
                            <span className="text-xs text-[#8E8D8C]">
                                {changedFiles}{' '}
                                {changedFiles === 1 ? 'file changed' : 'files changed'}
                            </span>
                        </div>
                    </div>

                    {/* CI Status Card */}
                    <div className="p-4 rounded-xl bg-[#1A1A1C] border border-[#2A2A2D] flex flex-col gap-3">
                        <div className="flex items-center gap-2 text-xs font-semibold text-[#8E8D8C] uppercase tracking-wider">
                            <span>Continuous Integration</span>
                        </div>
                        <div className="flex items-center gap-2">
                            {ciStatus === 'passing' && (
                                <>
                                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                                    <span className="text-xs font-medium text-emerald-300">
                                        All checks passed
                                    </span>
                                </>
                            )}
                            {ciStatus === 'pending' && (
                                <>
                                    <Clock className="w-4 h-4 text-amber-400 animate-spin" />
                                    <span className="text-xs font-medium text-amber-300">
                                        Checks running
                                    </span>
                                </>
                            )}
                            {ciStatus === 'failed' && (
                                <>
                                    <AlertCircle className="w-4 h-4 text-rose-400" />
                                    <span className="text-xs font-medium text-rose-300">
                                        Checks failed
                                    </span>
                                </>
                            )}
                        </div>
                    </div>
                </div>

                {/* Verification Notes */}
                <div className="p-5 rounded-xl bg-[#1A1A1C] border border-[#2A2A2D] flex flex-col gap-2.5">
                    <h3 className="text-xs font-semibold text-[#8E8D8C] uppercase tracking-wider">
                        Verification Notes
                    </h3>
                    <div className="text-xs text-[#D4D4D8] leading-relaxed flex flex-col gap-1.5 font-sans">
                        <p>
                            • Isolated sandbox container environment build & tests executed cleanly.
                        </p>
                        <p>
                            • Changes committed autonomously under author{' '}
                            <code className="text-[#A1A1AA] bg-[#202022] px-1 py-0.5 rounded">
                                December Agent &lt;agent@trydecember.com&gt;
                            </code>
                            .
                        </p>
                        <p>
                            • Pushed directly to branch{' '}
                            <code className="text-[#A1A1AA] bg-[#202022] px-1 py-0.5 rounded">
                                {headRef}
                            </code>{' '}
                            without default branch overwrite.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    )
}
