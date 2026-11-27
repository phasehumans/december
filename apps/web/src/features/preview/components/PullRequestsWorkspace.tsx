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
import React, { useEffect, useRef, useState } from 'react'

import { useAppStore } from '@/app/store'
import { GIT_HOST_LABELS, webLinkOrNull } from '@/features/pullrequests/lib/pullRequests'
import { sessionAPI } from '@/features/sessions/api/session'
import { cn } from '@/shared/lib/utils'

export interface PullRequestsWorkspaceProps {
    sessionId?: string
    /** the saved branch of the session (`prBranch`), when the api gives it */
    branch?: string | null
}

/** the session's pull request read from the server: on the way, read, or failed */
type ReadState = 'loading' | 'ready' | 'error'

export const PullRequestsWorkspace: React.FC<PullRequestsWorkspaceProps> = ({
    sessionId,
    branch,
}) => {
    const storedPullRequest = useAppStore((state) => state.pullRequest)
    const setPullRequest = useAppStore((state) => state.setPullRequest)
    // a run that pushed only a branch, or whose pull request was not opened, sends a result
    // with no number: that is no pull request, so the view shows none
    const pullRequest = storedPullRequest?.prNumber ? storedPullRequest : null
    const [readState, setReadState] = useState<ReadState>('loading')
    // a press on Retry reads again
    const [attempt, setAttempt] = useState(0)

    // read each time the view opens, so a merge or close on the host since the last look
    // shows. the pull request already on screen stays while the new one is on the way
    useEffect(() => {
        if (!sessionId) return

        // the answer of a session the user already left is dropped, so it never shows on
        // the next session
        let isCurrent = true
        setReadState('loading')
        sessionAPI
            .getSessionPullRequests(sessionId)
            .then((res) => {
                if (!isCurrent) return
                if (res?.pullRequest) setPullRequest(res.pullRequest)
                setReadState('ready')
            })
            .catch((error: unknown) => {
                if (!isCurrent) return
                console.warn('[PullRequestsWorkspace] could not read the pull request', error)
                setReadState('error')
            })
        return () => {
            isCurrent = false
        }
    }, [sessionId, attempt, setPullRequest])

    // a new message empties the store: the session still has its pull request, so it is
    // read again instead of showing "No pull request yet"
    const hadPullRequest = useRef(false)
    useEffect(() => {
        if (storedPullRequest) {
            hadPullRequest.current = true
            return
        }
        if (hadPullRequest.current) {
            hadPullRequest.current = false
            setAttempt((n) => n + 1)
        }
    }, [storedPullRequest])

    if (!pullRequest) {
        // nothing is shown while the first read is on the way, so "No pull request yet"
        // does not flash before the pull request
        if (readState === 'loading') {
            return <div className="flex-1 w-full h-full bg-[#141414]" aria-busy="true" />
        }
        const failed = readState === 'error'
        return (
            <div className="flex-1 flex flex-col items-center justify-center bg-[#141414] text-[#8E8D8C] select-none p-6 font-sans w-full h-full">
                <div className="flex flex-col items-center gap-3 max-w-sm text-center">
                    <div className="w-10 h-10 rounded-xl bg-[#1E1E20] border border-[#2A2A2D] flex items-center justify-center text-[#A1A1AA]">
                        <GitPullRequest className="w-4 h-4 text-[#8E8D8C]" />
                    </div>
                    <div className="flex flex-col gap-1">
                        <span className="text-[14px] font-semibold text-[#EDEDEF]">
                            {failed ? 'Could not load the pull request' : 'No pull request yet'}
                        </span>
                        {!failed && branch && (
                            <span className="text-[12px] text-[#8E8D8C]">
                                The changes are on the branch{' '}
                                <code className="text-[#A1A1AA] bg-[#202022] px-1 py-0.5 rounded">
                                    {branch}
                                </code>
                                .
                            </span>
                        )}
                    </div>
                    {failed && (
                        <button
                            type="button"
                            onClick={() => setAttempt((n) => n + 1)}
                            className="px-3 py-1.5 rounded-lg bg-[#252528] hover:bg-[#2F2F33] text-xs font-medium text-white transition-colors border border-[#3A3A3D]"
                        >
                            Retry
                        </button>
                    )}
                </div>
            </div>
        )
    }

    const {
        prNumber,
        title,
        url: savedUrl,
        gitProvider,
        state = 'open',
        headRef: pullRequestBranch,
        // a pull request saved on the session has no base branch or checks: show none
        baseRef,
        diffSummary,
        ciStatus,
    } = pullRequest

    // the branch of the pull request, or the saved branch of the session
    const headRef = pullRequestBranch || branch || null
    // only a web link reaches the href
    const url = webLinkOrNull(savedUrl)
    const hostLabel = GIT_HOST_LABELS[gitProvider === 'GITLAB' ? 'GITLAB' : 'GITHUB']
    // GitLab does not count lines: no counts then, instead of +0 -0
    const hasLineCounts =
        typeof diffSummary?.additions === 'number' && typeof diffSummary?.deletions === 'number'
    const additions: number = diffSummary?.additions ?? 0
    const deletions: number = diffSummary?.deletions ?? 0
    const changedFiles: number | undefined = diffSummary?.changedFiles

    const isMerged = state.toLowerCase() === 'merged'
    const isClosed = state.toLowerCase() === 'closed'
    const isDraft = state.toLowerCase() === 'draft'
    // a state that is not known reads as open, like the Pull requests page
    const isOpen = !isMerged && !isClosed && !isDraft
    const stateLabel = isMerged ? 'Merged' : isClosed ? 'Closed' : isDraft ? 'Draft' : 'Open'

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
                                            'bg-rose-500/10 text-rose-400 border border-rose-500/20',
                                        isDraft &&
                                            'bg-[#262626] text-[#8F8E8D] border border-[#3A3A3D]'
                                    )}
                                >
                                    <GitPullRequest className="w-3.5 h-3.5" />
                                    {stateLabel}
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
                                <span>View on {hostLabel}</span>
                                <ExternalLink className="w-3.5 h-3.5 text-[#8E8D8C]" />
                            </a>
                        )}
                    </div>

                    {/* Branch metadata */}
                    <div className="flex items-center gap-2 pt-2 border-t border-[#2A2A2D] text-xs font-mono text-[#A1A1AA]">
                        {headRef && (
                            <>
                                <div className="flex items-center gap-1.5 bg-[#202022] px-2 py-1 rounded border border-[#2E2E31] text-[#E4E4E7]">
                                    <GitBranch className="w-3.5 h-3.5 text-[#8E8D8C]" />
                                    <span>{headRef}</span>
                                </div>
                                {baseRef && <ArrowRight className="w-3.5 h-3.5 text-[#6E6E73]" />}
                            </>
                        )}
                        {baseRef && (
                            <div className="flex items-center gap-1.5 bg-[#202022] px-2 py-1 rounded border border-[#2E2E31] text-[#A1A1AA]">
                                <GitCommit className="w-3.5 h-3.5 text-[#8E8D8C]" />
                                <span>{baseRef}</span>
                            </div>
                        )}
                    </div>
                </div>

                {/* Diff Summary & CI Status Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Diff Summary Card: only when something about the diff is known */}
                    {(hasLineCounts || changedFiles !== undefined) && (
                        <div className="p-4 rounded-xl bg-[#1A1A1C] border border-[#2A2A2D] flex flex-col gap-3">
                            <div className="flex items-center gap-2 text-xs font-semibold text-[#8E8D8C] uppercase tracking-wider">
                                <FileText className="w-3.5 h-3.5" />
                                <span>Diff Summary</span>
                            </div>
                            <div className="flex items-center gap-4 text-sm font-medium">
                                {hasLineCounts && (
                                    <>
                                        <div className="flex items-center gap-1 text-emerald-400">
                                            <span>+{additions}</span>
                                        </div>
                                        <div className="flex items-center gap-1 text-rose-400">
                                            <span>-{deletions}</span>
                                        </div>
                                    </>
                                )}
                                {changedFiles !== undefined && (
                                    <span className="text-xs text-[#8E8D8C]">
                                        {changedFiles}{' '}
                                        {changedFiles === 1 ? 'file changed' : 'files changed'}
                                    </span>
                                )}
                            </div>
                        </div>
                    )}

                    {/* CI Status Card: only when the checks are known */}
                    {ciStatus && (
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
                    )}
                </div>
            </div>
        </div>
    )
}
