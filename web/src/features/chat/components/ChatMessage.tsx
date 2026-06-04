import { motion, AnimatePresence } from 'framer-motion'
import {
    ThumbsUp,
    ThumbsDown,
    RotateCcw,
    ChevronDown,
    CheckCircle2,
    Pen,
    Loader2,
} from 'lucide-react'
import React from 'react'

import type { ChatMessageProps } from '@/features/chat/types'

import { cn } from '@/shared/lib/utils'

const parseInlineFormatting = (text: string): React.ReactNode[] => {
    const regex = /(\*\*.*?\*\*|\*.*?\*|`.*?`)/g
    const matches = text.split(regex)

    return matches.map((part, idx) => {
        if (part.startsWith('**') && part.endsWith('**')) {
            return (
                <strong key={idx} className="font-semibold text-[#E6E4E3]">
                    {part.slice(2, -2)}
                </strong>
            )
        }
        if (part.startsWith('*') && part.endsWith('*')) {
            return (
                <em key={idx} className="italic text-[#C4C3C2]">
                    {part.slice(1, -1)}
                </em>
            )
        }
        if (part.startsWith('`') && part.endsWith('`')) {
            return (
                <code
                    key={idx}
                    className="px-1 py-0.5 rounded bg-white/5 font-mono text-[10.5px] text-[#E6E4E3]"
                >
                    {part.slice(1, -1)}
                </code>
            )
        }
        return part
    })
}

const renderRichContent = (text: string, isThoughts = false) => {
    if (!text) return null

    const lines = text.split('\n').map((l) => l.trim())
    const elements: React.ReactNode[] = []
    let currentListItems: React.ReactNode[] = []

    const flushList = (key: string | number) => {
        if (currentListItems.length > 0) {
            elements.push(
                <ul key={`ul-${key}`} className="my-1.5 space-y-1.5 pl-0.5 w-full">
                    {...currentListItems}
                </ul>
            )
            currentListItems = []
        }
    }

    lines.forEach((line, index) => {
        if (!line || line.trim().toLowerCase() === '### overview') {
            flushList(index)
            return
        }

        if (line.startsWith('### ')) {
            flushList(index)
            elements.push(
                <h3
                    key={index}
                    className="text-[12px] font-bold text-[#E6E4E3] tracking-wide mt-3 mb-1 font-sans"
                >
                    {parseInlineFormatting(line.slice(4))}
                </h3>
            )
        } else if (line.startsWith('#### ')) {
            flushList(index)
            elements.push(
                <h4
                    key={index}
                    className="text-[11.5px] font-semibold text-[#E6E4E3] mt-2 mb-1 font-sans"
                >
                    {parseInlineFormatting(line.slice(5))}
                </h4>
            )
        } else if (line.startsWith('## ')) {
            flushList(index)
            elements.push(
                <h2
                    key={index}
                    className="text-[13px] font-bold text-[#E6E4E3] tracking-wide mt-4 mb-1.5 font-sans"
                >
                    {parseInlineFormatting(line.slice(3))}
                </h2>
            )
        } else if (line.startsWith('- ') || line.startsWith('• ')) {
            currentListItems.push(
                <li
                    key={`li-${index}`}
                    className="flex items-start gap-2 text-[12px] leading-5 text-[#B7B6B5] w-full"
                >
                    <span className="mt-[8px] h-1 w-1 shrink-0 rounded-full bg-[#6D6C6B]" />
                    <span className="select-text w-full break-words">
                        {parseInlineFormatting(line.slice(2))}
                    </span>
                </li>
            )
        } else {
            flushList(index)
            const processedLine = line.replace(
                /^(\*\*Overview:\*\*|\*\*Overview\*\*|Overview:?)\s*[\-–—]?\s*/i,
                ''
            )
            elements.push(
                <p
                    key={index}
                    className={
                        isThoughts
                            ? 'text-[12px] leading-relaxed text-[#8E8D8C] whitespace-pre-wrap select-text mb-1.5'
                            : 'text-[12.5px] leading-relaxed text-[#D1D0CF] whitespace-pre-wrap select-text mb-2'
                    }
                >
                    {parseInlineFormatting(processedLine)}
                </p>
            )
        }
    })

    flushList('final')
    return <div className="space-y-1.5 w-full">{elements}</div>
}

export const ChatMessage: React.FC<ChatMessageProps> = ({
    id,
    role,
    content,
    thoughts,
    plan,
    summary,
    isGenerating,
    executionTime,
    index,
    status = 'done',
    generatedFiles,
    projectType = 'generated',
    tokensUsed,
    creditsUsed,
    modelName,
    onTriggerSimulation,
    onOpenFile,
    projectId,
}) => {
    const [feedback, setFeedback] = React.useState<'like' | 'dislike' | null>(null)
    const [isThoughtsOpen, setIsThoughtsOpen] = React.useState<boolean>(true)
    const [displayedPlan, setDisplayedPlan] = React.useState('')
    const [displayedThoughts, setDisplayedThoughts] = React.useState('')
    const [displayedSummary, setDisplayedSummary] = React.useState('')
    const hasAutoCollapsedRef = React.useRef(false)

    const isFirstImportView = projectType !== 'generated' && index === 1
    const cacheKey = `december_msg_streamed_${id}`
    const justImported = projectId
        ? sessionStorage.getItem(`december_actively_importing_${projectId}`) === 'true'
        : false
    const shouldForceStream = isFirstImportView && justImported && !sessionStorage.getItem(cacheKey)

    React.useEffect(() => {
        if (shouldForceStream) return

        if (
            (status === 'building' || status === 'done' || Boolean(plan)) &&
            !hasAutoCollapsedRef.current
        ) {
            setIsThoughtsOpen(false)
            hasAutoCollapsedRef.current = true
        }
        if (status === 'thinking' && !Boolean(plan)) {
            setIsThoughtsOpen(true)
            hasAutoCollapsedRef.current = false
        }
    }, [status, plan, shouldForceStream])

    if (role === 'user') {
        return (
            <div className="flex flex-col gap-1 items-end w-full font-sans">
                <div className="bg-[#1E1D1B] px-4 py-2.5 rounded-xl text-sm leading-relaxed text-[#EDEDED] selection:bg-blue-500/20 shadow-sm max-w-[95%] break-words whitespace-pre-wrap">
                    {content}
                </div>
            </div>
        )
    }

    const filesArray = generatedFiles ? Object.values(generatedFiles) : []
    const totalFiles = filesArray.length
    const isThinkingPhase = status === 'thinking'
    const isBuildingPhase = status === 'building'
    const isCompletedPhase = status === 'done'
    const showActions = !isGenerating && isCompletedPhase

    // Segment calculation
    const showThinking = isThinkingPhase || Boolean(thoughts)
    const thinkingText = thoughts || (isThinkingPhase && !thoughts ? content : '')

    const showPlan = Boolean(plan)
    const planText = plan || ''

    const isPlanFinished = !planText || displayedPlan.length >= planText.length
    const showFiles =
        projectType === 'generated' &&
        (isBuildingPhase || isCompletedPhase) &&
        totalFiles > 0 &&
        isPlanFinished

    const showSummary = projectType === 'generated' && Boolean(summary)
    const summaryText = summary || ''

    // For normal messages, we don't animate thoughts because SSE handles it.
    // But for forceStream messages, we simulate the thoughts streaming too.
    const activeThoughtsText = shouldForceStream ? displayedThoughts : thinkingText

    React.useEffect(() => {
        if (!shouldForceStream) {
            setDisplayedThoughts(thinkingText)
            setDisplayedPlan(planText)
            setDisplayedSummary(summaryText)
            return
        }

        let isCancelled = false

        const runStream = async () => {
            if (projectId) {
                sessionStorage.setItem(`december_import_stream_running_${projectId}`, 'true')
                window.dispatchEvent(
                    new CustomEvent('december-import-stream-start', { detail: { projectId } })
                )
            }

            // 1. Stream thoughts with accordion open
            if (thinkingText) {
                setIsThoughtsOpen(true)
                let currentThoughts = ''
                while (currentThoughts.length < thinkingText.length) {
                    if (isCancelled) return
                    const increment = Math.floor(Math.random() * 2) + 1
                    currentThoughts = thinkingText.slice(0, currentThoughts.length + increment)
                    setDisplayedThoughts(currentThoughts)
                    await new Promise((resolve) => setTimeout(resolve, 30))
                }
            }

            // Collapse the thoughts accordion
            if (isCancelled) return
            setIsThoughtsOpen(false)

            // Brief pause to let the collapse transition run before starting metadata stream
            await new Promise((resolve) => setTimeout(resolve, 350))

            // 2. Stream plan
            if (planText) {
                let currentPlan = ''
                while (currentPlan.length < planText.length) {
                    if (isCancelled) return
                    const increment = Math.floor(Math.random() * 2) + 1
                    currentPlan = planText.slice(0, currentPlan.length + increment)
                    setDisplayedPlan(currentPlan)
                    await new Promise((resolve) => setTimeout(resolve, 20))
                }
            }

            // 3. Stream summary (only if generated project)
            if (projectType === 'generated' && summaryText) {
                let currentSummary = ''
                while (currentSummary.length < summaryText.length) {
                    if (isCancelled) return
                    const increment = Math.floor(Math.random() * 2) + 1
                    currentSummary = summaryText.slice(0, currentSummary.length + increment)
                    setDisplayedSummary(currentSummary)
                    await new Promise((resolve) => setTimeout(resolve, 25))
                }
            }

            if (!isCancelled) {
                sessionStorage.setItem(cacheKey, 'true')
                if (projectId) {
                    sessionStorage.removeItem(`december_import_stream_running_${projectId}`)
                    window.dispatchEvent(
                        new CustomEvent('december-import-stream-end', { detail: { projectId } })
                    )
                }
            }
        }

        runStream()

        return () => {
            isCancelled = true
            if (projectId) {
                sessionStorage.removeItem(`december_import_stream_running_${projectId}`)
                window.dispatchEvent(
                    new CustomEvent('december-import-stream-end', { detail: { projectId } })
                )
            }
        }
    }, [thinkingText, planText, summaryText, shouldForceStream, cacheKey, projectType, projectId])

    return (
        <div className="flex flex-col gap-2 animate-in fade-in duration-500 font-sans w-full">
            <motion.div
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: 0.06 }}
                className="pl-1 flex flex-col gap-2.5"
            >
                {/* Assistant Meta */}
                <div className="flex items-center gap-2 text-[11px] font-medium tracking-wide">
                    <span className="text-[#8E8D8C]">December</span>
                    {(isThinkingPhase || isBuildingPhase || status === 'error') && (
                        <span
                            className={
                                isThinkingPhase || isBuildingPhase
                                    ? 'text-[#A1A09F] animate-pulse'
                                    : 'text-red-400'
                            }
                        >
                            {isThinkingPhase
                                ? 'Thinking...'
                                : isBuildingPhase
                                  ? 'Building...'
                                  : 'Error'}
                        </span>
                    )}
                </div>

                {/* 1. Thinking phase collapsible block */}
                {showThinking && activeThoughtsText.trim().length > 0 && (
                    <div className="space-y-1.5">
                        <button
                            type="button"
                            onClick={() => setIsThoughtsOpen(!isThoughtsOpen)}
                            className="flex items-center gap-1.5 text-[11px] text-[#8E8D8C] hover:text-[#C4C3C2] transition-colors cursor-pointer select-none"
                        >
                            <ChevronDown
                                size={12}
                                className={cn(
                                    'transition-transform duration-200',
                                    isThoughtsOpen ? 'rotate-0' : '-rotate-90'
                                )}
                            />
                            <span className="font-medium">
                                {isThinkingPhase && !plan ? 'Thinking' : 'Thoughts'}
                            </span>
                        </button>

                        <AnimatePresence initial={false}>
                            {isThoughtsOpen && (
                                <motion.div
                                    initial={{ height: 0, opacity: 0 }}
                                    animate={{ height: 'auto', opacity: 1 }}
                                    exit={{ height: 0, opacity: 0 }}
                                    transition={{ duration: 0.2 }}
                                    className="overflow-hidden"
                                >
                                    <div className="flex gap-3 pl-0.5">
                                        <div className="w-[1.5px] bg-[#2E2D2C] rounded shrink-0 self-stretch" />
                                        <div className="text-[12.5px] leading-relaxed text-[#8E8D8C] font-sans select-text py-0.5 space-y-2">
                                            {renderRichContent(activeThoughtsText, true)}
                                        </div>
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                )}

                {/* 2. Plan of Action (normal text, streamed) */}
                {showPlan && displayedPlan.trim().length > 0 && (
                    <div className="space-y-2.5 animate-in fade-in duration-300 w-full">
                        {renderRichContent(displayedPlan)}
                    </div>
                )}

                {/* 3. Edited files container */}
                {showFiles && (
                    <div className="mt-2 pl-0.5 animate-in fade-in duration-300">
                        <div className="flex items-center gap-2 text-[#91908F] mb-1.5">
                            <Pen size={10} />
                            <span className="text-[11px] font-medium">
                                {isBuildingPhase
                                    ? `Editing ${totalFiles} files`
                                    : `Edited ${totalFiles} files`}
                            </span>
                        </div>
                        <div className="bg-[#1C1C1C] border border-white/5 rounded-lg overflow-hidden w-full max-w-md">
                            {filesArray.map((file, idx) => {
                                const hasDivider = idx < filesArray.length - 1
                                const isFileBuilding = file.status === 'building'

                                return (
                                    <div
                                        key={file.path}
                                        onClick={() => onOpenFile?.(file.path)}
                                        className={cn(
                                            'flex items-center justify-between px-3 py-1.5 hover:bg-white/5 transition-colors cursor-pointer',
                                            hasDivider ? 'border-b border-white/5' : ''
                                        )}
                                    >
                                        <span className="text-[11px] text-[#D4D4D8] font-mono opacity-80 truncate">
                                            {file.path}
                                        </span>
                                        <div className="shrink-0 ml-2">
                                            {isFileBuilding ? (
                                                <Loader2
                                                    size={12}
                                                    className="text-[#91908F] animate-spin"
                                                />
                                            ) : (
                                                <CheckCircle2
                                                    size={12}
                                                    className="text-emerald-500"
                                                />
                                            )}
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    </div>
                )}

                {/* 4. Final summary (normal text, streamed) */}
                {showSummary && displayedSummary.trim().length > 0 && (
                    <div className="space-y-3 pt-1 animate-in fade-in duration-300 w-full">
                        {renderRichContent(displayedSummary)}
                    </div>
                )}

                {/* 5. Sleek white Actions Footer + Restore button */}
                {showActions && (
                    <div className="flex items-center justify-between pt-1.5 mt-1">
                        <div className="flex items-center gap-3">
                            <div className="flex items-center gap-0.5">
                                <button
                                    onClick={() => setFeedback(feedback === 'like' ? null : 'like')}
                                    className={cn(
                                        'p-1.5 rounded-md transition-colors cursor-pointer',
                                        feedback === 'like'
                                            ? 'text-white'
                                            : 'text-[#91908F] hover:text-white'
                                    )}
                                    title="Helpful"
                                >
                                    <ThumbsUp
                                        size={14}
                                        className={cn(
                                            'transition-colors',
                                            feedback === 'like' && 'fill-white'
                                        )}
                                    />
                                </button>
                                <button
                                    onClick={() =>
                                        setFeedback(feedback === 'dislike' ? null : 'dislike')
                                    }
                                    className={cn(
                                        'p-1.5 rounded-md transition-colors cursor-pointer',
                                        feedback === 'dislike'
                                            ? 'text-white'
                                            : 'text-[#91908F] hover:text-white'
                                    )}
                                    title="Not Helpful"
                                >
                                    <ThumbsDown
                                        size={14}
                                        className={cn(
                                            'transition-colors',
                                            feedback === 'dislike' && 'fill-white'
                                        )}
                                    />
                                </button>
                            </div>
                        </div>

                        <button
                            type="button"
                            className="h-7 text-xs gap-1.5 bg-[#1F1E1D] hover:bg-[#2A2928] text-[#E6E4E3] border border-white/5 rounded-lg px-3 flex items-center transition-colors cursor-pointer select-none font-medium"
                        >
                            <RotateCcw size={11} />
                            Restore
                        </button>
                    </div>
                )}
            </motion.div>
        </div>
    )
}
