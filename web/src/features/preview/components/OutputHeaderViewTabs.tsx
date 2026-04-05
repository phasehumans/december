import React from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'

import { cn } from '@/shared/lib/utils'
import type { PreviewTab } from '@/features/preview/types'

interface OutputHeaderViewTabsProps {
    activeTab: PreviewTab
    setActiveTab: (tab: PreviewTab) => void
    isSidebarCollapsed: boolean
    onToggleSidebar: () => void
    onBack?: () => void
}

const ViewModeTab: React.FC<{
    label: string
    tab: PreviewTab
    activeTab: PreviewTab
    onSelect: (tab: PreviewTab) => void
}> = ({ label, tab, activeTab, onSelect }) => {
    return (
        <button
            onClick={() => onSelect(tab)}
            className={cn(
                'flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-medium transition-all border',
                activeTab === tab
                    ? 'bg-[#27272A] text-white border-white/10'
                    : 'text-[#91908F] border-transparent hover:text-white hover:bg-white/5'
            )}
        >
            {label}
        </button>
    )
}

export const OutputHeaderViewTabs: React.FC<OutputHeaderViewTabsProps> = ({
    activeTab,
    setActiveTab,
    isSidebarCollapsed,
    onToggleSidebar,
    onBack,
}) => {
    return (
        <div className="flex items-center gap-2">
            <button
                onClick={onBack}
                className="md:hidden p-1.5 text-[#91908F] hover:text-white mr-2"
            >
                <ChevronLeft size={20} />
            </button>

            <div className="hidden md:block">
                {isSidebarCollapsed && (
                    <button
                        onClick={onToggleSidebar}
                        className="p-1.5 text-[#91908F] hover:text-white hover:bg-white/5 rounded-md mr-1"
                        title="Open Sidebar"
                    >
                        <ChevronRight size={18} />
                    </button>
                )}
            </div>

            <div className="hidden md:flex items-center gap-2">
                <ViewModeTab
                    label="Preview"
                    tab="preview"
                    activeTab={activeTab}
                    onSelect={setActiveTab}
                />
                <ViewModeTab
                    label="Code"
                    tab="code"
                    activeTab={activeTab}
                    onSelect={setActiveTab}
                />
                <ViewModeTab
                    label="Canvas"
                    tab="canvas"
                    activeTab={activeTab}
                    onSelect={setActiveTab}
                />
            </div>
        </div>
    )
}
