import { motion, AnimatePresence } from 'framer-motion'
import { X, KeyRound } from 'lucide-react'
import React, { useRef, useEffect } from 'react'

import type { ChatPromptInputProps } from '@/features/chat/types'

import { usePromptInputController } from '@/features/home/hooks/usePromptInputController'
import { PromptFooter } from '@/shared/components/ui/PromptFooter'

export const ChatPromptInput: React.FC<Partial<ChatPromptInputProps> & Record<string, any>> = (
    props
) => {
    const value = props.value ?? props.editPrompt ?? ''
    const onChange = React.useMemo(
        () => props.onChange ?? props.setEditPrompt ?? (() => {}),
        [props.onChange, props.setEditPrompt]
    )
    const onSubmit = props.onSubmit ?? props.handleApplyEdit ?? (() => {})
    const { selectedElement, onClearSelection, isApplyingEdit, isAuthenticated, onOpenAuth } = props

    const isGenerating = props.isGenerating ?? props.isApplyingEdit ?? false
    const prevGeneratingRef = useRef(isGenerating)

    const {
        input,
        textareaRef,
        dropdownRef,
        selectedIndex,
        setSelectedIndex,
        forceClose,
        dropdownPosition,
        isAtTriggered,
        isReposTriggered,
        isSecretsTriggered,
        filteredProviders,
        filteredSecrets,
        isSecretsLoading,
        handleSelectSecret,
        handleInputChange,
        handleSelect,
        handleSubmit,
        handleKeyDown,
        handleVoiceTranscript,
    } = usePromptInputController({
        value,
        onChange,
        onSubmit: () => {
            if (value.trim()) onSubmit()
        },
        isAuthenticated,
        onOpenAuth,
        isLoading: isGenerating,
        mode: props.mode || 'chat',
    })

    // Auto-focus on mount and when mode or selected element changes
    useEffect(() => {
        if (props.autoFocus !== false) {
            textareaRef.current?.focus()
        }
    }, [props.autoFocus, props.mode, selectedElement, textareaRef])

    // Auto-focus when streaming/generation completes for follow-up prompts
    useEffect(() => {
        if (prevGeneratingRef.current && !isGenerating) {
            const timer = setTimeout(() => {
                textareaRef.current?.focus()
            }, 50)
            return () => clearTimeout(timer)
        }
        prevGeneratingRef.current = isGenerating
    }, [isGenerating, textareaRef])

    const handleContainerClick = (e: React.MouseEvent) => {
        const target = e.target as HTMLElement
        if (!target.closest('button') && !target.closest('a') && !target.closest('input')) {
            textareaRef.current?.focus()
        }
    }

    const placeholderText =
        props.placeholder ||
        (selectedElement
            ? 'Describe changes...'
            : props.mode === 'search'
              ? 'Ask anything...'
              : 'Ask December...')

    return (
        <div className="w-full bg-[#141414] shrink-0 z-30">
            <div
                onClick={handleContainerClick}
                className="relative group rounded-[17px] bg-[#1F1F1F] border border-[#313131] focus-within:border-white/10 transition-all duration-300 ease-out flex flex-col cursor-text"
            >
                {/* integrated selected element display */}
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

                <div className="pt-[12px] pl-5 pr-5 pb-1 min-h-[64px] relative">
                    <textarea
                        ref={textareaRef}
                        value={input}
                        onChange={(e) => handleInputChange(e.target.value)}
                        onKeyDown={handleKeyDown}
                        onSelect={handleSelect}
                        onKeyUp={handleSelect}
                        onClick={handleSelect}
                        placeholder={placeholderText}
                        autoFocus={props.autoFocus !== false}
                        className="w-full bg-transparent text-[#D6D5D4] placeholder-[#949494] caret-white resize-none focus:outline-none z-10 font-sans font-medium leading-relaxed p-0 m-0 border-none text-[14.5px] [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-white/10 hover:[&::-webkit-scrollbar-thumb]:bg-white/20"
                        rows={1}
                    />

                    {isAuthenticated &&
                        isAtTriggered &&
                        !isReposTriggered &&
                        !isSecretsTriggered &&
                        !forceClose && (
                            <div
                                ref={dropdownRef}
                                className={`absolute left-5 z-[100] w-[230px] max-w-[calc(100vw-32px)] bg-[#1E1E1E] border border-[#2A2928] rounded-2xl p-1 shadow-lg shadow-black/40 flex flex-col animate-in fade-in zoom-in-95 duration-150 ${dropdownPosition === 'top' ? 'bottom-[calc(100%+8px)]' : 'top-[48px]'}`}
                            >
                                {filteredProviders.length > 0 ? (
                                    filteredProviders.map((provider, idx) => (
                                        <button
                                            key={provider.id}
                                            onMouseEnter={() => setSelectedIndex(idx)}
                                            onClick={() => {
                                                const newValue = (input || '').replace(
                                                    /@[a-zA-Z0-9_-]*$/,
                                                    `@${provider.trigger}`
                                                )
                                                handleInputChange(newValue)
                                                textareaRef.current?.focus()
                                            }}
                                            className={`flex items-center gap-3 px-3 py-1.5 rounded-xl text-left text-[12.5px] font-medium text-[#EDEDEF] transition-colors outline-none w-full ${selectedIndex === idx ? 'bg-[#252525] dropdown-item-active' : 'hover:bg-[#252525]'}`}
                                        >
                                            <provider.icon
                                                className="w-4 h-4 text-[#8F8E8D]"
                                                style={(provider as any).iconStyle}
                                            />
                                            <span>{provider.title}</span>
                                        </button>
                                    ))
                                ) : (
                                    <div className="px-3 py-2 text-center text-[12.5px] text-[#8F8E8D]">
                                        No matching options.
                                    </div>
                                )}
                            </div>
                        )}

                    {isAuthenticated && isSecretsTriggered && !forceClose && (
                        <div
                            ref={dropdownRef}
                            className={`absolute left-5 z-[100] w-[280px] max-w-[calc(100vw-32px)] bg-[#1E1E1E] border border-[#2A2928] rounded-2xl p-1 shadow-lg shadow-black/40 font-sans flex flex-col max-h-[300px] animate-in fade-in zoom-in-95 duration-150 ${dropdownPosition === 'top' ? 'bottom-[calc(100%+8px)]' : 'top-[48px]'}`}
                        >
                            <div className="px-3 py-1.5 mb-0.5">
                                <span className="text-[11.5px] font-medium text-[#8F8E8D]">
                                    Secrets
                                </span>
                            </div>
                            {isSecretsLoading ? (
                                <div className="px-3 py-2 text-[12.5px] text-[#8F8E8D]">
                                    Loading...
                                </div>
                            ) : (
                                <div
                                    className="flex flex-col overflow-y-auto px-0.5 pb-0.5"
                                    style={{ scrollbarWidth: 'none' }}
                                >
                                    {filteredSecrets.length > 0 ? (
                                        filteredSecrets.slice(0, 10).map((secret, idx) => (
                                            <button
                                                key={secret.id}
                                                onMouseEnter={() => setSelectedIndex(idx)}
                                                onClick={() => handleSelectSecret(secret)}
                                                className={`flex items-start gap-3 px-3 py-1.5 rounded-xl transition-colors text-left w-full outline-none ${selectedIndex === idx ? 'bg-[#252525] dropdown-item-active' : 'hover:bg-[#252525]'}`}
                                            >
                                                <KeyRound
                                                    className={`w-4 h-4 mt-[2px] ${selectedIndex === idx ? 'text-[#EDEDEF]' : 'text-[#8F8E8D]'}`}
                                                    style={{
                                                        transform: 'scaleY(-1) rotate(-135deg)',
                                                    }}
                                                />
                                                <div className="flex flex-col min-w-0 leading-tight gap-0.5">
                                                    <span className="text-[12.5px] font-medium text-[#EDEDEF] truncate">
                                                        {secret.name}
                                                    </span>
                                                    <span className="text-[11.5px] text-[#8F8E8D] truncate">
                                                        {secret.note || 'Stored secret'}
                                                    </span>
                                                </div>
                                            </button>
                                        ))
                                    ) : (
                                        <div className="px-3 py-2 text-center text-[12.5px] text-[#8F8E8D]">
                                            No secrets found.
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}
                </div>

                <PromptFooter
                    onUpload={props.onUpload || (() => {})}
                    onSubmit={() => handleSubmit()}
                    hasInput={!!input?.trim()}
                    isLoading={!!isApplyingEdit || !!props.isGenerating || !!props.isLoading}
                    onVoiceTranscript={handleVoiceTranscript}
                    isAuthenticated={isAuthenticated}
                    onOpenAuth={onOpenAuth}
                    mode={props.mode || 'chat'}
                    isThinkingMode={props.isThinkingMode}
                    onToggleThinking={props.onToggleThinking}
                    onOptionSelect={(trigger) => {
                        const separator = input && !input.endsWith(' ') ? ' ' : ''
                        handleInputChange((input || '') + separator + '@' + trigger)
                        textareaRef.current?.focus()
                    }}
                />
            </div>
        </div>
    )
}
