import { ChevronLeft } from 'lucide-react'
import React, { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

import { DOCS_NAV_GROUPS, pathToDocTab, docTabToPath, docTabToTitle } from '../types'

import { DocsArchitecture } from './sections/DocsArchitecture'
import { DocsCliReference } from './sections/DocsCliReference'
import { DocsIntroduction } from './sections/DocsIntroduction'
import { DocsQuickStart } from './sections/DocsQuickStart'

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

    const renderTabContent = () => {
        switch (activeTab) {
            case 'Introduction':
                return <DocsIntroduction />
            case 'Quick Start':
                return <DocsQuickStart />
            case 'Architecture':
                return <DocsArchitecture />
            case 'CLI Reference':
                return <DocsCliReference />
            case 'Privacy Policy':
                return <PrivacyPolicyContent />
            case 'Terms of Service':
                return <TermsOfServiceContent />
            default:
                return <DocsIntroduction />
        }
    }

    return (
        <div className="flex w-full h-full bg-[#141414] md:bg-[#100E12] overflow-hidden p-0 md:p-[8px] no-scrollbar [scrollbar-width:none] [-ms-overflow-style:none]">
            {/* Mobile Drawer Backdrop */}
            <div
                className={cn(
                    'fixed inset-0 bg-black/50 z-40 md:hidden transition-opacity duration-300 ease-[cubic-bezier(0.2,0.8,0.2,1)]',
                    isMobileDrawerOpen
                        ? 'opacity-100 pointer-events-auto'
                        : 'opacity-0 pointer-events-none'
                )}
                onClick={() => setIsMobileDrawerOpen(false)}
            />

            {/* Mobile Drawer: Consistent with settings page mobile drawer */}
            <div
                className={cn(
                    'fixed inset-y-0 left-0 w-[240px] bg-sidebar border-r border-white/5 z-[60] md:hidden flex flex-col pt-2 pb-0 transition-transform duration-300 ease-[cubic-bezier(0.2,0.8,0.2,1)] will-change-transform font-sans',
                    isMobileDrawerOpen
                        ? 'translate-x-0 pointer-events-auto'
                        : '-translate-x-full pointer-events-none'
                )}
            >
                {/* Drawer Header */}
                <div className="px-3 mb-2 mt-0 z-30 relative">
                    <div className="flex items-center justify-between px-2 mb-6 mt-4">
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
                </div>

                {/* Drawer Nav Items */}
                <div className="flex-1 flex flex-col gap-[2px] px-3 overflow-y-auto no-scrollbar pb-6">
                    {DOCS_NAV_GROUPS.map((group, groupIdx) => (
                        <React.Fragment key={group.title}>
                            <div
                                className={cn(
                                    'px-2.5 py-1.5 text-[12px] font-medium text-[#919191] tracking-tight mb-0.5',
                                    groupIdx > 0 && 'mt-4'
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
                                            'relative flex items-center justify-between w-full px-2.5 h-[32px] rounded-[10px] transition-all group outline-none cursor-pointer',
                                            isActive ? 'bg-[#1F1F1F]' : 'hover:bg-[#1C1C1C]'
                                        )}
                                    >
                                        <div className="flex items-center gap-2.5 min-w-0">
                                            <div
                                                className={cn(
                                                    'transition-colors flex items-center justify-center shrink-0',
                                                    isActive
                                                        ? 'text-[#D6D5D4]'
                                                        : 'text-[#919191] group-hover:text-[#D6D5D4]'
                                                )}
                                            >
                                                <IconComponent
                                                    className="w-[18px] h-[18px]"
                                                    strokeWidth={1.5}
                                                />
                                            </div>
                                            <span
                                                className={cn(
                                                    'font-medium text-[14px] tracking-wide transition-colors truncate',
                                                    isActive
                                                        ? 'text-[#D6D5D4]'
                                                        : 'text-[#919191] group-hover:text-[#D6D5D4]'
                                                )}
                                            >
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

            {/* Main Container */}
            <div className="flex flex-col md:flex-row w-full h-full bg-[#141414] rounded-none md:rounded-lg border-0 md:border md:border-[#242323] overflow-hidden no-scrollbar [scrollbar-width:none] [-ms-overflow-style:none]">
                {/* Desktop sidebar: visible only on md: and up */}
                <div className="hidden md:flex w-[220px] shrink-0 border-r border-[#242323] flex-col py-4 no-scrollbar [scrollbar-width:none] [-ms-overflow-style:none]">
                    <div className="px-4 mb-6">
                        <button
                            onClick={handleHome}
                            className="flex items-center text-[#7B7A79] hover:text-[#D6D5D4] hover:bg-[#191919] px-2 py-1 -ml-2 rounded-lg text-[13px] font-medium transition-colors cursor-pointer"
                        >
                            <ChevronLeft className="w-4 h-4 mr-2" />
                            Back
                        </button>
                    </div>

                    <div className="flex flex-col gap-[2px] px-3 overflow-y-auto no-scrollbar [scrollbar-width:none] [-ms-overflow-style:none]">
                        {DOCS_NAV_GROUPS.map((group, groupIdx) => (
                            <React.Fragment key={group.title}>
                                <div
                                    className={cn(
                                        'px-3 py-2 text-[12px] font-medium text-[#7B7A79] mb-1',
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
                                                'flex items-center gap-3 px-3 py-1.5 rounded-[10px] text-[13px] font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer',
                                                isActive
                                                    ? 'bg-[#242323] text-[#D6D5C9]'
                                                    : 'text-[#D6D5C9] hover:bg-[#191919]'
                                            )}
                                        >
                                            <IconComponent
                                                className="w-[18px] h-[18px]"
                                                strokeWidth={1.5}
                                            />
                                            {item.label}
                                        </button>
                                    )
                                })}
                            </React.Fragment>
                        ))}
                    </div>
                </div>

                {/* Mobile View with top bar and direct subpage content */}
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
                    <div className="md:hidden flex flex-col p-4 pb-8 w-full no-scrollbar [scrollbar-width:none] [-ms-overflow-style:none]">
                        {renderTabContent()}
                    </div>

                    {/* Desktop Content Render: always visible on md: and up */}
                    <div className="hidden md:flex flex-1 justify-center px-6 md:px-16 pt-8 md:pt-12 pb-6 md:pb-8 relative z-10 no-scrollbar [scrollbar-width:none] [-ms-overflow-style:none]">
                        {renderTabContent()}
                    </div>
                </div>
            </div>
        </div>
    )
}
