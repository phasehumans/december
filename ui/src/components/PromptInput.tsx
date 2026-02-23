import React, { useState, useRef, useEffect } from 'react'
import { useTypewriter } from '../hooks/useTypewriter'
import { PromptPlaceholder } from './ui/PromptPlaceholder'
import { PromptFooter } from './ui/PromptFooter'

interface PromptInputProps {
    onSubmit: (prompt: string) => void
    isLoading: boolean
    placeholder?: string
    minimized?: boolean
    onUpload?: () => void
    value?: string
    onChange?: (value: string) => void
    isAuthenticated?: boolean
    onOpenAuth?: () => void
}

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

    const displayText = useTypewriter({ minimized, placeholder })

    // Auto-resize textarea
    useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto'
            textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`
        }
    }, [input])

    const handleSubmit = (e?: React.FormEvent) => {
        e?.preventDefault()
        handleAuthCheck(() => {
            if (!input?.trim() || isLoading) return
            onSubmit(input)
            if (!isControlled) setInternalInput('')
            onChange?.('')
            if (textareaRef.current) textareaRef.current.style.height = 'auto'
        })
    }

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            handleSubmit()
        }
    }

    const shouldShowPlaceholder = !input && !minimized && !placeholder

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
                {/* Placeholder Layer (Absolute) */}
                {shouldShowPlaceholder && (
                    <>
                        <div className="hidden md:block">
                            <PromptPlaceholder displayText={displayText} />
                        </div>
                        <div className="md:hidden absolute left-5 top-[18px] text-[#6C6A69] pointer-events-none select-none truncate max-w-[calc(100%-60px)] text-[15px] font-medium">
                            Ask phasehumans to create...
                        </div>
                    </>
                )}

                <div className="flex items-start w-full relative">
                    {/* Input Area */}
                    <textarea
                        ref={textareaRef}
                        value={input}
                        onChange={(e) => handleInputChange(e.target.value)}
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

                {/* Footer of Input */}
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
