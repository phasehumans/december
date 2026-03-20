import React from 'react'

interface ChatMessageAssistantMetaProps {
    executionTime: number
    status?: 'thinking' | 'planning' | 'done' | 'error'
}

const STATUS_LABELS = {
    thinking: 'Thinking',
    planning: 'Planning',
    done: 'Done',
    error: 'Error',
} as const

export const ChatMessageAssistantMeta: React.FC<ChatMessageAssistantMetaProps> = ({
    executionTime,
    status = 'done',
}) => {
    const isStreamingStatus = status === 'thinking' || status === 'planning'

    return (
        <div className="flex items-center gap-2 mb-1 text-[10px] font-medium uppercase tracking-wide">
            <span className="text-[#91908F]">PhaseHumans</span>
            <span className="text-[#525150]">•</span>

            <span className="flex items-center gap-1.5 text-[#7D7C7B]">
                {isStreamingStatus && <span className="h-1.5 w-1.5 rounded-full bg-[#D6B36A] animate-pulse" />}
                <span className={isStreamingStatus ? 'animate-pulse' : ''}>
                    {STATUS_LABELS[status]}
                    {isStreamingStatus ? '...' : ''}
                </span>
            </span>

            {isStreamingStatus && <span className="text-[#525150]">{executionTime.toFixed(1)}s</span>}
        </div>
    )
}
