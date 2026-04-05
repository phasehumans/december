import React from 'react'
import { ChevronLeft } from 'lucide-react'

import { ChatPromptInput } from './ChatPromptInput'
import { ChatMessage } from './ChatMessage'

import { cn } from '@/shared/lib/utils'
import type { ChatSidebarProps } from '@/features/chat/types'

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
}) => {
    const scrollContainerRef = React.useRef<HTMLDivElement | null>(null)

    React.useEffect(() => {
        const container = scrollContainerRef.current

        if (!container) {
            return
        }

        container.scrollTo({
            top: container.scrollHeight,
            behavior: 'smooth',
        })
    }, [messages])

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
                    isGenerating={isGenerating}
                    executionTime={executionTime}
                    index={index}
                    status={msg.status}
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
            <div className="h-full bg-[#1F1F1F] rounded-2xl border border-white/10 flex flex-col overflow-hidden font-sans min-h-0">
                <div
                    ref={scrollContainerRef}
                    className="flex-1 overflow-y-auto p-4 pb-0 [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-white/10 hover:[&::-webkit-scrollbar-thumb]:bg-white/20"
                >
                    {messagesList}
                </div>

                {promptInput}
            </div>
        )
    }

    return (
        <aside
            className={cn(
                'h-full bg-[#1F1F1F] flex flex-col overflow-hidden shrink-0 z-20 transition-all duration-300 ease-in-out font-sans',
                isCollapsed
                    ? 'w-0 border-r-0'
                    : 'w-full md:w-[340px] absolute md:relative inset-0 md:inset-auto'
            )}
        >
            <div className="h-14 flex items-center justify-between shrink-0 px-4 min-w-[340px] w-full">
                <div className="flex items-center gap-2">
                    <button
                        onClick={onBack}
                        className="flex items-center gap-2 text-[#91908F] hover:text-white transition-colors text-sm font-medium group"
                        title="Back to Home"
                    >
                        <div className="p-1 rounded-md bg-white/5 group-hover:bg-white/10 transition-colors">
                            <ChevronLeft size={14} />
                        </div>
                        <span>Back</span>
                    </button>
                </div>
                <button onClick={onClose} className="md:hidden p-2 text-[#91908F] hover:text-white">
                    <ChevronLeft className="rotate-180" size={20} />
                </button>
            </div>

            <div className="flex-1 flex flex-col overflow-hidden min-w-[340px]">
                <div
                    ref={scrollContainerRef}
                    className="flex-1 overflow-y-auto p-5 pb-0 [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-white/10 hover:[&::-webkit-scrollbar-thumb]:bg-white/20"
                >
                    {messagesList}
                </div>

                {promptInput}
            </div>
        </aside>
    )
}
