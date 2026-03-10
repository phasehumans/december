import React from 'react'

interface ChatMessageAssistantMetaProps {
    executionTime: number
}

export const ChatMessageAssistantMeta: React.FC<ChatMessageAssistantMetaProps> = ({
    executionTime,
}) => {
    return (
        <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] text-[#91908F] font-medium uppercase tracking-wide">
                PhaseHumans
            </span>
            <span className="text-[10px] text-[#525150] font-medium">�</span>
            <span className="text-[10px] text-[#525150] font-medium">Ran for {executionTime}s</span>
        </div>
    )
}
