import React from 'react'

import { useMessageQueue } from '@/features/chat/messageQueue'

interface QueuedMessagesProps {
    sessionId?: string | null
    /** December works: the messages go out by themselves when the run ends */
    isWorking: boolean
}

/**
 * The messages that wait for the end of the run (#637, "Queue"), in the order they were
 * written. Each one can be removed. After a stop they wait for the user: "Send" sends one.
 */
export const QueuedMessages: React.FC<QueuedMessagesProps> = ({ sessionId, isWorking }) => {
    const queued = useMessageQueue((state) => state.queued)
    const remove = useMessageQueue((state) => state.remove)
    const sendNow = useMessageQueue((state) => state.sendNow)
    const mine = queued.filter((message) => message.sessionId === sessionId)

    if (mine.length === 0) return null

    return (
        <ul aria-label="Queued messages" className="flex flex-col gap-1.5 items-end w-full pb-2">
            {mine.map((message) => (
                <li key={message.id} className="flex flex-col gap-1 items-end w-full font-sans">
                    <div className="bg-[#1B1B1B] px-4 py-2.5 rounded-xl text-[13.5px] leading-relaxed text-[#A8A7A6] max-w-[95%] break-words whitespace-pre-wrap line-clamp-3">
                        {message.text}
                    </div>
                    <div className="flex items-center gap-2 text-[12px]">
                        <span className="bg-[#2A2928] text-[#A8A7A6] font-medium px-1.5 py-0.5 rounded-[6px]">
                            Queued
                        </span>
                        {!isWorking && (
                            <button
                                type="button"
                                onClick={() => sendNow(message.id)}
                                className="text-[#D6D5D4] hover:text-white transition-colors"
                            >
                                Send
                            </button>
                        )}
                        <button
                            type="button"
                            aria-label={`Remove queued message: ${message.text.slice(0, 40)}`}
                            onClick={() => remove(message.id)}
                            className="text-[#8F8E8D] hover:text-white transition-colors"
                        >
                            Remove
                        </button>
                    </div>
                </li>
            ))}
        </ul>
    )
}
