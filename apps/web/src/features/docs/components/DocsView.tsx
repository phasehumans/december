import { ChevronLeft, Search, X } from 'lucide-react'
import React, { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

import { DOCS_NAV_GROUPS, pathToDocTab, docTabToPath, docTabToTitle } from '../types'

import { DocsAgentLoop } from './sections/DocsAgentLoop'
import { DocsArchitecture } from './sections/DocsArchitecture'
import { DocsCheckpoints } from './sections/DocsCheckpoints'
import { DocsCliReference } from './sections/DocsCliReference'
import { DocsIntegrations } from './sections/DocsIntegrations'
import { DocsIntroduction } from './sections/DocsIntroduction'
import { DocsPreviews } from './sections/DocsPreviews'
import { DocsPrompting } from './sections/DocsPrompting'
import { DocsQuickStart } from './sections/DocsQuickStart'
import { DocsSecurity } from './sections/DocsSecurity'
import { DocsSlashCommands } from './sections/DocsSlashCommands'

import type { DocTab } from '../types'

import { MobileBreadcrumbsHeader } from '@/features/navigation/components/MobileBreadcrumbsHeader'
import { PrivacyPolicyContent } from '@/shared/components/legal/PrivacyPolicyContent'
import { TermsOfServiceContent } from '@/shared/components/legal/TermsOfServiceContent'
import { Icons } from '@/shared/components/ui/Icons'
import { cn } from '@/shared/lib/utils'

interface DocsViewProps {
    onBack?: () => void
}

export const DocsView: React.FC<DocsViewProps> = ({ onBack }) => {
    const location = useLocation()
    const navigate = useNavigate()

    const normalizedPath = location.pathname.toLowerCase().replace(/\/$/, '') || '/docs'
    const currentTab: DocTab = pathToDocTab[normalizedPath] || 'Introduction'
    const [activeTab, setActiveTab] = useState<DocTab>(currentTab)
    const [searchQuery, setSearchQuery] = useState('')

    const isMobileRoot = location.pathname === '/docs' || location.pathname === '/docs/'
    const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState(isMobileRoot)

    useEffect(() => {
        const matched = pathToDocTab[normalizedPath]
        if (matched) {
            setActiveTab(matched)
        }
    }, [normalizedPath])

    useEffect(() => {
        if (isMobileRoot) {
            setIsMobileDrawerOpen(true)
        }
    }, [isMobileRoot])

    useEffect(() => {
        document.title = docTabToTitle[activeTab] || 'Documentation | December'
        return () => {
            document.title = 'December | AI Coding Agent for Terminal and Cloud'
        }
    }, [activeTab])

    const handleTabChange = (tab: DocTab) => {
        setActiveTab(tab)
        navigate(docTabToPath[tab])
        setIsMobileDrawerOpen(false)
    }

    const handleHome = () => {
        if (onBack) {
            onBack()
        } else {
            navigate('/')
        }
    }

    // Filter groups and items by search query
    const filteredGroups = useMemo(() => {
        const trimmed = searchQuery.trim().toLowerCase()
        if (!trimmed) return DOCS_NAV_GROUPS

        return DOCS_NAV_GROUPS.map((group) => ({
            ...group,
            items: group.items.filter(
                (item) =>
                    item.label.toLowerCase().includes(trimmed) ||
                    item.slug.toLowerCase().includes(trimmed)
            ),
        })).filter((group) => group.items.length > 0)
    }, [searchQuery])

    const renderTabContent = () => {
        switch (activeTab) {
            case 'Introduction':
                return <DocsIntroduction onNavigate={handleTabChange} />
            case 'Quick Start':
                return <DocsQuickStart onNavigate={handleTabChange} />
            case 'Prompting Guide':
                return <DocsPrompting onNavigate={handleTabChange} />
            case 'Agent Loop':
                return <DocsAgentLoop onNavigate={handleTabChange} />
            case 'Git Checkpoints':
                return <DocsCheckpoints onNavigate={handleTabChange} />
            case 'Architecture':
                return <DocsArchitecture onNavigate={handleTabChange} />
            case 'Live Previews':
                return <DocsPreviews onNavigate={handleTabChange} />
            case 'CLI Reference':
                return <DocsCliReference onNavigate={handleTabChange} />
            case 'Slash Commands':
                return <DocsSlashCommands onNavigate={handleTabChange} />
            case 'Integrations & MCP':
                return <DocsIntegrations onNavigate={handleTabChange} />
            case 'Security & Isolation':
                return <DocsSecurity onNavigate={handleTabChange} />
            case 'Privacy Policy':
                return <PrivacyPolicyContent />
            case 'Terms of Service':
                return <TermsOfServiceContent />
            default:
                return <DocsIntroduction onNavigate={handleTabChange} />
        }
    }

    return (
        <div className="flex w-full h-full bg-[#141414] md:bg-[#100E12] overflow-hidden p-0 md:p-[8px] no-scrollbar [scrollbar-width:none] [-ms-overflow-style:none]">
            {/* Mobile Drawer Backdrop */}
            <div
                className={cn(
                    'fixed inset-0 bg-black/60 z-40 md:hidden transition-opacity duration-300 ease-[cubic-bezier(0.2,0.8,0.2,1)]',
                    isMobileDrawerOpen
                        ? 'opacity-100 pointer-events-auto'
                        : 'opacity-0 pointer-events-none'
                )}
                onClick={() => setIsMobileDrawerOpen(false)}
            />

            {/* Mobile Drawer */}
            <div
                className={cn(
                    'fixed inset-y-0 left-0 w-[260px] bg-[#141414] border-r border-[#242323] z-[60] md:hidden flex flex-col pt-2 pb-0 transition-transform duration-300 ease-[cubic-bezier(0.2,0.8,0.2,1)] will-change-transform font-sans',
                    isMobileDrawerOpen
                        ? 'translate-x-0 pointer-events-auto'
                        : '-translate-x-full pointer-events-none'
                )}
            >
                {/* Drawer Header */}
                <div className="px-3 mb-2 mt-0 z-30 relative">
                    <div className="flex items-center justify-between px-2 mb-4 mt-3">
                        <button
                            type="button"
                            onClick={handleHome}
                            className="flex items-center cursor-pointer outline-none"
                            aria-label="Home"
                        >
                            <Icons.DecemberLogo className="w-6 h-6 text-[#D6D5D4]" />
                        </button>
                        <div
                            className="flex items-center justify-center text-[#919191] hover:text-[#D4D4D8] p-1 rounded-md hover:bg-[#252525] transition-colors cursor-pointer relative"
                            onClick={() => setIsMobileDrawerOpen(false)}
                            aria-label="Close sidebar"
                        >
                            <Icons.SidebarToggle className="w-4 h-4" />
                        </div>
                    </div>

                    {/* Mobile Search */}
                    <div className="relative mb-2">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#71717A] pointer-events-none" />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            onInput={(e) => setSearchQuery((e.target as HTMLInputElement).value)}
                            placeholder="Search documentation..."
                            className="w-full bg-[#1A1A1A] border border-[#2A2A2A] focus:border-[#3E3E3E] rounded-lg pl-8 pr-7 py-1.5 text-[12.5px] text-[#EDEDEF] placeholder-[#71717A] outline-none"
                        />
                        {searchQuery && (
                            <button
                                type="button"
                                onClick={() => setSearchQuery('')}
                                className="absolute right-2 top-1/2 -translate-y-1/2 text-[#71717A] hover:text-[#EDEDEF]"
                            >
                                <X className="w-3 h-3" />
                            </button>
                        )}
                    </div>
                </div>

                {/* Drawer Nav Items */}
                <div className="flex-1 flex flex-col gap-1 px-3 overflow-y-auto no-scrollbar pb-6">
                    {filteredGroups.map((group, groupIdx) => (
                        <React.Fragment key={group.title}>
                            <div
                                className={cn(
                                    'px-2.5 py-1 text-[11px] font-semibold text-[#71717A] uppercase tracking-wider',
                                    groupIdx > 0 && 'mt-3'
                                )}
                            >
                                {group.title}
                            </div>
                            {group.items.map((item) => {
                                const IconComponent = item.icon
                                const isActive = activeTab === item.tab
                                return (
                                    <button
                                        key={item.slug}
                                        onClick={() => handleTabChange(item.tab)}
                                        className={cn(
                                            'relative flex items-center justify-between w-full px-2.5 h-[34px] rounded-[10px] transition-all group outline-none cursor-pointer',
                                            isActive
                                                ? 'bg-[#222222] text-[#EDEDEF] border border-[#2F2F2F]'
                                                : 'hover:bg-[#1C1C1C] text-[#9A9998] border border-transparent'
                                        )}
                                    >
                                        <div className="flex items-center gap-2.5 min-w-0">
                                            <IconComponent
                                                className={cn(
                                                    'w-4 h-4 shrink-0 transition-colors',
                                                    isActive
                                                        ? 'text-[#EDEDEF]'
                                                        : 'text-[#71717A] group-hover:text-[#EDEDEF]'
                                                )}
                                                strokeWidth={1.5}
                                            />
                                            <span className="font-medium text-[13px] truncate">
                                                {item.label}
                                            </span>
                                        </div>
                                    </button>
                                )
                            })}
                        </React.Fragment>
                    ))}
                </div>
            </div>

            {/* Main Desktop Container */}
            <div className="flex flex-col md:flex-row w-full h-full bg-[#141414] rounded-none md:rounded-lg border-0 md:border md:border-[#242323] overflow-hidden no-scrollbar [scrollbar-width:none] [-ms-overflow-style:none]">
                {/* Desktop sidebar: visible only on md: and up */}
                <div className="hidden md:flex w-[240px] shrink-0 border-r border-[#242323] flex-col py-4 no-scrollbar [scrollbar-width:none] [-ms-overflow-style:none]">
                    {/* Back button */}
                    <div className="px-4 mb-3">
                        <button
                            onClick={handleHome}
                            className="flex items-center text-[#8E8D8A] hover:text-[#EDEDEF] hover:bg-[#1A1A1A] px-2 py-1.5 -ml-2 rounded-lg text-[13px] font-medium transition-colors cursor-pointer"
                        >
                            <ChevronLeft className="w-4 h-4 mr-1.5" />
                            Back to App
                        </button>
                    </div>

                    {/* Search Filter */}
                    <div className="px-3 mb-3">
                        <div className="relative">
                            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#71717A] pointer-events-none" />
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                onInput={(e) =>
                                    setSearchQuery((e.target as HTMLInputElement).value)
                                }
                                placeholder="Search documentation..."
                                className="w-full bg-[#171717] border border-[#282828] focus:border-[#3E3E3E] rounded-lg pl-8 pr-7 py-1.5 text-[12.5px] text-[#EDEDEF] placeholder-[#71717A] outline-none transition-colors"
                            />
                            {searchQuery && (
                                <button
                                    type="button"
                                    onClick={() => setSearchQuery('')}
                                    className="absolute right-2 top-1/2 -translate-y-1/2 text-[#71717A] hover:text-[#EDEDEF]"
                                >
                                    <X className="w-3.5 h-3.5" />
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Nav Items Grouped */}
                    <div className="flex-1 flex flex-col gap-1 px-3 overflow-y-auto no-scrollbar [scrollbar-width:none] [-ms-overflow-style:none]">
                        {filteredGroups.map((group, groupIdx) => (
                            <React.Fragment key={group.title}>
                                <div
                                    className={cn(
                                        'px-2.5 py-1 text-[11px] font-semibold text-[#71717A] uppercase tracking-wider select-none',
                                        groupIdx > 0 && 'mt-3.5'
                                    )}
                                >
                                    {group.title}
                                </div>
                                {group.items.map((item) => {
                                    const IconComponent = item.icon
                                    const isActive = activeTab === item.tab
                                    return (
                                        <button
                                            key={item.slug}
                                            onClick={() => handleTabChange(item.tab)}
                                            className={cn(
                                                'group flex items-center gap-2.5 px-2.5 py-1.5 rounded-[10px] text-[13px] font-medium transition-all text-left cursor-pointer border',
                                                isActive
                                                    ? 'bg-[#222222] text-[#EDEDEF] border-[#2E2E2E]'
                                                    : 'text-[#9A9998] hover:text-[#EDEDEF] hover:bg-[#1A1A1A] border-transparent'
                                            )}
                                        >
                                            <IconComponent
                                                className={cn(
                                                    'w-4 h-4 shrink-0 transition-colors',
                                                    isActive
                                                        ? 'text-[#EDEDEF]'
                                                        : 'text-[#71717A] group-hover:text-[#EDEDEF]'
                                                )}
                                                strokeWidth={1.5}
                                            />
                                            <span className="truncate">{item.label}</span>
                                        </button>
                                    )
                                })}
                            </React.Fragment>
                        ))}
                    </div>
                </div>

                {/* Main Content Area */}
                <div className="flex-1 flex flex-col min-h-0 overflow-y-auto no-scrollbar [scrollbar-width:none] [-ms-overflow-style:none]">
                    {/* Mobile Top Bar */}
                    <MobileBreadcrumbsHeader
                        onOpenSidebar={() => setIsMobileDrawerOpen(true)}
                        onHomeClick={handleHome}
                        items={[
                            {
                                label: 'Docs',
                                onClick: () => setIsMobileDrawerOpen(true),
                            },
                            {
                                label: activeTab,
                                isLast: true,
                            },
                        ]}
                    />

                    {/* Mobile Content: Active Tab Content directly rendered */}
                    <div className="md:hidden flex flex-col p-4 pb-12 w-full no-scrollbar [scrollbar-width:none] [-ms-overflow-style:none]">
                        {renderTabContent()}
                    </div>

                    {/* Desktop Content Render: always visible on md: and up */}
                    <div className="hidden md:flex flex-1 justify-center px-8 lg:px-16 pt-8 md:pt-10 pb-16 relative z-10 no-scrollbar [scrollbar-width:none] [-ms-overflow-style:none]">
                        {renderTabContent()}
                    </div>
                </div>
            </div>
        </div>
    )
}
