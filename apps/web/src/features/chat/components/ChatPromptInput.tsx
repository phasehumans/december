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
        selectedSpeed,
        handleSelectModel,
        handleSelectCredits,
        handleSelectSpeed,
        slash,
        attachments,
        attachmentNote,
        refusedAttachment,
        handlePaste,
        handleDrop,
        handleDragOver,
        addAttachments,
        removeAttachment,
    } = usePromptInputController({
        value,
        onChange,
        // the options carry the speed, plan first and the picked skills to the socket
        onSubmit: (_prompt, options) => {
            if (value.trim()) onSubmit(options)
        },
        isAuthenticated,
        onOpenAuth,
        // a new message can be sent while December works (#637): it is queued or sent now
        isLoading: false,
        mode: props.mode || 'chat',
        sessionId: props.sessionId,
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

    const placeholderText = props.placeholder || 'Ask a follow-up...'

    return (
        <div
            data-prompt-box
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            className="relative w-full bg-[#141414] shrink-0 z-30"
        >
            {(attachmentNote || slash.note) && (
                // the result of a command (/copy, /rename) or a refused file: one grey
                // line, no toast
                <div
                    role="status"
                    className="px-2 pb-1.5 text-[12.5px] text-[#8F8E8D] animate-in fade-in duration-150"
                >
                    {attachmentNote || slash.note}
                </div>
            )}
            <SlashMenu menu={slash} anchorRef={textareaRef} placement="top" />
            <SlashHelpPanel menu={slash} />
            <div
                onClick={handleContainerClick}
                className="relative group rounded-[17px] bg-[#1F1F1F] border border-[#313131] focus-within:border-white/10 transition-all duration-300 ease-out flex flex-col cursor-text"
            >
                <div className="pt-[12px] pl-5 pr-5 pb-1 min-h-[64px] relative">
                    {(slash.chips.length > 0 || attachments.length > 0) && (
                        <div className="flex flex-wrap items-center gap-1.5 mb-1">
                            {attachments.map((file, index) => (
                                <div
                                    key={`${file.name}-${index}`}
                                    // the file the server refused shows in the error colour
                                    {...(file === refusedAttachment
                                        ? { 'data-refused': 'true' }
                                        : {})}
                                    className={`flex items-center gap-1.5 font-sans font-medium bg-[#2A2928] px-2 py-0.5 rounded-[6px] max-w-full ${file === refusedAttachment ? 'text-red-400' : 'text-[#E8E8E8]'}`}
                                >
                                    <span className="text-[12.5px] leading-relaxed truncate max-w-[180px]">
                                        {file.name}
                                    </span>
                                    <button
                                        type="button"
                                        onClick={() => removeAttachment(index)}
                                        className="text-[#8F8E8D] hover:text-white transition-colors ml-0.5"
                                        aria-label={`Remove ${file.name}`}
                                    >
                                        <Icons.X className="w-3 h-3" />
                                    </button>
                                </div>
                            ))}
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
                        onPaste={handlePaste}
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
                    onFiles={addAttachments}
                    onSubmit={() => handleSubmit()}
                    hasInput={!!input?.trim()}
                    isLoading={!!isApplyingEdit || !!props.isGenerating || !!props.isLoading}
                    sendWhileLoading
                    onStop={props.onStop}
                    onVoiceTranscript={handleVoiceTranscript}
                    isAuthenticated={isAuthenticated}
                    onOpenAuth={onOpenAuth}
                    mode={props.mode || 'chat'}
                    selectedModel={selectedModel}
                    selectedProvider={selectedProvider}
                    selectedSource={selectedSource}
                    selectedSpeed={selectedSpeed}
                    onSelectModel={(model, provider, source) => {
                        handleSelectModel(model, provider, source)
                        props.onModelChange?.(model, provider)
                    }}
                    onSelectCredits={handleSelectCredits}
                    onSelectSpeed={handleSelectSpeed}
                    onOptionSelect={(trigger) => {
                        const separator = input && !input.endsWith(' ') ? ' ' : ''
                        handleInputChange((input || '') + separator + '@' + trigger)
                        textareaRef.current?.focus()
                    }}
                    onSlash={() => slash.open()}
                    slashCommands={slash.commands}
                    onPickCommand={slash.runCommand}
                    onPickSecret={handleSelectSecret}
                    onPickSkill={slash.addSkillChip}
                />
            </div>
        </div>
    )
}
