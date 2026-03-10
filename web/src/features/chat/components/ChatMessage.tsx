import React from 'react'
import { motion } from 'framer-motion'
import { ThumbsUp, ThumbsDown, RotateCcw, Pen, CheckCircle2 } from 'lucide-react'
import { Button } from '@/shared/components/ui/Button'
import { cn } from '@/shared/lib/utils'
import type { ChatMessageProps } from '@/features/chat/types'

const ChatAction = ({
    icon: Icon,
    onClick,
    title,
    isActive,
}: {
    icon: any
    onClick?: () => void
    title: string
    isActive?: boolean
}) => (
    <button
        onClick={onClick}
        className={cn(
            'p-1.5 rounded-md transition-colors',
            isActive ? 'text-white' : 'text-[#91908F] hover:text-white'
        )}
        title={title}
    >
        <Icon size={14} className={cn('transition-colors', isActive && 'fill-white')} />
    </button>
)

export const ChatMessage: React.FC<ChatMessageProps> = ({
    role,
    content,
    isGenerating,
    executionTime,
    index,
}) => {
    const [feedback, setFeedback] = React.useState<'like' | 'dislike' | null>(null)

    if (role === 'user') {
        return (
            <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="group flex flex-col items-start gap-1 font-sans"
            >
                <div className="text-[10px] text-[#91908F] font-medium ml-1 uppercase tracking-wide">
                    User
                </div>
                <div className="text-neutral-100 text-[14px] font-medium leading-relaxed selection:bg-white/20">
                    {content}
                </div>
            </motion.div>
        )
    }

    return (
        <div className="flex flex-col gap-2 animate-in fade-in duration-500 font-sans">
            {!isGenerating && (
                <motion.div
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, delay: 0.1 }}
                    className="pl-1 space-y-2"
                >
                    <div className="flex items-center gap-2 mb-1">
                        <span className="text-[10px] text-[#91908F] font-medium uppercase tracking-wide">
                            PhaseHumans
                        </span>
                        <span className="text-[10px] text-[#525150] font-medium">•</span>
                        <span className="text-[10px] text-[#525150] font-medium">
                            Ran for {executionTime}s
                        </span>
                    </div>

                    {/* Edited Files Section - Only show for the first assistant message for demo */}
                    {index === 1 && (
                        <div className="mt-2 mb-3 pl-1">
                            <div className="flex items-center gap-2 text-[#91908F] mb-1.5">
                                <Pen size={10} />
                                <span className="text-[11px] font-medium">Edited 3 files</span>
                            </div>
                            <div className="bg-[#1C1C1C] border border-white/5 rounded-lg overflow-hidden w-full max-w-md">
                                <div className="flex items-center justify-between px-3 py-1.5 border-b border-white/5 hover:bg-white/5 transition-colors group/file cursor-default">
                                    <span className="text-[11px] text-[#D4D4D8] font-mono opacity-80 group-hover/file:opacity-100 transition-opacity truncate">
                                        src/App.tsx
                                    </span>
                                    <CheckCircle2
                                        size={12}
                                        className="text-emerald-500 shrink-0 ml-2"
                                    />
                                </div>
                                <div className="flex items-center justify-between px-3 py-1.5 border-b border-white/5 hover:bg-white/5 transition-colors group/file cursor-default">
                                    <span className="text-[11px] text-[#D4D4D8] font-mono opacity-80 group-hover/file:opacity-100 transition-opacity truncate">
                                        src/components/TodoList.tsx
                                    </span>
                                    <CheckCircle2
                                        size={12}
                                        className="text-emerald-500 shrink-0 ml-2"
                                    />
                                </div>
                                <div className="flex items-center justify-between px-3 py-1.5 hover:bg-white/5 transition-colors group/file cursor-default">
                                    <span className="text-[11px] text-[#D4D4D8] font-mono opacity-80 group-hover/file:opacity-100 transition-opacity truncate">
                                        src/styles/globals.css
                                    </span>
                                    <CheckCircle2
                                        size={12}
                                        className="text-emerald-500 shrink-0 ml-2"
                                    />
                                </div>
                            </div>
                        </div>
                    )}

                    <div
                        className="text-[14px] text-[#D4D4D8] leading-7 font-medium selection:bg-blue-500/20"
                        dangerouslySetInnerHTML={{ __html: content }}
                    />

                    {/* Chat Actions */}
                    <div className="flex items-center justify-between pt-3 mt-2">
                        <div className="flex items-center gap-2">
                            <ChatAction
                                icon={ThumbsUp}
                                title="Helpful"
                                isActive={feedback === 'like'}
                                onClick={() => setFeedback(feedback === 'like' ? null : 'like')}
                            />
                            <ChatAction
                                icon={ThumbsDown}
                                title="Not Helpful"
                                isActive={feedback === 'dislike'}
                                onClick={() =>
                                    setFeedback(feedback === 'dislike' ? null : 'dislike')
                                }
                            />
                        </div>

                        <div className="flex items-center gap-3">
                            <Button
                                variant="secondary"
                                size="sm"
                                className="h-7 text-xs gap-1.5 bg-[#27272A] hover:bg-[#3F3F46] text-[#D4D4D8] border border-white/5 rounded-lg px-3"
                            >
                                <RotateCcw size={12} />
                                Restore
                            </Button>
                        </div>
                    </div>
                </motion.div>
            )}
        </div>
    )
}
