import React from 'react'
import { motion } from 'framer-motion'
import { ChatMessageActions } from './ChatMessageActions'
import { ChatMessageAssistantMeta } from './ChatMessageAssistantMeta'
import { ChatMessageUserBubble } from './ChatMessageUserBubble'
import type { ChatMessageProps } from '@/features/chat/types'

export const ChatMessage: React.FC<ChatMessageProps> = ({
    role,
    content,
    isGenerating,
    executionTime,
    status = 'done',
}) => {
    const [feedback, setFeedback] = React.useState<'like' | 'dislike' | null>(null)

    if (role === 'user') {
        return <ChatMessageUserBubble content={content} />
    }

    const showActions = !isGenerating && status === 'done'
    const hasContent = content.trim().length > 0
    const showStreamingCaret =
        hasContent && (status === 'thinking' || status === 'planning' || status === 'building')

    return (
        <div className="flex flex-col gap-2 animate-in fade-in duration-500 font-sans">
            <motion.div
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.1 }}
                className="pl-1 space-y-2"
            >
                <ChatMessageAssistantMeta executionTime={executionTime} status={status} />

                {hasContent && (
                    <div className="text-[14px] text-[#D4D4D8] leading-7 font-medium whitespace-pre-wrap selection:bg-blue-500/20">
                        {content}
                        {showStreamingCaret && (
                            <span className="ml-1 inline-block h-4 w-1 rounded-full bg-[#D6B36A] align-middle animate-pulse" />
                        )}
                    </div>
                )}

                {!hasContent && (
                    <div className="h-4 w-full rounded-full bg-white/[0.03]" />
                )}

                {showActions && (
                    <ChatMessageActions feedback={feedback} onFeedbackChange={setFeedback} />
                )}
            </motion.div>
        </div>
    )
}
