import React, { useState, useEffect } from 'react'

import { sessionAPI } from '../api/session'

import { Icons } from '@/shared/components/ui/Icons'
import { Modal } from '@/shared/components/ui/Modal'

interface SessionInsightsModalProps {
    isOpen: boolean
    session: any | null
    onClose: () => void
}

export const SessionInsightsModal: React.FC<SessionInsightsModalProps> = ({
    isOpen,
    session,
    onClose,
}) => {
    const [loading, setLoading] = useState(true)
    const [insights, setInsights] = useState<any[]>([])
    const [telemetry, setTelemetry] = useState<any | null>(null)

    useEffect(() => {
        if (isOpen && session) {
            setLoading(true)
            sessionAPI
                .getSessionInsights(session.id)
                .then((res: any) => {
                    setInsights(res.insights || [])
                    setTelemetry(res.telemetry || null)
                })
                .catch((err) => {
                    console.error('Failed to load insights:', err)
                })
                .finally(() => {
                    setLoading(false)
                })
        }
    }, [session, isOpen])

    // generate dynamic focus areas based on session details
    const getFocusAreas = () => {
        const areas = []
        if (session?.tags && session.tags.length > 0) {
            areas.push(...session.tags)
        }
        const titleLower = (session?.title || '').toLowerCase()
        if (
            titleLower.includes('ui') ||
            titleLower.includes('style') ||
            titleLower.includes('css')
        ) {
            areas.push('Styling', 'UI Design')
        }
        if (titleLower.includes('react') || titleLower.includes('component')) {
            areas.push('React Components')
        }
        if (
            titleLower.includes('db') ||
            titleLower.includes('prisma') ||
            titleLower.includes('database')
        ) {
            areas.push('Database Schema')
        }
        if (areas.length === 0) {
            areas.push('General Development')
        }
        return Array.from(new Set(areas))
    }

    const formatDate = (dateStr: string) => {
        if (!dateStr) return '--'
        return new Date(dateStr).toLocaleDateString(undefined, {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        })
    }

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title="Session Insights"
            description="AI-generated statistics and telemetry for this active development session."
            variant="premium"
            maxWidth="max-w-[540px]"
        >
            {loading ? (
                <div className="flex flex-col items-center justify-center py-16 gap-3">
                    <span className="w-8 h-8 border-3 border-[#A3A2A0] border-t-transparent rounded-full animate-spin" />
                    <span className="text-[13px] text-[#7B7A79]">
                        Analyzing session telemetry...
                    </span>
                </div>
            ) : (
                <div className="flex flex-col gap-5 mt-2 animate-in fade-in slide-in-from-bottom-2 duration-300">
                    {/* dashboard grid */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                        <div className="bg-white/[0.02] border border-white/5 p-3 rounded-xl flex flex-col gap-0.5">
                            <span className="text-[11px] text-[#7B7A79] font-medium truncate">
                                Messages
                            </span>
                            <span className="text-[16px] font-semibold text-[#D6D5C9] mt-0.5">
                                {telemetry?.totalMessages ?? '--'}
                            </span>
                        </div>
                        <div className="bg-white/[0.02] border border-white/5 p-3 rounded-xl flex flex-col gap-0.5">
                            <span className="text-[11px] text-[#7B7A79] font-medium truncate">
                                Code Files
                            </span>
                            <span className="text-[16px] font-semibold text-purple-400 mt-0.5">
                                {telemetry?.fileCount ?? '--'}
                            </span>
                        </div>
                        <div className="bg-white/[0.02] border border-white/5 p-3 rounded-xl flex flex-col gap-0.5">
                            <span className="text-[11px] text-[#7B7A79] font-medium truncate">
                                Est. Tokens
                            </span>
                            <span className="text-[16px] font-semibold text-emerald-400 mt-0.5">
                                {telemetry?.estimatedTokens
                                    ? telemetry.estimatedTokens.toLocaleString()
                                    : '--'}
                            </span>
                        </div>
                        <div className="bg-white/[0.02] border border-white/5 p-3 rounded-xl flex flex-col gap-0.5">
                            <span className="text-[11px] text-[#7B7A79] font-medium truncate">
                                Active Time
                            </span>
                            <span className="text-[16px] font-semibold text-amber-400 mt-0.5">
                                {telemetry?.durationMinutes != null
                                    ? `${telemetry.durationMinutes}m`
                                    : '--'}
                            </span>
                        </div>
                    </div>

                    {/* insights from backend (if any) */}
                    {insights.length > 0 && (
                        <div className="flex flex-col gap-2">
                            <h3 className="text-[11px] font-semibold text-[#8F8E8D] uppercase tracking-wider">
                                Live Insights & Activity
                            </h3>
                            <div className="flex flex-col gap-2">
                                {insights.map((insight: any, index: number) => (
                                    <div
                                        key={index}
                                        className="bg-white/[0.02] border border-white/5 p-3 rounded-lg flex flex-col gap-1 text-[13px] text-[#D6D5C9]"
                                    >
                                        <span className="text-[12px] font-semibold text-white/90">
                                            {insight.title || 'Insight'}
                                        </span>
                                        <p className="text-[12px] text-[#A3A2A0] leading-normal">
                                            {insight.message || JSON.stringify(insight)}
                                        </p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* focus areas */}
                    <div className="flex flex-col gap-2">
                        <h4 className="text-[11px] font-semibold text-[#8F8E8D] uppercase tracking-wider">
                            Key Focus Areas
                        </h4>
                        <div className="flex flex-wrap gap-1.5">
                            {getFocusAreas().map((area) => (
                                <span
                                    key={area}
                                    className="rounded-md border border-[#383736] bg-[#242323] px-2 py-0.5 text-[11px] font-medium text-[#A3A2A0]"
                                >
                                    {area}
                                </span>
                            ))}
                        </div>
                    </div>

                    {/* recommendations / tips */}
                    <div className="bg-amber-500/5 border border-amber-500/20 p-4 rounded-xl flex gap-3">
                        <Icons.Sparkles className="w-5 h-5 text-amber-400 shrink-0 mt-0.5 animate-pulse" />
                        <div className="flex flex-col gap-1">
                            <span className="text-[13px] font-semibold text-amber-300">
                                Smart Recommendation
                            </span>
                            <p className="text-[12px] text-neutral-400 leading-normal">
                                Keep this session active to capture context. Commit your changes via
                                pull request or sync with GitHub using settings to preserve history.
                            </p>
                        </div>
                    </div>

                    {/* close button */}
                    <div className="mt-2 flex items-center justify-end">
                        <button
                            type="button"
                            onClick={onClose}
                            className="bg-white text-black hover:bg-[#D6D5C9] active:scale-95 transition-all text-[13px] font-semibold px-6 py-2 rounded-lg focus:outline-none"
                        >
                            Done
                        </button>
                    </div>
                </div>
            )}
        </Modal>
    )
}
