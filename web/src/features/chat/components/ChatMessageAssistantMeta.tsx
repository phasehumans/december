import React from 'react'

interface ChatMessageAssistantMetaProps {
    status?: 'thinking' | 'building' | 'done' | 'error'
}

const STATUS_LABELS = {
    thinking: 'Thinking...',
    building: 'Building...',
    done: 'Done',
    error: 'Error',
} as const

export const ChatMessageAssistantMeta: React.FC<ChatMessageAssistantMetaProps> = ({
    status = 'done',
}) => {
    const isStreamingStatus = status === 'thinking' || status === 'building'

    return (
        <div className="flex items-center gap-2 text-[11px] font-medium tracking-wide">
            <span className="text-[#8E8D8C]">December</span>
            <span className={isStreamingStatus ? 'text-[#A1A09F] animate-pulse' : 'text-[#6F6E6D]'}>
                {STATUS_LABELS[status]}
            </span>
        </div>
    )
}
