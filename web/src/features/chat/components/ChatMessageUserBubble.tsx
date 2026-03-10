import React from 'react'
import { motion } from 'framer-motion'

interface ChatMessageUserBubbleProps {
    content: string
}

export const ChatMessageUserBubble: React.FC<ChatMessageUserBubbleProps> = ({ content }) => {
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
