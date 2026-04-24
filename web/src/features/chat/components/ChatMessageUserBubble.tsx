import React from 'react'
import { motion } from 'framer-motion'

interface ChatMessageUserBubbleProps {
    content: string
}

export const ChatMessageUserBubble: React.FC<ChatMessageUserBubbleProps> = ({ content }) => {
    return (
        <motion.div
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.06 }}
            className="flex flex-col items-end gap-1 font-sans pl-8 mb-2"
        >
            <div className="bg-[#1E1D1B] px-4 py-2.5 rounded-xl text-sm leading-relaxed text-[#EDEDED] selection:bg-blue-500/20 shadow-sm max-w-[95%] break-words whitespace-pre-wrap">
                {content}
            </div>
        </motion.div>
    )
}
