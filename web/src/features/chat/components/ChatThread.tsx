import { ChevronLeft } from 'lucide-react'
import React from 'react'

import { ChatMessage } from './ChatMessage'
import { ChatPromptInput } from './ChatPromptInput'

import type { ChatSidebarProps } from '@/features/chat/types'

import { Icons } from '@/shared/components/ui/Icons'
import { cn } from '@/shared/lib/utils'

export const ChatThread: React.FC<ChatSidebarProps> = ({
    messages,
    onPromptSubmit,
    onBack,
    isGenerating,
    executionTime,
    editPrompt,
    setEditPrompt,
    handleApplyEdit,
    isVisualMode,
    setIsVisualMode,
    selectedElement,
    handleClearSelection,
    isApplyingEdit,
    isCollapsed,
    onClose,
    mode = 'sidebar',
    projectName,
    generatedFiles,
    projectType,
    onTriggerSimulation,
}) => {
    const scrollContainerRef = React.useRef<HTMLDivElement | null>(null)
    const [shouldAutoScroll, setShouldAutoScroll] = React.useState(true)
    const prevMessagesLengthRef = React.useRef(messages.length)

    React.useEffect(() => {
        if (messages.length > prevMessagesLengthRef.current) {
            setShouldAutoScroll(true)
        }
        prevMessagesLengthRef.current = messages.length
    }, [messages.length])

    const handleScroll = () => {
        const container = scrollContainerRef.current
        if (!container) return

        const threshold = 35
        const isAtBottom =
            container.scrollHeight - container.scrollTop - container.clientHeight <= threshold
        setShouldAutoScroll(isAtBottom)
    }

    React.useEffect(() => {
        const container = scrollContainerRef.current

        if (!container || !shouldAutoScroll) {
            return
        }

        container.scrollTo({
            top: container.scrollHeight,
            behavior: 'auto',
        })

        const timeoutId = setTimeout(() => {
            if (shouldAutoScroll) {
                container.scrollTo({
                    top: container.scrollHeight,
                    behavior: 'auto',
                })
            }
        }, 50)

        return () => clearTimeout(timeoutId)
    }, [messages, generatedFiles, isGenerating, shouldAutoScroll])

    const handleSubmit = () => {
        const nextPrompt = editPrompt.trim()

        if (!nextPrompt) {
            return
        }

        if (selectedElement || isVisualMode) {
            handleApplyEdit()
            return
        }

        onPromptSubmit(nextPrompt)
        setEditPrompt('')
    }

    const messagesList = (
        <div className="flex flex-col gap-8">
            {messages.map((msg, index) => (
                <ChatMessage
                    key={msg.id}
                    role={msg.role === 'system' ? 'assistant' : msg.role}
                    content={msg.content}
                    thoughts={msg.thoughts}
                    plan={msg.plan}
                    summary={msg.summary}
                    isGenerating={isGenerating}
                    executionTime={executionTime}
                    index={index}
                    status={msg.status}
                    generatedFiles={generatedFiles}
                    projectType={projectType}
                    tokensUsed={msg.tokensUsed}
                    creditsUsed={msg.creditsUsed}
                    modelName={msg.modelName}
                    onTriggerSimulation={onTriggerSimulation}
                />
            ))}
        </div>
    )

    const promptInput = (
        <ChatPromptInput
            value={editPrompt}
            onChange={setEditPrompt}
            onSubmit={handleSubmit}
            isVisualMode={isVisualMode}
            onToggleVisualMode={() => setIsVisualMode(!isVisualMode)}
            selectedElement={selectedElement}
            onClearSelection={handleClearSelection}
            isApplyingEdit={isApplyingEdit}
        />
    )

    if (mode === 'mobile') {
        return (
            <div className="h-full bg-[#171615] rounded-2xl border border-white/10 flex flex-col overflow-hidden font-sans min-h-0">
                <div
                    ref={scrollContainerRef}
                    onScroll={handleScroll}
                    className="flex-1 overflow-y-auto overflow-x-hidden p-4 space-y-4 [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-white/10 hover:[&::-webkit-scrollbar-thumb]:bg-white/20"
                >
                    {messagesList}
                </div>

                <div className="shrink-0 bg-[#171615] pt-3 pl-2.5 pr-2.5 pb-2.5">{promptInput}</div>
            </div>
        )
    }

    return (
        <aside
            className={cn(
                'h-full bg-[#171615] flex flex-col overflow-hidden shrink-0 z-20 transition-all duration-300 ease-in-out font-sans',
                isCollapsed
                    ? 'w-0 border-r-0'
                    : 'w-full md:w-[340px] absolute md:relative inset-0 md:inset-auto'
            )}
        >
            <div className="h-14 flex items-center justify-between shrink-0 px-4 min-w-[340px] w-full">
                <div className="flex items-center gap-1.5 min-w-0">
                    <Icons.DecemberLogo className="w-[18px] h-[18px] shrink-0" />
                    <button
                        type="button"
                        onClick={(e) => {
                            e.preventDefault()
                            e.stopPropagation()
                            window.location.href = '/'
                        }}
                        className="text-sm font-medium tracking-wide text-[#91908F] hover:text-white transition-colors animate-in fade-in duration-200"
                        title="Back to Home"
                    >
                        december
                    </button>
                    <span className="text-sm opacity-40 text-[#91908F] select-none">/</span>
                    <span
                        className="text-sm font-medium text-[#91908F] truncate max-w-[150px]"
                        title={projectName ? projectName.toLowerCase() : 'projectname'}
                    >
                        {projectName ? projectName.toLowerCase() : 'projectname'}
                    </span>
                </div>
                <button
                    onClick={onClose}
                    className="md:hidden p-2 text-[#91908F] hover:text-white shrink-0"
                >
                    <ChevronLeft className="rotate-180" size={20} />
                </button>
            </div>

            <div className="flex-1 flex flex-col overflow-hidden min-w-[340px]">
                <div
                    ref={scrollContainerRef}
                    onScroll={handleScroll}
                    className="flex-1 overflow-y-auto overflow-x-hidden p-5 space-y-4 [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-white/10 hover:[&::-webkit-scrollbar-thumb]:bg-white/20"
                >
                    {messagesList}
                </div>

                <div className="shrink-0 bg-[#171615] pt-3 pl-2.5 pr-2.5 pb-2.5">{promptInput}</div>
            </div>
        </aside>
    )
}
