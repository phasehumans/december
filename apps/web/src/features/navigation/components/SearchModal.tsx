import React, { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'

import { Icons } from '@/shared/components/ui/Icons'
import { cn } from '@/shared/lib/utils'

interface SearchModalProps {
    isOpen: boolean
    onClose: () => void
    onNewThread?: () => void
    isAuthenticated?: boolean
}

interface SearchItem {
    id: string
    label: string
    subtitle?: string
    category: 'Actions' | 'Navigation' | 'Settings'
    icon: React.ReactNode
    shortcut?: string[]
    action: () => void
}

export const SearchModal: React.FC<SearchModalProps> = ({
    isOpen,
    onClose,
    onNewThread,
    isAuthenticated,
}) => {
    const navigate = useNavigate()
    const [searchQuery, setSearchQuery] = useState('')
    const [selectedIndex, setSelectedIndex] = useState(0)
    const inputRef = useRef<HTMLInputElement>(null)

    // Reset search query and selected index on open
    useEffect(() => {
        if (isOpen) {
            setSearchQuery('')
            setSelectedIndex(0)
            setTimeout(() => inputRef.current?.focus(), 50)
        }
    }, [isOpen])

    const allItems: SearchItem[] = [
        // Actions
        {
            id: 'start-session',
            label: 'Start session',
            subtitle: 'with a prompt...',
            category: 'Actions',
            icon: <Icons.SessionsIcon className="w-4 h-4 text-neutral-400" />,
            action: () => {
                onClose()
                if (onNewThread) onNewThread()
                else navigate('/')
            },
        },
        {
            id: 'copy-org',
            label: 'Copy organization ID',
            category: 'Actions',
            icon: <Icons.Copy className="w-4 h-4 text-neutral-400" />,
            action: () => {
                navigator.clipboard.writeText('org_december_phasehumans_2026')
                onClose()
            },
        },
        // Navigation
        {
            id: 'go-new-session',
            label: 'Go to new session',
            category: 'Navigation',
            icon: <Icons.SessionsIcon className="w-4 h-4 text-neutral-400" />,
            shortcut: ['Control', 'shift', 'O'],
            action: () => {
                onClose()
                if (onNewThread) onNewThread()
                else navigate('/')
            },
        },
        {
            id: 'go-new-ask',
            label: 'Go to new ask',
            category: 'Navigation',
            icon: <Icons.Search className="w-4 h-4 text-neutral-400" />,
            action: () => {
                onClose()
                navigate('/')
            },
        },
        {
            id: 'go-all-sessions',
            label: 'Go to all sessions',
            category: 'Navigation',
            icon: <Icons.SessionsIcon className="w-4 h-4 text-neutral-400" />,
            action: () => {
                onClose()
                navigate('/sessions')
            },
        },
        {
            id: 'go-wiki',
            label: 'Go to Wiki',
            category: 'Navigation',
            icon: <Icons.DocsBook className="w-4 h-4 text-neutral-400" />,
            action: () => {
                onClose()
                navigate('/docs')
            },
        },
        {
            id: 'go-review',
            label: 'Go to Review',
            category: 'Navigation',
            icon: <Icons.Layers className="w-4 h-4 text-neutral-400" />,
            action: () => {
                onClose()
                navigate('/projects')
            },
        },
        {
            id: 'go-automations',
            label: 'Go to Automations',
            category: 'Navigation',
            icon: <Icons.Clock className="w-4 h-4 text-neutral-400" />,
            action: () => {
                onClose()
                navigate('/templates')
            },
        },
        // Settings
        {
            id: 'go-settings',
            label: 'Go to settings',
            category: 'Settings',
            icon: <Icons.Settings className="w-4 h-4 text-neutral-400" />,
            action: () => {
                onClose()
                navigate('/settings/account')
            },
        },
        {
            id: 'change-language',
            label: 'Change language...',
            category: 'Settings',
            icon: <Icons.Globe className="w-4 h-4 text-neutral-400" />,
            action: () => {
                onClose()
                navigate('/settings/preferences')
            },
        },
        {
            id: 'change-theme',
            label: 'Change theme...',
            category: 'Settings',
            icon: <Icons.DesignSystems className="w-4 h-4 text-neutral-400" />,
            action: () => {
                onClose()
                navigate('/settings/preferences')
            },
        },
    ]

    const filteredItems = allItems.filter(
        (item) =>
            item.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
            item.subtitle?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            item.category.toLowerCase().includes(searchQuery.toLowerCase())
    )

    // Group items by category
    const categories: ('Actions' | 'Navigation' | 'Settings')[] = [
        'Actions',
        'Navigation',
        'Settings',
    ]

    useEffect(() => {
        setSelectedIndex(0)
    }, [searchQuery])

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (!isOpen) return

            if (e.key === 'ArrowDown') {
                e.preventDefault()
                setSelectedIndex((prev) => (prev + 1) % filteredItems.length)
            } else if (e.key === 'ArrowUp') {
                e.preventDefault()
                setSelectedIndex((prev) => (prev - 1 + filteredItems.length) % filteredItems.length)
            } else if (e.key === 'Enter') {
                e.preventDefault()
                if (filteredItems[selectedIndex]) {
                    if (e.ctrlKey || e.metaKey) {
                        // Open in new tab behavior simulation
                        window.open(window.location.origin, '_blank')
                        onClose()
                    } else {
                        filteredItems[selectedIndex].action()
                    }
                }
            } else if (e.key === 'Escape') {
                e.preventDefault()
                onClose()
            }
        }

        window.addEventListener('keydown', handleKeyDown)
        return () => window.removeEventListener('keydown', handleKeyDown)
    }, [isOpen, filteredItems, selectedIndex, onClose])

    if (!isOpen) return null

    let currentIndex = 0

    return (
        <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[200] flex items-start justify-center pt-[15vh] p-4 animate-in fade-in duration-150"
            onClick={onClose}
        >
            <div
                className="w-full max-w-[640px] bg-[#1C1B1A] border border-[#2A2928] rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150 font-sans"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Search Input */}
                <div className="flex items-center px-5 py-4 border-b border-[#2A2928]">
                    <Icons.Search className="w-5 h-5 text-neutral-400 mr-3.5 shrink-0" />
                    <input
                        ref={inputRef}
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Type a command or search..."
                        className="w-full bg-transparent text-[15px] text-[#D6D5D4] placeholder-[#7B7A79] focus:outline-none caret-white font-sans"
                    />
                </div>

                {/* Results List */}
                <div className="flex flex-col py-2 max-h-[420px] overflow-y-auto no-scrollbar">
                    {categories.map((category) => {
                        const categoryItems = filteredItems.filter(
                            (item) => item.category === category
                        )
                        if (categoryItems.length === 0) return null

                        return (
                            <div key={category} className="flex flex-col mb-2 last:mb-0">
                                <div className="px-5 py-1.5 text-[12px] font-medium text-[#7B7A79]">
                                    {category}
                                </div>
                                <div className="flex flex-col gap-0.5 px-1.5">
                                    {categoryItems.map((item) => {
                                        const itemIndex = currentIndex++
                                        const isSelected = itemIndex === selectedIndex

                                        return (
                                            <button
                                                key={item.id}
                                                onClick={() => item.action()}
                                                onMouseEnter={() => setSelectedIndex(itemIndex)}
                                                className={cn(
                                                    'flex items-center justify-between px-3.5 py-2.5 rounded-xl transition-colors w-full text-left outline-none cursor-pointer group',
                                                    isSelected
                                                        ? 'bg-[#2A2928]'
                                                        : 'hover:bg-[#2A2928]/50'
                                                )}
                                            >
                                                <div className="flex items-center gap-3 min-w-0 flex-1">
                                                    <div className="text-[#A6A6A8] group-hover:text-[#EDEDEF] transition-colors shrink-0">
                                                        {item.icon}
                                                    </div>
                                                    <div className="flex items-baseline gap-1.5 min-w-0 truncate">
                                                        <span className="text-[14px] font-medium text-[#EDEDEF]">
                                                            {item.label}
                                                        </span>
                                                        {item.subtitle && (
                                                            <span className="text-[13px] text-[#7B7A79]">
                                                                {item.subtitle}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                                {item.shortcut && (
                                                    <div className="flex items-center gap-1 shrink-0 ml-4">
                                                        {item.shortcut.map((key) => (
                                                            <kbd
                                                                key={key}
                                                                className="px-1.5 py-0.5 text-[11px] font-medium text-[#A6A6A8] bg-[#222120] border border-[#323130] rounded-[4px] shadow-sm leading-none"
                                                            >
                                                                {key}
                                                            </kbd>
                                                        ))}
                                                    </div>
                                                )}
                                            </button>
                                        )
                                    })}
                                </div>
                            </div>
                        )
                    })}
                    {filteredItems.length === 0 && (
                        <div className="py-8 text-center text-[14px] text-[#7B7A79]">
                            No results found for "{searchQuery}"
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between px-5 py-3 bg-[#1C1B1A] border-t border-[#2A2928] text-[11px] text-[#7B7A79] select-none font-sans">
                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-1.5">
                            <kbd className="px-1.5 py-0.5 bg-[#2A2928] border border-[#3A3938] rounded text-[#A6A6A8] leading-none font-sans">
                                ↑
                            </kbd>
                            <kbd className="px-1.5 py-0.5 bg-[#2A2928] border border-[#3A3938] rounded text-[#A6A6A8] leading-none font-sans">
                                ↓
                            </kbd>
                            <span className="ml-0.5">Navigate</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <kbd className="px-1.5 py-0.5 bg-[#2A2928] border border-[#3A3938] rounded text-[#A6A6A8] leading-none font-sans">
                                esc
                            </kbd>
                            <span className="ml-0.5">Close</span>
                        </div>
                    </div>
                    <div className="flex items-center gap-6">
                        <div className="flex items-center gap-1.5">
                            <kbd className="px-1.5 py-0.5 bg-[#2A2928] border border-[#3A3938] rounded text-[#A6A6A8] leading-none font-sans">
                                Control
                            </kbd>
                            <kbd className="px-1.5 py-0.5 bg-[#2A2928] border border-[#3A3938] rounded text-[#A6A6A8] leading-none font-sans">
                                ↵
                            </kbd>
                            <span className="ml-0.5">Open in new tab</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <kbd className="px-1.5 py-0.5 bg-[#2A2928] border border-[#3A3938] rounded text-[#A6A6A8] leading-none font-sans">
                                ↵
                            </kbd>
                            <span className="ml-0.5">Select</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
