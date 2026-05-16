import React, { useState, useRef, useEffect } from 'react'

import { Icons } from './Icons'

import { cn } from '@/shared/lib/utils'

interface PromptFooterProps {
    onUpload: () => void
    onSubmit: () => void
    hasInput: boolean
    isLoading: boolean
}

export const PromptFooter: React.FC<PromptFooterProps> = ({
    onUpload,
    onSubmit,
    hasInput,
    isLoading,
}) => {
    const [isMicActive, setIsMicActive] = useState(false)
    const [isModelSelectorOpen, setIsModelSelectorOpen] = useState(false)
    const [selectedModel, setSelectedModel] = useState('Auto')
    const selectorRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (selectorRef.current && !selectorRef.current.contains(e.target as Node)) {
                setIsModelSelectorOpen(false)
            }
        }
        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])

    const models = [
        { id: 'Auto', name: 'Auto', desc: 'Best model for your task', icon: null },
        {
            id: 'Claude 4.7 Opus',
            name: 'Claude 4.7 Opus',
            desc: "Anthropic's Most Capable Model",
            icon: Icons.Claude,
        },
        {
            id: 'Claude 4.6 Sonnet',
            name: 'Claude 4.6 Sonnet',
            desc: "Anthropic's Latest Model",
            icon: Icons.Claude,
        },
        { id: 'GPT 5.5', name: 'GPT 5.5', desc: "OpenAI's Latest Model", icon: Icons.OpenAI },
        {
            id: 'GPT 5.4 - 1M',
            name: 'GPT 5.4 - 1M',
            desc: '1 Million Context',
            icon: Icons.OpenAI,
            badge: 'Pro',
        },
        {
            id: 'Gemini 1.5 Pro',
            name: 'Gemini 1.5 Pro',
            desc: "Google's Latest Model",
            icon: Icons.Gemini,
        },
        {
            id: 'DeepSeek V3',
            name: 'DeepSeek V3',
            desc: 'Powerful Open Source',
            icon: Icons.Deepseek,
        },
    ]

    const selectedModelData = models.find((m) => m.id === selectedModel) || models[0]

    return (
        <div className="flex items-center justify-between px-3 pb-3 mt-1 pl-3 relative">
            <div className="flex items-center gap-3">
                <button
                    onClick={onUpload}
                    className="flex items-center justify-center w-8 h-8 rounded-full text-[#727272] transition-all hover:bg-white/5 hover:text-white"
                    title="Add attachment"
                >
                    <Icons.Plus className="w-[18px] h-[18px] stroke-[2.5px]" />
                </button>

                <div className="relative" ref={selectorRef}>
                    <button
                        onClick={() => setIsModelSelectorOpen(!isModelSelectorOpen)}
                        className={cn(
                            'flex items-center gap-2 px-2.5 py-1 rounded-full transition-colors outline-none bg-[#2B2A29]',
                            isModelSelectorOpen ? 'text-white' : 'text-[#8F8E8D] hover:text-white'
                        )}
                    >
                        <span className="text-[12px] font-medium">{selectedModelData.name}</span>
                        <Icons.ChevronDown
                            className={cn(
                                'w-[11px] h-[11px] transition-transform',
                                isModelSelectorOpen ? 'rotate-180' : 'rotate-0'
                            )}
                        />
                    </button>

                    {isModelSelectorOpen && (
                        <div className="absolute top-[calc(100%+8px)] left-0 w-[240px] bg-[#1E1D1C] border border-white/[0.08] rounded-xl p-1 shadow-2xl z-50 flex flex-col gap-[2px]">
                            {models.map((model) => {
                                const isSelected = selectedModel === model.id
                                return (
                                    <button
                                        key={model.id}
                                        onClick={() => {
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
                                        <span className="text-[13px] font-medium truncate">
                                            {model.name}
                                        </span>
                                        {isSelected && (
                                            <Icons.Check className="w-4 h-4 text-[#D6D5D4] shrink-0" />
                                        )}
                                    </button>
                                )
                            })}
                        </div>
                    )}
                </div>
            </div>

            <div className="flex items-center gap-3">
                <button
                    type="button"
                    onClick={() => setIsMicActive(!isMicActive)}
                    className={`flex items-center justify-center w-8 h-8 rounded-full transition-all ${
                        isMicActive
                            ? 'bg-white/10 text-white'
                            : 'text-[#727272] hover:bg-white/5 hover:text-white'
                    }`}
                    title="Voice input"
                >
                    <Icons.Microphone className="w-[18px] h-[18px] stroke-[2.5px]" />
                </button>
                <button
                    onClick={onSubmit}
                    disabled={!hasInput || isLoading}
                    className={`
                        flex items-center justify-center w-8 h-8 rounded-full transition-colors duration-200
                        ${
                            hasInput && !isLoading
                                ? 'bg-[#D6D5D4] text-black'
                                : 'bg-[#2C2C2E] text-[#4A4A4A] cursor-not-allowed'
                        }
                    `}
                >
                    {isLoading ? (
                        <div className="w-4 h-4 border-2 border-neutral-500 border-t-neutral-800 rounded-full animate-spin" />
                    ) : (
                        <Icons.ArrowUp className="w-4 h-4 stroke-[3px]" />
                    )}
                </button>
            </div>
        </div>
    )
}
