import React, { useState, useRef, useEffect, useCallback } from 'react'

import { useTypewriter } from '../hooks/useTypewriter'

import { PromptInputPlaceholder } from './PromptInputPlaceholder'

import type { PromptInputProps } from '@/features/home/types'

import { PromptFooter } from '@/shared/components/ui/PromptFooter'

const PromptInput: React.FC<PromptInputProps> = ({
    onSubmit,
    isLoading,
    placeholder,
    minimized = false,
    onUpload,
    value,
    onChange,
    isAuthenticated,
    onOpenAuth,
}) => {
    const [internalInput, setInternalInput] = useState('')
    const textareaRef = useRef<HTMLTextAreaElement>(null)
    const voiceBaseRef = useRef('')
    const isVoiceActiveRef = useRef(false)

    const isControlled = value !== undefined
    const input = isControlled ? value : internalInput
    const displayText = useTypewriter({ minimized, placeholder })
    const shouldShowPlaceholder = !input && !minimized && !placeholder

    const handleAuthCheck = (action: () => void) => {
        if (!isAuthenticated && onOpenAuth) {
            onOpenAuth()
            return
        }
        action()
    }

    const handleInputChange = (val: string) => {
        if (!isControlled) {
            setInternalInput(val)
        }
        onChange?.(val)
    }

    useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto'
            const scrollHeight = textareaRef.current.scrollHeight
            textareaRef.current.style.height = `${Math.min(scrollHeight, 200)}px`
            textareaRef.current.style.overflowY = scrollHeight >= 200 ? 'auto' : 'hidden'
        }
    }, [input])

    const handleSubmit = (event?: React.FormEvent) => {
        event?.preventDefault()
        handleAuthCheck(() => {
            if (!input?.trim() || isLoading) return
            onSubmit(input)
            if (!isControlled) setInternalInput('')
            onChange?.('')
            if (textareaRef.current) textareaRef.current.style.height = 'auto'
        })
    }

    const handleKeyDown = (event: React.KeyboardEvent) => {
        if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault()
            handleSubmit()
        }
    }

    const handleVoiceTranscript = useCallback(
        (text: string) => {
            if (!isVoiceActiveRef.current) {
                // First transcript — capture what's currently in the input as the base
                voiceBaseRef.current = isControlled ? value || '' : internalInput
                isVoiceActiveRef.current = true
            }
            const base = voiceBaseRef.current
            const separator = base && !base.endsWith(' ') ? ' ' : ''
            const newValue = base + separator + text
            handleInputChange(newValue)
        },
        [isControlled, value, internalInput]
    )

    const handleVoiceStateChange = useCallback((isListening: boolean) => {
        if (!isListening) {
            isVoiceActiveRef.current = false
        }
    }, [])

    return (
        <div
            className={`relative w-full transition-all duration-300 ${minimized ? 'max-w-full' : 'max-w-3xl'}`}
        >
            <div
                className={`
        relative group rounded-[17px] bg-[#1F1F1F] border border-[#363534]
        focus-within:border-white/10 focus-within:bg-[#1F1F1F]
        transition-all duration-300 ease-out flex flex-col
      `}
            >
                <PromptInputPlaceholder
                    shouldShow={shouldShowPlaceholder}
                    displayText={displayText}
                />

                <div className="flex items-start w-full relative rounded-t-[16px] overflow-hidden">
                    <textarea
                        ref={textareaRef}
                        value={input}
                        onChange={(event) => handleInputChange(event.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder={
                            minimized || placeholder ? placeholder || 'Ask a follow-up...' : ''
                        }
                        className={`
                w-full bg-transparent text-[#D6D5D4] placeholder-[#949494] caret-white
                resize-none focus:outline-none z-10 font-sans font-medium leading-relaxed
                [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-white/10 hover:[&::-webkit-scrollbar-thumb]:bg-white/20
                ${minimized ? 'py-4 pl-5 pr-12 min-h-[54px]' : 'pt-[17px] pl-5 pr-12 pb-3 min-h-[93px] text-[15px]'}
              `}
                        rows={minimized ? 1 : 2}
                    />
                </div>

                <PromptFooter
                    onUpload={() => handleAuthCheck(() => onUpload?.())}
                    onSubmit={() => handleSubmit()}
                    hasInput={!!input?.trim()}
                    isLoading={isLoading}
                    onVoiceTranscript={handleVoiceTranscript}
                    onVoiceStateChange={handleVoiceStateChange}
                    isAuthenticated={isAuthenticated}
                    onOpenAuth={onOpenAuth}
                />
            </div>
        </div>
    )
}

export default PromptInput
