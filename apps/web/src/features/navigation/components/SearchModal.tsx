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
    category: 'Recent' | 'Navigation' | 'Settings'
    icon: React.ReactNode
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
    const [recentIds, setRecentIds] = useState<string[]>(() => {
        try {
            return JSON.parse(localStorage.getItem('december-search-recents') || '[]')
        } catch {
            return []
        }
    })

    // reset search query and selected index on open
    useEffect(() => {
        if (isOpen) {
            setSearchQuery('')
            setSelectedIndex(0)
            setTimeout(() => inputRef.current?.focus(), 50)
        }
    }, [isOpen])

    const saveRecent = (id: string) => {
        const newRecents = [id, ...recentIds.filter((rId) => rId !== id)].slice(0, 5)
        setRecentIds(newRecents)
        localStorage.setItem('december-search-recents', JSON.stringify(newRecents))
    }

    const allItems: SearchItem[] = [
        // navigation
        {
            id: 'go-projects',
            label: 'Sessions',
            subtitle: 'Go to all sessions',
            category: 'Navigation',
            icon: <Icons.Folder className="w-4 h-4 text-neutral-400" />,
            action: () => {
                onClose()
                navigate('/projects')
            },
        },
        {
            id: 'go-templates',
            label: 'Wiki',
            subtitle: 'Go to wiki',
            category: 'Navigation',
            icon: <Icons.BookOpen className="w-4 h-4 text-neutral-400" />,
            action: () => {
                onClose()
                navigate('/templates')
            },
        },
        {
            id: 'go-docs',
            label: 'Documentation',
            subtitle: 'Go to December documentation',
            category: 'Navigation',
            icon: <Icons.DocsBook className="w-4 h-4 text-neutral-400" />,
            action: () => {
                onClose()
                navigate('/docs')
            },
        },
        // settings
        {
            id: 'go-settings-account',
            label: 'Account Settings',
            subtitle: 'Manage profile & account details',
            category: 'Settings',
            icon: <Icons.Settings className="w-4 h-4 text-neutral-400" />,
            action: () => {
                onClose()
                navigate('/settings/account')
            },
        },
        {
            id: 'go-settings-account-profile',
            label: 'Profile Details',
            subtitle: 'Settings > Account',
            category: 'Settings',
            icon: <Icons.User className="w-4 h-4 text-neutral-400" />,
            action: () => {
                onClose()
                navigate('/settings/account#profile')
            },
        },
        {
            id: 'go-settings-account-password',
            label: 'Password & Security',
            subtitle: 'Settings > Account',
            category: 'Settings',
            icon: <Icons.Lock className="w-4 h-4 text-neutral-400" />,
            action: () => {
                onClose()
                navigate('/settings/account#password')
            },
        },
        {
            id: 'go-settings-preferences',
            label: 'Preferences',
            subtitle: 'Manage theme & app preferences',
            category: 'Settings',
            icon: <Icons.DesignSystems className="w-4 h-4 text-neutral-400" />,
            action: () => {
                onClose()
                navigate('/settings/preferences')
            },
        },
        {
            id: 'go-settings-preferences-custom-design',
            label: 'Custom Design',
            subtitle: 'Settings > Preferences',
            category: 'Settings',
            icon: <Icons.DesignSystems className="w-4 h-4 text-neutral-400" />,
            action: () => {
                onClose()
                navigate('/settings/preferences#custom-design')
            },
        },
        {
            id: 'go-settings-preferences-shortcuts',
            label: 'Keyboard Shortcuts',
            subtitle: 'Settings > Preferences',
            category: 'Settings',
            icon: <Icons.Settings className="w-4 h-4 text-neutral-400" />,
            action: () => {
                onClose()
                navigate('/settings/preferences#shortcuts')
            },
        },
        {
            id: 'go-settings-integrations',
            label: 'Integrations',
            subtitle: 'Manage connected services & API keys',
            category: 'Settings',
            icon: <Icons.Globe className="w-4 h-4 text-neutral-400" />,
            action: () => {
                onClose()
                navigate('/settings/integrations')
            },
        },
        {
            id: 'go-settings-integrations-github',
            label: 'GitHub Integration',
            subtitle: 'Settings > Integrations',
            category: 'Settings',
            icon: <Icons.Github className="w-4 h-4 text-neutral-400" />,
            action: () => {
                onClose()
                navigate('/settings/integrations#github')
            },
        },
        {
            id: 'go-settings-billing',
            label: 'Billing & Credits',
            subtitle: 'Manage subscription & credit balance',
            category: 'Settings',
            icon: <Icons.Clock className="w-4 h-4 text-neutral-400" />,
            action: () => {
                onClose()
                navigate('/settings/billing')
            },
        },
        {
            id: 'go-settings-billing-subscription',
            label: 'Subscription Plan',
            subtitle: 'Settings > Billing & Credits',
            category: 'Settings',
            icon: <Icons.Clock className="w-4 h-4 text-neutral-400" />,
            action: () => {
                onClose()
                navigate('/settings/billing#subscription')
            },
        },
        {
            id: 'go-settings-billing-invoices',
            label: 'Invoices & Receipts',
            subtitle: 'Settings > Billing & Credits',
            category: 'Settings',
            icon: <Icons.DocsBook className="w-4 h-4 text-neutral-400" />,
            action: () => {
                onClose()
                navigate('/settings/billing#invoices')
            },
        },
        {
            id: 'go-settings-usage',
            label: 'Usage',
            subtitle: 'View AI generation & model usage',
            category: 'Settings',
            icon: <Icons.Clock className="w-4 h-4 text-neutral-400" />,
            action: () => {
                onClose()
                navigate('/settings/usage')
            },
        },
    ]

    const defaultRecentIds = ['go-projects', 'go-settings-account']
    const activeRecentIds = recentIds.length > 0 ? recentIds : defaultRecentIds

    const recentItems = activeRecentIds
        .map((id) => allItems.find((i) => i.id === id))
        .filter((i): i is SearchItem => Boolean(i))
        .map((i) => ({ ...i, category: 'Recent' as const }))

    let displayedItems: SearchItem[] = []

    if (searchQuery.trim() === '') {
        // show recent first, then the rest
        displayedItems = [...recentItems, ...allItems]
    } else {
        const query = searchQuery.toLowerCase()
        displayedItems = allItems.filter(
            (item) =>
                item.label.toLowerCase().includes(query) ||
                item.subtitle?.toLowerCase().includes(query) ||
                item.category.toLowerCase().includes(query)
        )
    }

    // group items by category
    const categories: ('Recent' | 'Navigation' | 'Settings')[] = [
        'Recent',
        'Navigation',
        'Settings',
    ]

    useEffect(() => {
        setSelectedIndex(0)
    }, [searchQuery])

    useEffect(() => {
        if (!isOpen) return
        const element = document.getElementById(`search-item-${selectedIndex}`)
        if (element) {
            element.scrollIntoView({ block: 'nearest' })
        }
    }, [selectedIndex, isOpen])

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (!isOpen) return

            if (e.key === 'ArrowDown') {
                e.preventDefault()
                setSelectedIndex((prev) => (prev + 1) % displayedItems.length)
            } else if (e.key === 'ArrowUp') {
                e.preventDefault()
                setSelectedIndex(
                    (prev) => (prev - 1 + displayedItems.length) % displayedItems.length
                )
            } else if (e.key === 'Enter') {
                e.preventDefault()
                if (displayedItems[selectedIndex]) {
                    const item = displayedItems[selectedIndex]
                    saveRecent(item.id)
                    if (e.ctrlKey || e.metaKey) {
                        // open in new tab behavior simulation
                        window.open(window.location.origin, '_blank')
                        onClose()
                    } else {
                        item.action()
                    }
                }
            } else if (e.key === 'Escape') {
                e.preventDefault()
                onClose()
            }
        }

        window.addEventListener('keydown', handleKeyDown)
        return () => window.removeEventListener('keydown', handleKeyDown)
    }, [isOpen, displayedItems, selectedIndex, onClose])

    if (!isOpen) return null

    let currentIndex = 0

    return (
        <div
            className="fixed inset-0 bg-black/40 z-[200] flex items-start justify-center pt-[15vh] p-4 animate-in fade-in duration-200"
            onClick={onClose}
        >
            <div
                className="w-full max-w-[640px] bg-[#1E1E1E] border border-[#282828] rounded-xl shadow-[0_0_80px_rgba(0,0,0,0.8)] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200 font-sans"
                onClick={(e) => e.stopPropagation()}
            >
                {/* search input */}
                <div className="flex items-center px-4 py-3.5 border-b border-[#282828] bg-[#1E1E1E]">
                    <Icons.Search className="w-4 h-4 text-[#888888] mr-3 shrink-0" />
                    <input
                        ref={inputRef}
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Type a command or search..."
                        className="w-full bg-transparent text-[14.5px] font-medium text-[#EDEDED] placeholder-[#777777] focus:outline-none caret-white font-sans"
                    />
                </div>

                {/* results list */}
                <div className="flex flex-col py-2 max-h-[420px] overflow-y-auto no-scrollbar">
                    {categories.map((category) => {
                        const categoryItems = displayedItems.filter(
                            (item) => item.category === category
                        )
                        if (categoryItems.length === 0) return null

                        // ensure we use a set to deduplicate recents if needed, but they are mapped uniquely by index in render
                        // note: recent category might show duplicate items if they are also in navigation/settings. that's typical command palette behavior.

                        return (
                            <div key={category} className="flex flex-col mb-2 last:mb-0">
                                <div className="px-4 py-1.5 mt-1 text-[12px] font-semibold text-[#7B7A79]">
                                    {category === 'Recent' && recentIds.length === 0
                                        ? 'Recommendations'
                                        : category}
                                </div>
                                <div className="flex flex-col gap-0.5 px-2 pb-1">
                                    {categoryItems.map((item, localIdx) => {
                                        const itemIndex = currentIndex++
                                        const isSelected = itemIndex === selectedIndex

                                        return (
                                            <button
                                                key={`${category}-${item.id}-${localIdx}`}
                                                id={`search-item-${itemIndex}`}
                                                onClick={() => {
                                                    saveRecent(item.id)
                                                    item.action()
                                                }}
                                                onMouseEnter={() => setSelectedIndex(itemIndex)}
                                                className={cn(
                                                    'flex items-center justify-between px-3 py-2 rounded-lg transition-colors w-full text-left outline-none cursor-pointer group',
                                                    isSelected
                                                        ? 'bg-[#2A2928]'
                                                        : 'hover:bg-[#2A2928]/40'
                                                )}
                                            >
                                                <div className="flex items-center gap-3 min-w-0 flex-1">
                                                    <div className="shrink-0 text-[#888888] group-hover:text-[#EDEDED] flex items-center justify-center">
                                                        {item.icon}
                                                    </div>
                                                    <div className="flex items-baseline min-w-0 gap-1.5 truncate">
                                                        <span
                                                            className={cn(
                                                                'text-[14px] font-medium transition-colors',
                                                                isSelected
                                                                    ? 'text-[#EDEDED]'
                                                                    : 'text-[#D6D5D4]'
                                                            )}
                                                        >
                                                            {item.label}
                                                        </span>
                                                        {item.subtitle && (
                                                            <span className="text-[14px] text-[#7B7A79] transition-colors">
                                                                {item.subtitle}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            </button>
                                        )
                                    })}
                                </div>
                            </div>
                        )
                    })}
                    {displayedItems.length === 0 && (
                        <div className="py-8 text-center text-[14px] text-[#7B7A79]">
                            No results found for "{searchQuery}"
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
