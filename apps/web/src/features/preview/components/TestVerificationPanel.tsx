import {
    CheckCircle2,
    XCircle,
    AlertCircle,
    ChevronDown,
    ChevronRight,
    Terminal,
    Clock,
    FlaskConical,
} from 'lucide-react'
import React, { useEffect, useState } from 'react'

import { useAppStore } from '@/app/store'
import { sessionAPI } from '@/features/sessions/api/session'
import { cn } from '@/shared/lib/utils'

export interface TestVerificationPanelProps {
    sessionId?: string
}

export const TestVerificationPanel: React.FC<TestVerificationPanelProps> = ({ sessionId }) => {
    const testReport = useAppStore((state) => state.testReport)
    const setTestReport = useAppStore((state) => state.setTestReport)
    const [filter, setFilter] = useState<'all' | 'passed' | 'failed'>('all')
    const [expandedTests, setExpandedTests] = useState<Record<string, boolean>>({})
    const [showRawOutput, setShowRawOutput] = useState(false)

    useEffect(() => {
        if (!sessionId || testReport) return

        sessionAPI
            .getSessionTests(sessionId)
            .then((res) => {
                if (res) {
                    setTestReport(res)
                }
            })
            .catch(() => {
                // Intentionally swallowed: Test results fetch fallback
            })
    }, [sessionId, testReport, setTestReport])

    // Expand failed tests by default
    useEffect(() => {
        if (testReport?.tests) {
            const nextExpanded: Record<string, boolean> = {}
            for (const t of testReport.tests) {
                if (t.status === 'failed') {
                    nextExpanded[t.id] = true
                }
            }
            setExpandedTests((prev) => ({ ...nextExpanded, ...prev }))
        }
    }, [testReport])

    const toggleTest = (testId: string) => {
        setExpandedTests((prev) => ({
            ...prev,
            [testId]: !prev[testId],
        }))
    }

    if (!testReport) {
        return (
            <div className="flex-1 flex flex-col items-center justify-center bg-[#141414] text-[#8E8D8C] select-none p-6 font-sans w-full h-full">
                <div className="flex flex-col items-center gap-3 max-w-md text-center">
                    <div className="w-12 h-12 rounded-xl bg-[#1E1E20] border border-[#2A2A2D] flex items-center justify-center text-[#A1A1AA]">
                        <FlaskConical size={22} className="text-[#87B2F4]" />
                    </div>
                    <div className="flex flex-col gap-1">
                        <span className="text-[15px] font-semibold text-[#EDEDEF]">
                            Test Verification Dashboard
                        </span>
                        <span className="text-[13px] text-[#8E8D8C] leading-relaxed">
                            No test runs recorded yet. When automated test commands (such as npm
                            test, pytest, cargo test, or bun test) execute inside the sandbox,
                            pass/fail status, assertion failures, and stack traces will stream here.
                        </span>
                    </div>
                </div>
            </div>
        )
    }

    const { summary, tests, status, command, rawOutput, executedAt } = testReport

    const filteredTests = tests.filter((t) => {
        if (filter === 'passed') return t.status === 'passed'
        if (filter === 'failed') return t.status === 'failed'
        return true
    })

    const isPassed = status === 'passed'
    const isFailed = status === 'failed'

    return (
        <div className="flex-1 flex flex-col h-full bg-[#141414] text-[#EDEDEF] font-sans overflow-hidden min-h-0">
            {/* Header section */}
            <div className="border-b border-[#2A2A2D] bg-[#18181A] px-5 py-4 shrink-0 flex flex-col gap-3">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                        <div className="p-1.5 rounded-lg bg-[#242427] text-[#87B2F4]">
                            <FlaskConical size={18} />
                        </div>
                        <div>
                            <h2 className="text-[15px] font-semibold text-white tracking-wide flex items-center gap-2">
                                Test Verification
                                <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-[#2A2A2D] text-[#A1A1AA] font-normal">
                                    {command}
                                </span>
                            </h2>
                            {executedAt && (
                                <p className="text-[11px] text-[#8E8D8C] flex items-center gap-1.5 mt-0.5">
                                    <Clock size={11} />
                                    Last run {new Date(executedAt).toLocaleTimeString()}
                                </p>
                            )}
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        {isPassed && (
                            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[12px] font-medium">
                                <CheckCircle2 size={13} />
                                <span>PASSED</span>
                            </div>
                        )}
                        {isFailed && (
                            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-500/10 border border-red-500/30 text-red-400 text-[12px] font-medium">
                                <XCircle size={13} />
                                <span>FAILED</span>
                            </div>
                        )}
                        {!isPassed && !isFailed && (
                            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/30 text-blue-400 text-[12px] font-medium">
                                <AlertCircle size={13} />
                                <span>{status.toUpperCase()}</span>
                            </div>
                        )}
                    </div>
                </div>

                {/* Metrics bar */}
                <div className="grid grid-cols-4 gap-3 bg-[#141414] p-3 rounded-lg border border-[#2A2A2D]/80">
                    <div className="flex flex-col">
                        <span className="text-[11px] text-[#8E8D8C] uppercase font-medium">
                            Total
                        </span>
                        <span className="text-[17px] font-semibold text-white">
                            {summary.total}
                        </span>
                    </div>
                    <div className="flex flex-col">
                        <span className="text-[11px] text-emerald-400/80 uppercase font-medium">
                            Passed
                        </span>
                        <span className="text-[17px] font-semibold text-emerald-400">
                            {summary.passed}
                        </span>
                    </div>
                    <div className="flex flex-col">
                        <span className="text-[11px] text-red-400/80 uppercase font-medium">
                            Failed
                        </span>
                        <span className="text-[17px] font-semibold text-red-400">
                            {summary.failed}
                        </span>
                    </div>
                    <div className="flex flex-col">
                        <span className="text-[11px] text-[#8E8D8C] uppercase font-medium">
                            Skipped
                        </span>
                        <span className="text-[17px] font-semibold text-[#A1A1AA]">
                            {summary.skipped}
                        </span>
                    </div>
                </div>

                {/* Filter and action tabs */}
                <div className="flex items-center justify-between pt-1">
                    <div className="flex items-center gap-1.5">
                        <button
                            type="button"
                            onClick={() => setFilter('all')}
                            className={cn(
                                'px-2.5 py-1 text-[12px] rounded-md transition-colors cursor-pointer',
                                filter === 'all'
                                    ? 'bg-[#2A2A2D] text-white font-medium'
                                    : 'text-[#8E8D8C] hover:text-[#EDEDEF] hover:bg-white/5'
                            )}
                        >
                            All ({summary.total})
                        </button>
                        <button
                            type="button"
                            onClick={() => setFilter('passed')}
                            className={cn(
                                'px-2.5 py-1 text-[12px] rounded-md transition-colors cursor-pointer',
                                filter === 'passed'
                                    ? 'bg-emerald-500/20 text-emerald-300 font-medium'
                                    : 'text-[#8E8D8C] hover:text-[#EDEDEF] hover:bg-white/5'
                            )}
                        >
                            Passed ({summary.passed})
                        </button>
                        <button
                            type="button"
                            onClick={() => setFilter('failed')}
                            className={cn(
                                'px-2.5 py-1 text-[12px] rounded-md transition-colors cursor-pointer',
                                filter === 'failed'
                                    ? 'bg-red-500/20 text-red-300 font-medium'
                                    : 'text-[#8E8D8C] hover:text-[#EDEDEF] hover:bg-white/5'
                            )}
                        >
                            Failed ({summary.failed})
                        </button>
                    </div>

                    {rawOutput && (
                        <button
                            type="button"
                            onClick={() => setShowRawOutput(!showRawOutput)}
                            className="flex items-center gap-1 text-[11px] text-[#8E8D8C] hover:text-white px-2 py-1 rounded bg-[#242427] border border-[#2A2A2D] cursor-pointer transition-colors"
                        >
                            <Terminal size={12} />
                            <span>{showRawOutput ? 'Hide Raw Output' : 'View Raw Output'}</span>
                        </button>
                    )}
                </div>
            </div>

            {/* Main content body */}
            <div className="flex-1 overflow-y-auto min-h-0 p-4 space-y-2">
                {showRawOutput && rawOutput && (
                    <div className="mb-4 bg-[#0D0D0E] border border-[#2A2A2D] rounded-lg p-3 font-mono text-[12px] text-[#A1A1AA] whitespace-pre-wrap overflow-x-auto max-h-64">
                        {rawOutput}
                    </div>
                )}

                {filteredTests.length === 0 ? (
                    <div className="text-center py-8 text-[#8E8D8C] text-[13px]">
                        No test cases match filter &quot;{filter}&quot;.
                    </div>
                ) : (
                    filteredTests.map((testCase) => {
                        const isTestExpanded = Boolean(expandedTests[testCase.id])
                        const isTestPassed = testCase.status === 'passed'
                        const isTestFailed = testCase.status === 'failed'

                        return (
                            <div
                                key={testCase.id}
                                className={cn(
                                    'border rounded-lg transition-colors overflow-hidden',
                                    isTestFailed
                                        ? 'border-red-900/40 bg-red-950/10'
                                        : 'border-[#2A2A2D] bg-[#19191B]'
                                )}
                            >
                                <div
                                    onClick={() => toggleTest(testCase.id)}
                                    className="px-3.5 py-2.5 flex items-center justify-between cursor-pointer hover:bg-white/[0.02]"
                                >
                                    <div className="flex items-center gap-2.5 min-w-0 pr-3">
                                        {isTestPassed && (
                                            <CheckCircle2
                                                size={15}
                                                className="text-emerald-400 shrink-0"
                                            />
                                        )}
                                        {isTestFailed && (
                                            <XCircle size={15} className="text-red-400 shrink-0" />
                                        )}
                                        {!isTestPassed && !isTestFailed && (
                                            <div className="w-3.5 h-3.5 rounded-full border border-[#8E8D8C] shrink-0" />
                                        )}

                                        <span className="text-[13px] font-mono text-[#EDEDEF] truncate">
                                            {testCase.name}
                                        </span>
                                    </div>

                                    <div className="flex items-center gap-2.5 shrink-0">
                                        {testCase.durationMs !== undefined && (
                                            <span className="text-[11px] text-[#8E8D8C] font-mono">
                                                {testCase.durationMs}ms
                                            </span>
                                        )}
                                        {(testCase.failureMessage || testCase.stackTrace) && (
                                            <div className="text-[#8E8D8C]">
                                                {isTestExpanded ? (
                                                    <ChevronDown size={14} />
                                                ) : (
                                                    <ChevronRight size={14} />
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {isTestExpanded &&
                                    (testCase.failureMessage || testCase.stackTrace) && (
                                        <div className="px-3.5 pb-3 pt-1 border-t border-[#2A2A2D]/60 bg-[#141416] space-y-2">
                                            {testCase.failureMessage && (
                                                <div className="p-2.5 rounded bg-red-950/30 border border-red-900/50 text-red-300 font-mono text-[11px] whitespace-pre-wrap">
                                                    {testCase.failureMessage}
                                                </div>
                                            )}
                                            {testCase.stackTrace && (
                                                <div className="p-2.5 rounded bg-[#0D0D0E] border border-[#2A2A2D] text-[#8E8D8C] font-mono text-[11px] whitespace-pre-wrap overflow-x-auto">
                                                    {testCase.stackTrace}
                                                </div>
                                            )}
                                        </div>
                                    )}
                            </div>
                        )
                    })
                )}
            </div>
        </div>
    )
}
