import { Lock } from 'lucide-react'
import React, { useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

import type { ChatPromptInputProps } from '@/features/chat/types'

import { usePromptInputController } from '@/features/home/hooks/usePromptInputController'
import { SlashHelpPanel, SlashMenu } from '@/features/home/slash/SlashMenu'
import { Icons } from '@/shared/components/ui/Icons'
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
    const { isApplyingEdit, isAuthenticated, onOpenAuth } = props

    const navigate = useNavigate()
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
        selectedModel,
        selectedProvider,
        selectedSource,
        handleSelectModel,
        slash,
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
        initialModel: props.selectedModel,
        initialProvider: props.selectedProvider,
        onModelChange: props.onModelChange,
        onNavigate: navigate,
    })

    // Auto-focus on mount and when mode changes
    useEffect(() => {
        if (props.autoFocus !== false) {
            textareaRef.current?.focus()
        }
    }, [props.autoFocus, props.mode, textareaRef])

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

    const placeholderText = props.placeholder || 'Ask December...'

    return (
        <div data-prompt-box className="relative w-full bg-[#141414] shrink-0 z-30">
            {slash.note && (
                // the result of a command (/copy, /rename): one grey line, no toast
                <div
                    role="status"
                    className="px-2 pb-1.5 text-[12.5px] text-[#8F8E8D] animate-in fade-in duration-150"
                >
                    {slash.note}
                </div>
            )}
            <SlashMenu menu={slash} anchorRef={textareaRef} placement="top" />
            <SlashHelpPanel menu={slash} />
            <div
                onClick={handleContainerClick}
                className="relative group rounded-[17px] bg-[#1F1F1F] border border-[#313131] focus-within:border-white/10 transition-all duration-300 ease-out flex flex-col cursor-text"
            >
                <div className="pt-[12px] pl-5 pr-5 pb-1 min-h-[64px] relative">
                    {slash.chips.length > 0 && (
                        <div className="flex flex-wrap items-center gap-1.5 mb-1">
                            {slash.chips.map((chip) => (
                                <div
                                    key={chip.id}
                                    className="flex items-center gap-1.5 text-[#E8E8E8] font-sans font-medium bg-[#2A2928] px-2 py-0.5 rounded-[6px]"
                                >
                                    <span className="text-[12.5px] leading-relaxed">
                                        {chip.label}
                                    </span>
                                    <button
                                        type="button"
                                        onClick={() => slash.removeChip(chip.id)}
                                        className="text-[#8F8E8D] hover:text-white transition-colors ml-0.5"
                                        aria-label={`Remove ${chip.label}`}
                                    >
                                        <Icons.X className="w-3 h-3" />
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                    <textarea
                        ref={textareaRef}
                        value={input}
                        onChange={(e) => {
                            handleInputChange(e.target.value)
                            // the caret moves with the text, so the menus see the new word at once
                            handleSelect(e)
                        }}
                        onKeyDown={handleKeyDown}
                        onSelect={handleSelect}
                        onKeyUp={handleSelect}
                        onClick={handleSelect}
                        placeholder={placeholderText}
                        autoFocus={props.autoFocus !== false}
                        className="w-full bg-transparent text-[#D6D5D4] placeholder-[#949494] caret-white resize-none focus:outline-none z-10 font-sans font-medium leading-relaxed p-0 m-0 border-none text-[14.5px] [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
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
                                                <Lock
                                                    className={`w-4 h-4 mt-[2px] ${selectedIndex === idx ? 'text-[#EDEDEF]' : 'text-[#8F8E8D]'}`}
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
                    selectedModel={selectedModel}
                    selectedProvider={selectedProvider}
                    selectedSource={selectedSource}
                    onSelectModel={(model, provider, source) => {
                        handleSelectModel(model, provider, source)
                        props.onModelChange?.(model, provider)
                    }}
                    onOptionSelect={(trigger) => {
                        const separator = input && !input.endsWith(' ') ? ' ' : ''
                        handleInputChange((input || '') + separator + '@' + trigger)
                        textareaRef.current?.focus()
                    }}
                    onSlash={() => slash.open()}
                    onPickSecret={handleSelectSecret}
                    onPickSkill={slash.addSkillChip}
                />
            </div>
        </div>
    )
}
