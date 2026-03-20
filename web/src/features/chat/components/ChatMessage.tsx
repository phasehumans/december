import React from 'react'
import { motion } from 'framer-motion'
import { ChatMessageActions } from './ChatMessageActions'
import { ChatMessageAssistantMeta } from './ChatMessageAssistantMeta'
import { ChatMessageUserBubble } from './ChatMessageUserBubble'
import type { ChatMessageProps } from '@/features/chat/types'

const renderContent = (content: string) => {
    const sections = content
        .split(/\n\s*\n/)
        .map((section) => section.trim())
        .filter(Boolean)

    return sections.map((section, index) => {
        const lines = section
            .split('\n')
            .map((line) => line.trim())
            .filter(Boolean)

        const isBulletSection = lines.length > 0 && lines.every((line) => line.startsWith('- '))

        if (isBulletSection) {
            return (
                <ul key={`section-${index}`} className="mt-1 space-y-2">
                    {lines.map((line, bulletIndex) => (
                        <li
                            key={`bullet-${bulletIndex}`}
                            className="flex items-start gap-2 text-[12px] leading-5 text-[#B7B6B5]"
                        >
                            <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-[#6D6C6B]" />
                            <span>{line.slice(2).trim()}</span>
                        </li>
                    ))}
                </ul>
            )
        }

        return (
            <p
                key={`section-${index}`}
                className="text-sm leading-6 text-[#D1D0CF]"
            >
                {section}
            </p>
        )
    })
}

export const ChatMessage: React.FC<ChatMessageProps> = ({
    role,
    content,
    isGenerating,
    status = 'done',
}) => {
    const [feedback, setFeedback] = React.useState<'like' | 'dislike' | null>(null)

    if (role === 'user') {
        return <ChatMessageUserBubble content={content} />
    }

    const showActions = !isGenerating && status === 'done'
    const hasContent = content.trim().length > 0

    return (
        <div className="flex flex-col gap-2 animate-in fade-in duration-500 font-sans">
            <motion.div
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: 0.06 }}
                className="pl-1 space-y-3"
            >
                <ChatMessageAssistantMeta status={status} />

                {hasContent && <div className="space-y-3">{renderContent(content)}</div>}

                {showActions && (
                    <ChatMessageActions feedback={feedback} onFeedbackChange={setFeedback} />
                )}
            </motion.div>
        </div>
    )
}
