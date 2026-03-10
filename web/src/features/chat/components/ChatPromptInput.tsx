import React, { useRef, useEffect } from 'react'
import { ArrowUp, MousePointer2, X } from 'lucide-react'
import { cn } from '@/shared/lib/utils'
import { motion, AnimatePresence } from 'framer-motion'
import { Button } from '@/shared/components/ui/Button'
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
        <div className="p-2 bg-[#1F1F1F] shrink-0 z-30">
            <div
                className={cn(
                    'w-full bg-[#242322] rounded-[17px] border border-[#363534] transition-all shadow-lg relative overflow-hidden group flex flex-col focus-within:border-neutral-500'
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
                    className="w-full bg-transparent text-[15px] text-neutral-200 pl-5 pr-12 py-3 min-h-[54px] max-h-[200px] resize-none outline-none placeholder-neutral-500 font-medium leading-relaxed scrollbar-hide caret-white"
                    rows={1}
                />

                <div className="flex items-center justify-between px-2 pb-2">
                    <div className="flex items-center gap-1">
                        <button
                            onClick={onToggleVisualMode}
                            className={cn(
                                'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all select-none border hidden md:flex',
                                isVisualMode
                                    ? 'bg-white text-black border-white'
                                    : 'text-neutral-400 border-transparent hover:text-white hover:bg-white/5'
                            )}
                        >
                            <MousePointer2 size={14} />
                            <span>Visual edits</span>
                        </button>
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            onClick={onSubmit}
                            disabled={!value.trim() && !isApplyingEdit}
                            className={cn(
                                'p-2 rounded-full transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed',
                                value.trim() && !isApplyingEdit
                                    ? 'bg-white text-black hover:bg-neutral-200'
                                    : 'bg-[#27272A] text-neutral-500'
                            )}
                        >
                            <ArrowUp size={18} strokeWidth={2.5} />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}
