import React from 'react'
import { ChevronLeft } from 'lucide-react'
import { ChatPromptInput } from './ChatPromptInput'
import { cn } from '@/shared/lib/utils'
import { ChatMessage } from './ChatMessage'
import type { ChatSidebarProps } from '@/features/chat/types'

export const ChatThread: React.FC<ChatSidebarProps> = ({
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
    const [messages, setMessages] = React.useState<
        Array<{ role: 'user' | 'assistant'; content: string }>
    >([
        {
            role: 'user',
            content: 'Build a minimal, dark-themed Todo List app with local storage persistence.',
        },
        {
            role: 'assistant',
            content:
                'I\'ve built a robust <span class="text-white font-medium">Todo List Application</span> with a focus on minimalism and usability.<br/><br/>Key features implemented:<br/>• <span class="text-neutral-400">Local Storage Sync:</span> Tasks persist across page reloads.<br/>• <span class="text-neutral-400">Task Filtering:</span> Filter by All, Active, and Completed states.<br/>• <span class="text-neutral-400">Drag & Drop:</span> Reorder tasks intuitively (simulated).<br/>• <span class="text-neutral-400">Animations:</span> Smooth transitions for adding/deleting tasks.<br/><br/>The UI uses a clean <span class="text-white font-medium">light theme</span> with subtle emerald accents for completion states.',
        },
    ])

    const handleSubmit = () => {
        if (!editPrompt.trim()) return
        setMessages((prev) => [...prev, { role: 'user', content: editPrompt }])
        handleApplyEdit()
        // Simulate AI response for demo purposes if needed, or rely on parent to update
    }

    const messagesList = (
        <div className="flex flex-col gap-8">
            {messages.map((msg, index) => (
                <ChatMessage
                    key={index}
                    role={msg.role}
                    content={msg.content}
                    isGenerating={isGenerating}
                    executionTime={executionTime}
                    index={index}
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
                <div className="flex-1 overflow-y-auto p-4 pb-0 [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-white/10 hover:[&::-webkit-scrollbar-thumb]:bg-white/20">
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
            {/* Header */}
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
                {/* Mobile Close Button */}
                <button onClick={onClose} className="md:hidden p-2 text-[#91908F] hover:text-white">
                    <ChevronLeft className="rotate-180" size={20} />
                </button>
            </div>

            {/* Chat Content */}
            <div className="flex-1 flex flex-col overflow-hidden min-w-[340px]">
                <div className="flex-1 overflow-y-auto p-5 pb-0 [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-white/10 hover:[&::-webkit-scrollbar-thumb]:bg-white/20">
                    {messagesList}
                </div>

                {/* Input Area */}
                {promptInput}
            </div>
        </aside>
    )
}
