import { motion, AnimatePresence } from 'framer-motion'
import { ArrowRight, X, Plus } from 'lucide-react'
import React, { useRef, useEffect, useCallback, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'

import type { ChatPromptInputProps } from '@/features/chat/types'

import { billingAPI } from '@/features/billing/api/billing'
import { ProUpgradeModal } from '@/features/billing/components/ProUpgradeModal'
import { Icons } from '@/shared/components/ui/Icons'
import { useVoiceToText } from '@/shared/lib/useVoiceToText'
import { cn } from '@/shared/lib/utils'

export const ChatPromptInput: React.FC<ChatPromptInputProps> = ({
    value,
    onChange,
    onSubmit,
    isVisualMode,
    onToggleVisualMode,
    selectedElement,
    onClearSelection,
    isApplyingEdit,
    selectedModel = 'Auto',
    setSelectedModel = () => {},
    isAuthenticated = true,
    onOpenAuth,
}) => {
    const navigate = useNavigate()
    const [isModelSelectorOpen, setIsModelSelectorOpen] = useState(false)
    const [isUpgradeModalOpen, setIsUpgradeModalOpen] = useState(false)
    const selectorRef = useRef<HTMLDivElement>(null)
    const textareaRef = useRef<HTMLTextAreaElement>(null)
    const voiceBaseRef = useRef('')
    const isVoiceActiveRef = useRef(false)

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (selectorRef.current && !selectorRef.current.contains(e.target as Node)) {
                setIsModelSelectorOpen(false)
            }
        }
        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])

    const { data: overview } = useQuery({
        queryKey: ['billing-overview'],
        queryFn: billingAPI.getOverview,
        staleTime: 10 * 1000,
        enabled: isAuthenticated,
    })
    const isPro = overview?.plan === 'PRO'

    const models = [
        { id: 'Auto', name: 'Auto', desc: 'Best model for your task', icon: null },
        {
            id: 'Claude Opus 4.1',
            name: 'Claude Opus 4.1',
            desc: "Anthropic's Most Capable Model",
            icon: Icons.Claude,
        },
        {
            id: 'Claude Sonnet 4',
            name: 'Claude Sonnet 4',
            desc: "Anthropic's Latest Model",
            icon: Icons.Claude,
        },
        {
            id: 'GPT-5.5',
            name: 'GPT-5.5',
            desc: "OpenAI's Latest flagship",
            icon: Icons.OpenAI,
        },
        {
            id: 'GPT-5.5 Mini',
            name: 'GPT-5.5 Mini',
            desc: "OpenAI's Fast and smart model",
            icon: Icons.OpenAI,
        },
        {
            id: 'Gemini 2.5 Pro',
            name: 'Gemini 2.5 Pro',
            desc: "Google's Advanced intelligence",
            icon: Icons.Gemini,
        },
        {
            id: 'Gemini 2.5 Flash',
            name: 'Gemini 2.5 Flash',
            desc: "Google's High-speed processing",
            icon: Icons.Gemini,
        },
        {
            id: 'DeepSeek V3',
            name: 'DeepSeek V3',
            desc: 'Powerful Open Source',
            icon: Icons.Deepseek,
        },
    ]

    const selectedModelData = models.find((m) => m.id === selectedModel) ?? models[0]!

    const handleVoiceTranscript = useCallback(
        (text: string) => {
            if (!isVoiceActiveRef.current) {
                voiceBaseRef.current = value || ''
                isVoiceActiveRef.current = true
            }
            const base = voiceBaseRef.current
            const separator = base && !base.endsWith(' ') ? ' ' : ''
            onChange(base + separator + text)
        },
        [value, onChange]
    )

    const { isListening, isSupported, volume, toggleListening } = useVoiceToText({
        onTranscript: handleVoiceTranscript,
    })

    // Reset voice base when listening stops
    useEffect(() => {
        if (!isListening) {
            isVoiceActiveRef.current = false
        }
    }, [isListening])

    // Auto-resize textarea
    useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto'
            const scrollHeight = textareaRef.current.scrollHeight
            textareaRef.current.style.height = `${Math.min(scrollHeight, 200)}px`
            textareaRef.current.style.overflowY = scrollHeight >= 200 ? 'auto' : 'hidden'
        }
    }, [value])

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            if (value.trim()) onSubmit()
        }
    }

    return (
        <div className="w-full bg-[#171615] shrink-0 z-30 flex justify-end">
            <div
                className={cn(
                    'w-full bg-[#1E1D1C] rounded-[17px] border border-[#363534] transition-all relative group flex flex-col'
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
                    placeholder={selectedElement ? 'Describe changes...' : 'Ask December...'}
                    className="w-full bg-transparent text-[13px] text-neutral-200 text-left pl-5 pr-5 py-4 min-h-[78px] max-h-[200px] resize-none outline-none placeholder-neutral-500 font-medium leading-relaxed [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-white/10 hover:[&::-webkit-scrollbar-thumb]:bg-white/20 caret-white"
                    rows={1}
                />

                <div className="flex items-center justify-between px-2 pb-2">
                    <div className="flex items-center gap-2">
                        <button
                            className="p-1 rounded-full text-[#727272] hover:text-white hover:bg-white/5 transition-all"
                            title="Add attachment"
                        >
                            <Plus size={15} strokeWidth={2.5} />
                        </button>
                        <div className="relative" ref={selectorRef}>
                            <button
                                onClick={() => setIsModelSelectorOpen(!isModelSelectorOpen)}
                                className={cn(
                                    'flex items-center gap-2 px-2 py-0.5 rounded-full transition-colors outline-none bg-[#2B2A29]',
                                    isModelSelectorOpen
                                        ? 'text-white'
                                        : 'text-[#8F8E8D] hover:text-white'
                                )}
                            >
                                <span className="text-[11px] font-medium">
                                    {selectedModelData.name}
                                </span>
                                <Icons.ChevronDown
                                    className={cn(
                                        'w-[10px] h-[10px] transition-transform',
                                        isModelSelectorOpen ? 'rotate-180' : 'rotate-0'
                                    )}
                                />
                            </button>

                            {isModelSelectorOpen && (
                                <div className="absolute bottom-[calc(100%+8px)] left-0 w-[200px] bg-[#1E1D1C] border border-white/[0.08] rounded-xl p-1.5 shadow-2xl z-50 flex flex-col gap-[4px]">
                                    {models.map((model) => {
                                        const isSelected = selectedModel === model.id
                                        const isFreeModel = model.id === 'Auto'
                                        return (
                                            <button
                                                key={model.id}
                                                onClick={() => {
                                                    if (!isFreeModel && !isPro) {
                                                        if (!isAuthenticated) {
                                                            onOpenAuth?.()
                                                            setIsModelSelectorOpen(false)
                                                            return
                                                        }
                                                        setIsUpgradeModalOpen(true)
                                                        setIsModelSelectorOpen(false)
                                                        return
                                                    }
                                                    setSelectedModel(model.id)
                                                    setIsModelSelectorOpen(false)
                                                }}
                                                className={cn(
                                                    'flex items-center justify-between px-3 py-1.5 rounded-lg text-left transition-colors outline-none',
                                                    isSelected
                                                        ? 'bg-[#252422] text-[#D6D5D4]'
                                                        : 'text-[#8F8E8D] hover:bg-[#252422] hover:text-[#D6D5D4]'
                                                )}
                                            >
                                                <div className="flex items-center gap-1.5 min-w-0">
                                                    <span className="text-[13px] font-medium truncate">
                                                        {model.name}
                                                    </span>
                                                    {!isPro && !isFreeModel && (
                                                        <span className="bg-[#D6D5C9]/10 text-[#D6D5C9] rounded-full text-[8px] font-medium px-1 py-0.5 uppercase shrink-0 select-none">
                                                            Pro
                                                        </span>
                                                    )}
                                                </div>
                                                {isSelected && (
                                                    <Icons.Check className="w-4 h-4 text-[#D6D5D4] shrink-0" />
                                                )}
                                            </button>
                                        )
                                    })}
                                </div>
                            )}
                        </div>
                        <button
                            onClick={onToggleVisualMode}
                            className={cn(
                                'flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-medium transition-all select-none border border-dashed hidden md:flex',
                                isVisualMode
                                    ? 'bg-white/10 text-white border-neutral-500'
                                    : 'text-[#727272] border-[#363534] hover:text-white hover:border-neutral-500'
                            )}
                        >
                            <span>Visual Edits</span>
                        </button>
                    </div>

                    <div className="flex items-center gap-2">
                        {isSupported && (
                            <button
                                type="button"
                                onClick={toggleListening}
                                className={cn(
                                    'flex items-center justify-center w-7 h-7 rounded-full transition-all',
                                    isListening
                                        ? 'bg-white/10 text-white'
                                        : 'text-[#727272] hover:bg-white/5 hover:text-white'
                                )}
                                title={isListening ? 'Stop listening' : 'Voice input'}
                            >
                                <Icons.Microphone className="w-[12px] h-[12px] stroke-[2.5px] relative z-10" />
                            </button>
                        )}
                        <button
                            onClick={onSubmit}
                            className={`
                                flex items-center justify-center w-7 h-7 rounded-full transition-colors duration-200
                                ${
                                    value.trim() && !isApplyingEdit
                                        ? 'bg-[#D6D5D4] text-black'
                                        : 'bg-[#2C2C2E] text-[#4A4A4A] cursor-not-allowed'
                                }
                            `}
                        >
                            <ArrowRight size={15} strokeWidth={1.8} />
                        </button>
                    </div>
                </div>
            </div>

            <ProUpgradeModal
                isOpen={isUpgradeModalOpen}
                onClose={() => setIsUpgradeModalOpen(false)}
            />
        </div>
    )
}
