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
            className="flex flex-col gap-3 pl-1 font-sans"
        >
            <div className="text-[11px] font-medium tracking-wide text-[#8E8D8C]">You</div>
            <p className="text-sm leading-6 text-[#D1D0CF] selection:bg-blue-500/20">{content}</p>
        </motion.div>
    )
}
