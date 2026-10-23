import {
    CheckCircle2,
    Circle,
    Clock,
    AlertCircle,
    ChevronDown,
    ChevronRight,
    Terminal,
    Sparkles,
    ListChecks,
} from 'lucide-react'
import React, { useEffect, useState } from 'react'

import type { PlanMilestone } from '@/features/preview/types'

import { useAppStore } from '@/app/store'
import { sessionAPI } from '@/features/sessions/api/session'
import { cn } from '@/shared/lib/utils'

export interface PlanChecklistPanelProps {
    sessionId?: string
}

export const PlanChecklistPanel: React.FC<PlanChecklistPanelProps> = ({ sessionId }) => {
    const sessionPlan = useAppStore((state) => state.sessionPlan)
    const setSessionPlan = useAppStore((state) => state.setSessionPlan)
    const [expandedPhases, setExpandedPhases] = useState<Record<string, boolean>>({})

    useEffect(() => {
        if (!sessionId || sessionPlan) return

        sessionAPI
            .getSessionPlan(sessionId)
            .then((res) => {
                if (res?.plan) {
                    setSessionPlan(res.plan)
                }
            })
            .catch(() => {
                // Intentionally swallowed: Session plan fetch fallback
            })
    }, [sessionId, sessionPlan, setSessionPlan])

    const togglePhase = (phaseId: string) => {
        setExpandedPhases((prev) => ({
            ...prev,
            [phaseId]: !prev[phaseId],
        }))
    }

    const milestones: PlanMilestone[] = sessionPlan?.milestones || [
        {
            id: 'reproduce',
            title: 'Reproduce & Understand',
            description: 'Analyze user prompt, inspect issue context, and reproduce problem state.',
            status: 'in_progress',
            logs: [],
        },
        {
            id: 'locate',
            title: 'Locate Relevant Code',
            description:
                'Search repository, inspect source tree, and locate files requiring changes.',
            status: 'pending',
            logs: [],
        },
        {
            id: 'implement',
            title: 'Implement Solution',
            description: 'Apply targeted modifications, refactor code, and update components.',
            status: 'pending',
            logs: [],
        },
        {
            id: 'test',
            title: 'Run Tests & Verify',
            description: 'Run automated tests, verify builds, and ensure no regressions.',
            status: 'pending',
            logs: [],
        },
        {
            id: 'pr',
            title: 'Branch & Create PR',
            description: 'Commit to task branch, push to origin, and generate pull request.',
            status: 'pending',
            logs: [],
        },
    ]

    const completedCount = milestones.filter((m) => m.status === 'completed').length
    const totalCount = milestones.length
    const progressPercent = Math.round((completedCount / totalCount) * 100)

    return (
        <div className="flex-1 flex flex-col bg-[#141414] text-[#EDEDEF] overflow-y-auto font-sans w-full h-full p-6">
            <div className="max-w-3xl w-full mx-auto flex flex-col gap-6">
                {/* Header Card */}
                <div className="p-5 rounded-xl bg-[#1A1A1C] border border-[#2A2A2D] flex flex-col gap-3">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-lg bg-[#252528] border border-[#3A3A3D] flex items-center justify-center text-[#D4D4D8]">
                                <ListChecks className="w-4 h-4" />
                            </div>
                            <div>
                                <h2 className="text-base font-semibold text-white tracking-tight">
                                    Execution Strategy & Milestones
                                </h2>
                                <p className="text-xs text-[#8E8D8C]">
                                    Multi-step autonomous execution plan for this session
                                </p>
                            </div>
                        </div>

                        <span className="text-xs font-medium text-[#A1A1AA] bg-[#222225] px-2.5 py-1 rounded-full border border-[#2E2E32]">
                            {completedCount} of {totalCount} completed ({progressPercent}%)
                        </span>
                    </div>

                    {/* Progress Bar */}
                    <div className="w-full h-1.5 bg-[#252528] rounded-full overflow-hidden">
                        <div
                            className="h-full bg-emerald-500 transition-all duration-300"
                            style={{ width: `${progressPercent}%` }}
                        />
                    </div>
                </div>

                {/* Milestone Checklist */}
                <div className="flex flex-col gap-3">
                    {milestones.map((milestone, index) => {
                        const isExpanded =
                            expandedPhases[milestone.id] ?? milestone.status === 'in_progress'
                        const isCompleted = milestone.status === 'completed'
                        const isInProgress = milestone.status === 'in_progress'
                        const isPending = milestone.status === 'pending'
                        const isFailed = milestone.status === 'failed'

                        return (
                            <div
                                key={milestone.id}
                                className={cn(
                                    'flex flex-col rounded-xl border transition-all duration-150 overflow-hidden',
                                    isInProgress &&
                                        'bg-[#1C1C1F] border-blue-500/30 shadow-[0_0_15px_-3px_rgba(59,130,246,0.1)]',
                                    isCompleted && 'bg-[#18181A] border-[#2A2A2D]',
                                    isPending && 'bg-[#161618] border-[#242426] opacity-75',
                                    isFailed && 'bg-rose-950/20 border-rose-500/30'
                                )}
                            >
                                {/* Milestone Row Header */}
                                <button
                                    type="button"
                                    onClick={() => togglePhase(milestone.id)}
                                    className="flex items-center justify-between p-4 text-left outline-none cursor-pointer hover:bg-white/[0.02] transition-colors"
                                >
                                    <div className="flex items-center gap-3.5">
                                        {/* Status Icon */}
                                        <div className="shrink-0">
                                            {isCompleted && (
                                                <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                                            )}
                                            {isInProgress && (
                                                <Clock className="w-5 h-5 text-blue-400 animate-spin" />
                                            )}
                                            {isPending && (
                                                <Circle className="w-5 h-5 text-[#52525B]" />
                                            )}
                                            {isFailed && (
                                                <AlertCircle className="w-5 h-5 text-rose-400" />
                                            )}
                                        </div>

                                        {/* Title & Description */}
                                        <div className="flex flex-col gap-0.5">
                                            <div className="flex items-center gap-2">
                                                <span className="text-xs font-mono text-[#71717A]">
                                                    0{index + 1}
                                                </span>
                                                <span
                                                    className={cn(
                                                        'text-sm font-semibold',
                                                        isInProgress && 'text-white',
                                                        isCompleted && 'text-[#E4E4E7]',
                                                        isPending && 'text-[#A1A1AA]'
                                                    )}
                                                >
                                                    {milestone.title}
                                                </span>
                                            </div>
                                            <span className="text-xs text-[#71717A]">
                                                {milestone.description}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Status Badge & Chevron */}
                                    <div className="flex items-center gap-2.5">
                                        <span
                                            className={cn(
                                                'px-2 py-0.5 rounded-full text-[11px] font-medium tracking-wide uppercase',
                                                isCompleted &&
                                                    'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20',
                                                isInProgress &&
                                                    'bg-blue-500/10 text-blue-400 border border-blue-500/20 animate-pulse',
                                                isPending &&
                                                    'bg-[#222225] text-[#71717A] border border-[#2E2E32]',
                                                isFailed &&
                                                    'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                                            )}
                                        >
                                            {isCompleted
                                                ? 'Completed'
                                                : isInProgress
                                                  ? 'In Progress'
                                                  : isFailed
                                                    ? 'Failed'
                                                    : 'Pending'}
                                        </span>

                                        <div className="text-[#71717A] p-0.5">
                                            {isExpanded ? (
                                                <ChevronDown className="w-4 h-4" />
                                            ) : (
                                                <ChevronRight className="w-4 h-4" />
                                            )}
                                        </div>
                                    </div>
                                </button>

                                {/* Expanded Details */}
                                {isExpanded && (
                                    <div className="px-4 pb-4 pt-1 flex flex-col gap-3 border-t border-[#252528] bg-[#141416]/50">
                                        {/* Agent Rationale */}
                                        {milestone.rationale && (
                                            <div className="flex items-start gap-2 p-3 rounded-lg bg-[#1F1F23] border border-[#2E2E33] text-xs">
                                                <Sparkles className="w-3.5 h-3.5 text-blue-400 shrink-0 mt-0.5" />
                                                <div className="flex flex-col gap-0.5 text-[#D4D4D8]">
                                                    <span className="font-semibold text-white">
                                                        Rationale
                                                    </span>
                                                    <span>{milestone.rationale}</span>
                                                </div>
                                            </div>
                                        )}

                                        {/* Execution Logs */}
                                        <div className="flex flex-col gap-1.5">
                                            <div className="flex items-center gap-1.5 text-xs text-[#71717A] font-semibold uppercase tracking-wider">
                                                <Terminal className="w-3 h-3" />
                                                <span>Phase Logs</span>
                                            </div>

                                            {milestone.logs && milestone.logs.length > 0 ? (
                                                <div className="p-2.5 rounded-lg bg-[#0F0F11] border border-[#222225] font-mono text-[11px] text-[#A1A1AA] flex flex-col gap-1 max-h-48 overflow-y-auto">
                                                    {milestone.logs.map((log, logIdx) => (
                                                        <div
                                                            key={logIdx}
                                                            className="flex items-start gap-2"
                                                        >
                                                            <span className="text-[#52525B] select-none">
                                                                ›
                                                            </span>
                                                            <span className="text-[#D4D4D8] break-all">
                                                                {log}
                                                            </span>
                                                        </div>
                                                    ))}
                                                </div>
                                            ) : (
                                                <div className="p-3 rounded-lg bg-[#0F0F11] border border-[#222225] font-mono text-[11px] text-[#52525B] italic">
                                                    No detailed logs recorded for this phase yet.
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )
                    })}
                </div>
            </div>
        </div>
    )
}
