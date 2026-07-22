import { useMutation } from '@tanstack/react-query'
import React, { useState, useRef, useEffect } from 'react'

import { apiFetch } from '@/shared/api/client'
import { Icons } from '@/shared/components/ui/Icons'

export interface ChatMessage {
    id: string
    role: 'user' | 'assistant'
    content: string
    createdAt: Date
}

export interface WikiChatProps {
    wikiId?: string
    repoFullName?: string
}

export const WikiChat: React.FC<WikiChatProps> = ({ wikiId, repoFullName }) => {
    const [messages, setMessages] = useState<ChatMessage[]>([
        {
            id: 'welcome-msg',
            role: 'assistant',
            content:
                'Hello! I am your Repository AI Assistant. Ask me anything about this repository, architecture, or codebase!',
            createdAt: new Date(),
        },
    ])
    const [prompt, setPrompt] = useState('')
    const [isOpen, setIsOpen] = useState(true)
    const messagesEndRef = useRef<HTMLDivElement | null>(null)

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }

    useEffect(() => {
        scrollToBottom()
    }, [messages])

    const chatMutation = useMutation({
        mutationFn: async (userPrompt: string) => {
            const res = await apiFetch('/wiki/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    wikiId,
                    repoFullName,
                    prompt: userPrompt,
                }),
            })
            if (!res.ok) {
                throw new Error('Failed to send message')
            }
            return res.json()
        },
        onSuccess: (data) => {
            const assistantMsg: ChatMessage = {
                id: `assistant-${Date.now()}`,
                role: 'assistant',
                content: data.answer || 'No answer generated.',
                createdAt: new Date(),
            }
            setMessages((prev) => [...prev, assistantMsg])
        },
        onError: () => {
            const errorMsg: ChatMessage = {
                id: `error-${Date.now()}`,
                role: 'assistant',
                content: 'Sorry, I ran into an error generating a response. Please try again.',
                createdAt: new Date(),
            }
            setMessages((prev) => [...prev, errorMsg])
        },
    })

    const handleSend = (e: React.FormEvent) => {
        e.preventDefault()
        const trimmed = prompt.trim()
        if (!trimmed || chatMutation.isPending) return

        const userMsg: ChatMessage = {
            id: `user-${Date.now()}`,
            role: 'user',
            content: trimmed,
            createdAt: new Date(),
        }

        setMessages((prev) => [...prev, userMsg])
        setPrompt('')
        chatMutation.mutate(trimmed)
    }

    if (!isOpen) {
        return (
            <div className="border-t border-[#282828] bg-[#181818] p-3 flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-semibold text-gray-300">
                    <Icons.Sparkles className="w-4 h-4 text-blue-400" />
                    <span>WikiChat Assistant</span>
                </div>
                <button
                    onClick={() => setIsOpen(true)}
                    className="px-3 py-1 rounded bg-[#242424] hover:bg-[#303030] border border-[#333333] text-xs text-blue-400 font-medium cursor-pointer"
                >
                    Expand Chat
                </button>
            </div>
        )
    }

    return (
        <div className="border-t border-[#282828] bg-[#181818] flex flex-col h-72 shrink-0">
            {/* Header */}
            <div className="px-4 py-2.5 bg-[#1C1C1C] border-b border-[#262626] flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2">
                    <div className="p-1 rounded bg-blue-500/10 border border-blue-500/30 text-blue-400">
                        <Icons.Sparkles className="w-3.5 h-3.5" />
                    </div>
                    <span className="text-xs font-semibold text-white">WikiChat Assistant</span>
                </div>
                <button
                    onClick={() => setIsOpen(false)}
                    className="text-gray-400 hover:text-white p-1 text-xs cursor-pointer"
                    title="Minimize chat"
                >
                    <Icons.ChevronDown className="w-4 h-4" />
                </button>
            </div>

            {/* Message History */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3 font-sans">
                {messages.map((msg) => (
                    <div
                        key={msg.id}
                        className={`flex flex-col ${
                            msg.role === 'user' ? 'items-end' : 'items-start'
                        }`}
                    >
                        <div
                            className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-xs leading-relaxed ${
                                msg.role === 'user'
                                    ? 'bg-blue-600 text-white rounded-br-none'
                                    : 'bg-[#242424] border border-[#303030] text-gray-200 rounded-bl-none'
                            }`}
                        >
                            {msg.content}
                        </div>
                    </div>
                ))}
                {chatMutation.isPending && (
                    <div className="flex items-start">
                        <div className="bg-[#242424] border border-[#303030] text-gray-400 rounded-2xl rounded-bl-none px-4 py-2 text-xs flex items-center gap-2">
                            <Icons.Sparkles className="w-3.5 h-3.5 animate-spin text-blue-400" />
                            <span>Thinking...</span>
                        </div>
                    </div>
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* Input Form */}
            <form
                onSubmit={handleSend}
                className="p-3 bg-[#1A1A1A] border-t border-[#262626] flex items-center gap-2 shrink-0"
            >
                <input
                    type="text"
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder="Ask a question about this repository..."
                    className="flex-1 bg-[#141414] border border-[#2A2A2A] rounded-xl px-3.5 py-2 text-xs text-white placeholder-[#616161] focus:outline-none focus:border-blue-500"
                />
                <button
                    type="submit"
                    disabled={!prompt.trim() || chatMutation.isPending}
                    className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-medium transition-colors flex items-center gap-1 cursor-pointer"
                >
                    <span>Send</span>
                    <Icons.ArrowRight className="w-3.5 h-3.5" />
                </button>
            </form>
        </div>
    )
}
