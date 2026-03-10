import React from 'react'
import { motion } from 'framer-motion'
import { ChatMessageActions } from './ChatMessageActions'
import { ChatMessageAssistantMeta } from './ChatMessageAssistantMeta'
import { ChatMessageEditedFiles } from './ChatMessageEditedFiles'
import { ChatMessageUserBubble } from './ChatMessageUserBubble'
import type { ChatMessageProps } from '@/features/chat/types'

export const ChatMessage: React.FC<ChatMessageProps> = ({
    role,
    content,
    isGenerating,
    executionTime,
    index,
}) => {
    const [feedback, setFeedback] = React.useState<'like' | 'dislike' | null>(null)

    if (role === 'user') {
        return <ChatMessageUserBubble content={content} />
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
                    <ChatMessageAssistantMeta executionTime={executionTime} />
                    <ChatMessageEditedFiles isVisible={index === 1} />

                    <div
                        className="text-[14px] text-[#D4D4D8] leading-7 font-medium selection:bg-blue-500/20"
                        dangerouslySetInnerHTML={{ __html: content }}
                    />

                    <ChatMessageActions feedback={feedback} onFeedbackChange={setFeedback} />
                </motion.div>
            )}
        </div>
    )
}
