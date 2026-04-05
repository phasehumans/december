import React, { useState, useRef, useEffect } from 'react'

import { useTypewriter } from '../hooks/useTypewriter'

import { PromptInputPlaceholder } from './PromptInputPlaceholder'

import { PromptFooter } from '@/shared/components/ui/PromptFooter'
import type { PromptInputProps } from '@/features/home/types'

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
            textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`
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

    return (
        <div
            className={`relative w-full transition-all duration-300 ${minimized ? 'max-w-full' : 'max-w-3xl'}`}
        >
            <div
                className={`
        relative group rounded-[17px] bg-[#242322] border border-[#363534]
        focus-within:border-white/10 focus-within:bg-[#242322]
        transition-all duration-300 ease-out flex flex-col
      `}
            >
                <PromptInputPlaceholder
                    shouldShow={shouldShowPlaceholder}
                    displayText={displayText}
                />

                <div className="flex items-start w-full relative">
                    <textarea
                        ref={textareaRef}
                        value={input}
                        onChange={(event) => handleInputChange(event.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder={
                            minimized || placeholder ? placeholder || 'Ask a follow-up...' : ''
                        }
                        className={`
                w-full bg-transparent text-[#D6D5D4] caret-white
                resize-none focus:outline-none z-10 font-sans font-medium leading-relaxed
                placeholder:text-[#6C6A69]
                ${minimized ? 'py-4 pl-5 pr-12 min-h-[54px]' : 'pt-[18px] pl-5 pr-12 pb-3 min-h-[70px] text-[15px]'}
              `}
                        rows={1}
                    />
                </div>

                <PromptFooter
                    onUpload={() => handleAuthCheck(() => onUpload?.())}
                    onSubmit={() => handleSubmit()}
                    hasInput={!!input?.trim()}
                    isLoading={isLoading}
                />
            </div>
        </div>
    )
}

export default PromptInput
