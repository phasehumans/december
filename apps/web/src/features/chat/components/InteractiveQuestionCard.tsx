import { CheckCircle2, HelpCircle, Check, ArrowRight } from 'lucide-react'
import React, { useState } from 'react'

import { getSharedSocket } from '@/features/generation/api/generation'
import { sessionAPI } from '@/features/sessions/api/session'
import { cn } from '@/shared/lib/utils'

export interface QuestionItem {
    question: string
    options: string[]
    is_multi_select?: boolean
}

export interface InteractiveQuestionCardProps {
    sessionId: string
    questionId?: string
    questions: QuestionItem[]
    onAnswerSubmitted?: (answer: string | string[]) => void
    disabled?: boolean
    initialAnswer?: string | string[]
}

export const InteractiveQuestionCard: React.FC<InteractiveQuestionCardProps> = ({
    sessionId,
    questionId,
    questions,
    onAnswerSubmitted,
    disabled = false,
    initialAnswer,
}) => {
    const [selectedAnswers, setSelectedAnswers] = useState<Record<number, string[]>>({})
    const [submittedAnswer, setSubmittedAnswer] = useState<string | string[] | null>(
        initialAnswer || null
    )
    const [isSubmitting, setIsSubmitting] = useState(false)

    const isAnswered = Boolean(submittedAnswer) || disabled

    const handleOptionClick = async (qIdx: number, option: string, isMulti?: boolean) => {
        if (isAnswered || isSubmitting) return

        if (isMulti) {
            const current = selectedAnswers[qIdx] || []
            const exists = current.includes(option)
            const updated = exists ? current.filter((o) => o !== option) : [...current, option]
            setSelectedAnswers((prev) => ({ ...prev, [qIdx]: updated }))
            return
        }

        // Single select: immediate selection and submission
        setSelectedAnswers((prev) => ({ ...prev, [qIdx]: [option] }))
        await submitFinalAnswer(option)
    }

    const submitFinalAnswer = async (answerPayload: string | string[]) => {
        setIsSubmitting(true)
        try {
            // 1. Submit via WebSocket if connected
            try {
                const socket = getSharedSocket()
                if (socket && socket.connected) {
                    socket.emit('QUESTION_ANSWER', {
                        sessionId,
                        questionId,
                        answer: answerPayload,
                    })
                }
            } catch {
                // Intentionally swallowed: Socket unavailable fallback
            }

            // 2. Submit via HTTP API for guaranteed delivery
            await sessionAPI
                .submitQuestionAnswer({
                    sessionId,
                    questionId,
                    answer: answerPayload,
                })
                .catch(() => {
                    // Intentionally swallowed: HTTP fallback handled if socket already delivered
                })

            setSubmittedAnswer(answerPayload)
            onAnswerSubmitted?.(answerPayload)
        } finally {
            setIsSubmitting(false)
        }
    }

    const handleMultiSubmit = async (qIdx: number) => {
        const selected = selectedAnswers[qIdx] || []
        if (selected.length === 0 || isAnswered || isSubmitting) return
        await submitFinalAnswer(selected)
    }

    const formatSubmittedText = (ans: string | string[]) => {
        if (Array.isArray(ans)) return ans.join(', ')
        return String(ans)
    }

    return (
        <div className="my-2 p-3.5 rounded-xl border border-[#2A2A2D] bg-[#161618] text-[#EDEDEF] font-sans shadow-lg space-y-3.5">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-[#2A2A2D]/70 pb-2.5">
                <div className="flex items-center gap-2 text-[#87B2F4]">
                    <HelpCircle size={16} />
                    <span className="text-[12px] font-semibold tracking-wide uppercase text-white">
                        Agent Clarification
                    </span>
                </div>

                {isAnswered ? (
                    <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[11px] font-medium">
                        <CheckCircle2 size={12} />
                        <span>Response Delivered: {formatSubmittedText(submittedAnswer!)}</span>
                    </div>
                ) : (
                    <div className="px-2 py-0.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-[10.5px] font-medium tracking-wide">
                        Waiting for user input
                    </div>
                )}
            </div>

            {/* Questions list */}
            <div className="space-y-4">
                {questions.map((q, qIdx) => {
                    const currentSelected = selectedAnswers[qIdx] || []
                    const isMulti = Boolean(q.is_multi_select)

                    return (
                        <div key={qIdx} className="space-y-2">
                            <p className="text-[13px] font-medium text-[#EDEDEF] leading-snug">
                                {q.question}
                            </p>

                            <div className="grid grid-cols-1 gap-1.5 pt-0.5">
                                {q.options.map((rawOpt, optIdx) => {
                                    const isRecommended = rawOpt.startsWith('(Recommended)')
                                    const cleanLabel = rawOpt.replace(/^\(Recommended\)\s*/, '')
                                    const isSelected =
                                        currentSelected.includes(rawOpt) ||
                                        (isAnswered &&
                                            (Array.isArray(submittedAnswer)
                                                ? submittedAnswer.includes(rawOpt) ||
                                                  submittedAnswer.includes(cleanLabel)
                                                : submittedAnswer === rawOpt ||
                                                  submittedAnswer === cleanLabel))

                                    return (
                                        <button
                                            key={optIdx}
                                            type="button"
                                            disabled={isAnswered || isSubmitting}
                                            onClick={() => handleOptionClick(qIdx, rawOpt, isMulti)}
                                            className={cn(
                                                'flex items-center justify-between w-full px-3 py-2 rounded-lg border text-left transition-all',
                                                isAnswered
                                                    ? isSelected
                                                        ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                                                        : 'bg-[#1C1C1E]/50 border-white/5 text-[#8E8D8C] opacity-60'
                                                    : isSelected
                                                      ? 'bg-[#2A2A2D] border-[#87B2F4] text-white shadow-sm'
                                                      : 'bg-[#1C1C1E] border-white/5 text-[#EDEDEF] hover:bg-[#242427] hover:border-white/10 cursor-pointer'
                                            )}
                                        >
                                            <div className="flex items-center gap-2.5 min-w-0 pr-2">
                                                <div
                                                    className={cn(
                                                        'w-4 h-4 rounded flex items-center justify-center shrink-0 border transition-colors',
                                                        isMulti ? 'rounded-md' : 'rounded-full',
                                                        isSelected
                                                            ? isAnswered
                                                                ? 'bg-emerald-500 border-emerald-500 text-black'
                                                                : 'bg-[#87B2F4] border-[#87B2F4] text-black'
                                                            : 'border-[#4A4948] bg-transparent'
                                                    )}
                                                >
                                                    {isSelected && (
                                                        <Check size={11} strokeWidth={3} />
                                                    )}
                                                </div>

                                                <span className="text-[12.5px] truncate font-sans">
                                                    {cleanLabel}
                                                </span>
                                            </div>

                                            {isRecommended && (
                                                <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-blue-500/10 text-blue-300 border border-blue-500/20 shrink-0">
                                                    Recommended
                                                </span>
                                            )}
                                        </button>
                                    )
                                })}
                            </div>

                            {/* Multi-select submit button */}
                            {isMulti && !isAnswered && (
                                <div className="pt-1 flex justify-end">
                                    <button
                                        type="button"
                                        disabled={currentSelected.length === 0 || isSubmitting}
                                        onClick={() => handleMultiSubmit(qIdx)}
                                        className={cn(
                                            'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium transition-colors',
                                            currentSelected.length > 0 && !isSubmitting
                                                ? 'bg-[#87B2F4] text-black hover:bg-[#99C0FF] cursor-pointer'
                                                : 'bg-[#2A2A2D] text-[#8E8D8C] cursor-not-allowed opacity-60'
                                        )}
                                    >
                                        <span>Submit Answer</span>
                                        <ArrowRight size={13} />
                                    </button>
                                </div>
                            )}
                        </div>
                    )
                })}
            </div>
        </div>
    )
}
