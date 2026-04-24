import React, { useRef, useEffect, useState } from 'react'
import { ArrowUp, MousePointer2, X, Mic, Plus, Wand2 } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

import { cn } from '@/shared/lib/utils'
import type { ChatPromptInputProps } from '@/features/chat/types'

export const ChatPromptInput: React.FC<ChatPromptInputProps> = ({
    value,
    onChange,
    onSubmit,
    isVisualMode,
    onToggleVisualMode,
    selectedElement,
    onClearSelection,
    isApplyingEdit,
}) => {
    const textareaRef = useRef<HTMLTextAreaElement>(null)
    const [isMicActive, setIsMicActive] = useState(false)

    // Auto-resize textarea
    useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto'
            textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`
        }
    }, [value])

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            if (value.trim()) onSubmit()
        }
    }

    return (
        <div className="p-2 bg-[#171615] shrink-0 z-30">
            <div
                className={cn(
                    'w-full bg-[#1E1D1C] rounded-[17px] border border-[#363534] transition-all relative overflow-hidden group flex flex-col focus-within:border-neutral-500'
                )}
            >
                {/* Integrated Selected Element Display */}
                <AnimatePresence>
                    {selectedElement && (
                        <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="overflow-hidden border-b border-[#27272A] bg-white/[0.02]"
                        >
                            <div className="flex items-center gap-2 px-3 py-2">
                                <span className="text-[9px] font-bold bg-white/10 text-white border border-white/10 px-1.5 py-0.5 rounded uppercase tracking-wider">
                                    {selectedElement.tagName}
                                </span>
                                <span className="text-xs text-neutral-300 truncate max-w-[200px] font-medium">
                                    {selectedElement.textContent}
                                </span>
                                <button
                                    onClick={onClearSelection}
                                    className="ml-auto rounded-full hover:bg-white/10 p-1 text-neutral-400 hover:text-white"
                                >
                                    <X size={12} />
                                </button>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                <textarea
                    ref={textareaRef}
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={selectedElement ? 'Describe changes...' : 'Ask PhaseHumans...'}
                    className="w-full bg-transparent text-[15px] text-neutral-200 text-left pl-5 pr-5 py-3.5 min-h-[52px] max-h-[200px] resize-none outline-none placeholder-neutral-500 font-medium leading-relaxed scrollbar-hide caret-white"
                    rows={1}
                />

                <div className="flex items-center justify-between px-2 pb-2">
                    <div className="flex items-center gap-2">
                        <button
                            className="p-1 rounded-full text-[#727272] hover:text-white hover:bg-white/5 transition-all"
                            title="Add attachment"
                        >
                            <Plus size={18} strokeWidth={2.5} />
                        </button>
                        <button
                            onClick={onToggleVisualMode}
                            className={cn(
                                'flex items-center px-3 py-1.5 rounded-full text-xs font-medium transition-all select-none border border-dashed hidden md:flex',
                                isVisualMode
                                    ? 'bg-white/10 text-white border-neutral-500'
                                    : 'text-[#727272] border-[#363534] hover:text-white hover:border-neutral-500'
                            )}
                        >
                            <span>Visual Edits</span>
                        </button>
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={() => setIsMicActive(!isMicActive)}
                            className={cn(
                                'p-2 rounded-full hover:bg-white/5 transition-all',
                                isMicActive ? 'text-[#FFFFFF]' : 'text-[#727272] hover:text-white'
                            )}
                            title="Voice input"
                        >
                            <Mic size={18} strokeWidth={2.5} />
                        </button>
                        <button
                            onClick={onSubmit}
                            className={`
                                flex items-center justify-center w-8 h-8 rounded-full transition-colors duration-200
                                ${
                                    value.trim() && !isApplyingEdit
                                        ? 'bg-[#D6D5D4] text-black'
                                        : 'bg-[#2C2C2E] text-[#4A4A4A] cursor-not-allowed'
                                }
                            `}
                        >
                            <ArrowUp size={18} strokeWidth={2.5} />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}
