import { useQuery } from '@tanstack/react-query'
import React, { useRef, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { Icons } from './Icons'

import { billingAPI } from '@/features/billing/api/billing'
import { useVoiceToText } from '@/shared/lib/useVoiceToText'
import { cn } from '@/shared/lib/utils'

interface PromptFooterProps {
    onUpload: () => void
    onSubmit: () => void
    hasInput: boolean
    isLoading: boolean
    onVoiceTranscript?: (text: string) => void
    onVoiceStateChange?: (isListening: boolean) => void
    isAuthenticated?: boolean
    onOpenAuth?: () => void
}

export const PromptFooter: React.FC<PromptFooterProps> = ({
    onUpload,
    onSubmit,
    hasInput,
    isLoading,
    onVoiceTranscript,
    onVoiceStateChange,
    isAuthenticated,
    onOpenAuth,
}) => {
    const navigate = useNavigate()
    const [isModelSelectorOpen, setIsModelSelectorOpen] = useState(false)
    const [selectedModel, setSelectedModel] = useState('Auto')
    const selectorRef = useRef<HTMLDivElement>(null)

    const { isListening, isSupported, volume, toggleListening } = useVoiceToText({
        onTranscript: (text) => {
            onVoiceTranscript?.(text)
        },
    })

    useEffect(() => {
        onVoiceStateChange?.(isListening)
    }, [isListening, onVoiceStateChange])

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
                                            if (model.id !== 'Auto' && !isPro) {
                                                if (!isAuthenticated) {
                                                    onOpenAuth?.()
                                                    setIsModelSelectorOpen(false)
                                                    return
                                                }
                                                navigate('/profile/billing')
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
                                            {!isPro && model.id !== 'Auto' && (
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
            </div>

            <div className="flex items-center gap-3">
                {isSupported && (
                    <button
                        type="button"
                        onClick={() => {
                            if (!isAuthenticated) {
                                onOpenAuth?.()
                                return
                            }
                            toggleListening()
                        }}
                        className={cn(
                            'flex items-center justify-center w-8 h-8 rounded-full transition-all',
                            isListening
                                ? 'bg-white/10 text-white'
                                : 'text-[#727272] hover:bg-white/5 hover:text-white'
                        )}
                        title={isListening ? 'Stop listening' : 'Voice input'}
                    >
                        <Icons.Microphone className="w-[14px] h-[14px] stroke-[2.5px] relative z-10" />
                    </button>
                )}
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
                        <Icons.ArrowRight className="w-4 h-4 stroke-[2px]" />
                    )}
                </button>
            </div>
        </div>
    )
}
