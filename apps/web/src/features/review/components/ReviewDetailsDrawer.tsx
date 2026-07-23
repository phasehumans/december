import React, { useState } from 'react'
import { createPortal } from 'react-dom'

import type { PullRequestReview, ReviewFinding } from '../api/review'

import { Icons } from '@/shared/components/ui/Icons'

interface ReviewDetailsDrawerProps {
    isOpen: boolean
    review: PullRequestReview | null
    onClose: () => void
}

export const ReviewDetailsDrawer: React.FC<ReviewDetailsDrawerProps> = ({
    isOpen,
    review,
    onClose,
}) => {
    const [severityFilter, setSeverityFilter] = useState<'ALL' | 'CRITICAL' | 'WARNING' | 'INFO'>(
        'ALL'
    )

    if (!isOpen || !review) return null

    const findings = (review.findings || []) as ReviewFinding[]
    const filteredFindings =
        severityFilter === 'ALL' ? findings : findings.filter((f) => f.severity === severityFilter)

    const criticalCount = findings.filter((f) => f.severity === 'CRITICAL').length
    const warningCount = findings.filter((f) => f.severity === 'WARNING').length
    const infoCount = findings.filter((f) => f.severity === 'INFO').length

    return createPortal(
        <div className="fixed inset-0 z-[9999] flex justify-end pointer-events-auto">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/40 animate-in fade-in duration-200"
                onClick={onClose}
            />

            {/* Slide-over Drawer Panel */}
            <div className="relative w-full max-w-3xl h-full bg-[#181818] border-l border-[#282828] shadow-2xl flex flex-col z-10 animate-in slide-in-from-right duration-250 font-sans">
                {/* Header Bar */}
                <div className="p-6 border-b border-[#282828] bg-[#141414] flex items-start justify-between gap-4">
                    <div className="flex flex-col gap-1.5 min-w-0">
                        <div className="flex items-center gap-2.5">
                            <span className="px-2 py-0.5 rounded-md border border-purple-500/30 bg-purple-500/10 text-[11px] font-medium text-purple-400">
                                {review.provider} #{review.prNumber}
                            </span>
                            <span className="text-[12px] font-medium text-[#7B7A79] truncate">
                                {review.repository}
                            </span>
                            {review.sessionId && (
                                <span className="px-2 py-0.5 rounded-md bg-blue-500/10 border border-blue-500/20 text-[11px] font-medium text-blue-400">
                                    Connected Session
                                </span>
                            )}
                        </div>
                        <h2 className="text-[20px] font-semibold text-white truncate leading-snug">
                            {review.title}
                        </h2>
                        <div className="flex items-center gap-3 text-[12px] text-[#7B7A79]">
                            <span>
                                Author: <strong className="text-[#D6D5C9]">{review.author}</strong>
                            </span>
                            <span>•</span>
                            <span>
                                {new Date(review.createdAt).toLocaleDateString(undefined, {
                                    month: 'short',
                                    day: 'numeric',
                                    year: 'numeric',
                                })}
                            </span>
                        </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                        <a
                            href={review.prUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#383736] bg-[#202020] hover:bg-[#282828] text-[12px] font-medium text-[#D6D5C9] transition-colors"
                        >
                            <span>Open PR</span>
                            <Icons.ExternalLink className="w-3.5 h-3.5" />
                        </a>
                        <button
                            onClick={onClose}
                            className="p-1.5 rounded-lg text-[#7B7A79] hover:bg-[#242323] hover:text-white transition-colors"
                        >
                            <Icons.X className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {/* Content Area */}
                <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-6 no-scrollbar">
                    {/* Quality Overview Score Card */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                        <div className="p-4 rounded-xl border border-[#282828] bg-[#202020] flex flex-col justify-between">
                            <span className="text-[11px] font-semibold text-[#8F8E8D] uppercase tracking-wider">
                                Overall Score
                            </span>
                            <div className="flex items-baseline gap-1.5 mt-2">
                                <span className="text-[28px] font-bold text-white leading-none">
                                    {review.score}
                                </span>
                                <span className="text-[12px] text-[#8F8E8D]">/ 100</span>
                            </div>
                        </div>

                        <div className="p-4 rounded-xl border border-[#282828] bg-[#202020] flex flex-col justify-between">
                            <span className="text-[11px] font-semibold text-[#8F8E8D] uppercase tracking-wider">
                                Critical Issues
                            </span>
                            <div className="flex items-baseline gap-1.5 mt-2">
                                <span className="text-[28px] font-bold text-red-400 leading-none">
                                    {criticalCount}
                                </span>
                            </div>
                        </div>

                        <div className="p-4 rounded-xl border border-[#282828] bg-[#202020] flex flex-col justify-between">
                            <span className="text-[11px] font-semibold text-[#8F8E8D] uppercase tracking-wider">
                                Warnings
                            </span>
                            <div className="flex items-baseline gap-1.5 mt-2">
                                <span className="text-[28px] font-bold text-amber-400 leading-none">
                                    {warningCount}
                                </span>
                            </div>
                        </div>

                        <div className="p-4 rounded-xl border border-[#282828] bg-[#202020] flex flex-col justify-between">
                            <span className="text-[11px] font-semibold text-[#8F8E8D] uppercase tracking-wider">
                                Suggestions
                            </span>
                            <div className="flex items-baseline gap-1.5 mt-2">
                                <span className="text-[28px] font-bold text-blue-400 leading-none">
                                    {infoCount}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Executive Summary */}
                    <div className="p-5 rounded-xl border border-[#282828] bg-[#202020] flex flex-col gap-2">
                        <h3 className="text-[13px] font-semibold text-[#D6D5C9] uppercase tracking-wider">
                            Executive Summary
                        </h3>
                        <div className="text-[13px] text-[#A3A2A0] leading-relaxed whitespace-pre-line font-mono">
                            {review.summary || 'No summary available for this PR review.'}
                        </div>
                    </div>

                    {/* Code Findings Section */}
                    <div className="flex flex-col gap-4">
                        <div className="flex items-center justify-between">
                            <h3 className="text-[14px] font-semibold text-white">
                                Code Findings & Diff Suggestions ({findings.length})
                            </h3>

                            {/* Severity Tabs */}
                            <div className="flex items-center gap-1.5 bg-[#141414] border border-[#282828] p-1 rounded-lg">
                                {(['ALL', 'CRITICAL', 'WARNING', 'INFO'] as const).map((sev) => (
                                    <button
                                        key={sev}
                                        onClick={() => setSeverityFilter(sev)}
                                        className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors ${
                                            severityFilter === sev
                                                ? 'bg-[#282828] text-white'
                                                : 'text-[#8F8E8D] hover:text-white'
                                        }`}
                                    >
                                        {sev}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {filteredFindings.length === 0 ? (
                            <div className="p-8 rounded-xl border border-[#282828] bg-[#202020] text-center text-[#7B7A79] text-[13px]">
                                No findings match the selected severity filter.
                            </div>
                        ) : (
                            <div className="flex flex-col gap-3">
                                {filteredFindings.map((finding) => {
                                    const isCritical = finding.severity === 'CRITICAL'
                                    const isWarning = finding.severity === 'WARNING'

                                    return (
                                        <div
                                            key={finding.id}
                                            className="p-4 rounded-xl border border-[#282828] bg-[#202020] flex flex-col gap-3"
                                        >
                                            <div className="flex items-start justify-between gap-3">
                                                <div className="flex items-center gap-2 min-w-0">
                                                    <span
                                                        className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                                                            isCritical
                                                                ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                                                                : isWarning
                                                                  ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                                                                  : 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                                                        }`}
                                                    >
                                                        {finding.severity}
                                                    </span>
                                                    <span className="text-[13px] font-semibold text-white truncate">
                                                        {finding.title}
                                                    </span>
                                                </div>
                                                <span className="text-[11px] font-mono text-[#7B7A79] shrink-0">
                                                    {finding.filePath} : L{finding.lineNumber}
                                                </span>
                                            </div>

                                            <p className="text-[12.5px] text-[#A3A2A0] leading-relaxed">
                                                {finding.description}
                                            </p>

                                            {/* Code Snippet Comparison */}
                                            {(finding.originalSnippet ||
                                                finding.proposedSnippet) && (
                                                <div className="flex flex-col gap-2 mt-1 rounded-lg border border-[#282828] bg-[#141414] overflow-hidden p-3 font-mono text-[11.5px]">
                                                    {finding.originalSnippet && (
                                                        <div className="flex flex-col gap-1">
                                                            <span className="text-[10px] text-red-400/80 uppercase tracking-wider font-sans font-semibold">
                                                                Existing Code
                                                            </span>
                                                            <pre className="bg-red-950/30 text-red-300 p-2 rounded border border-red-900/30 overflow-x-auto whitespace-pre">
                                                                {finding.originalSnippet}
                                                            </pre>
                                                        </div>
                                                    )}
                                                    {finding.proposedSnippet && (
                                                        <div className="flex flex-col gap-1">
                                                            <span className="text-[10px] text-emerald-400/80 uppercase tracking-wider font-sans font-semibold">
                                                                Suggested Fix
                                                            </span>
                                                            <pre className="bg-emerald-950/30 text-emerald-300 p-2 rounded border border-emerald-900/30 overflow-x-auto whitespace-pre">
                                                                {finding.proposedSnippet}
                                                            </pre>
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    )
                                })}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>,
        document.body
    )
}
