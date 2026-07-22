import React, { useState, useRef, useEffect } from 'react'

import { Icons } from '@/shared/components/ui/Icons'

export type SessionFiltersState = {
    type?: 'WEB' | 'CLI' | 'SEARCH'
    isArchived?: boolean
    isPinned?: boolean
    tags?: string[]
}

interface FilterPopoverProps {
    filters: SessionFiltersState
    onFiltersChange: (filters: SessionFiltersState) => void
}

export const SessionFilterPopover: React.FC<FilterPopoverProps> = ({
    filters,
    onFiltersChange,
}) => {
    const [isOpen, setIsOpen] = useState(false)
    const [activeMenu, setActiveMenu] = useState<'main' | 'type' | 'archived' | 'pinned'>('main')
    const popoverRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
                setIsOpen(false)
                setActiveMenu('main')
            }
        }
        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])

    const hasActiveFilters =
        filters.type ||
        filters.isArchived !== undefined ||
        filters.isPinned !== undefined ||
        (filters.tags && filters.tags.length > 0)

    const handleClear = () => {
        onFiltersChange({})
        setIsOpen(false)
    }

    return (
        <div className="relative" ref={popoverRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className={`flex items-center gap-2 rounded-lg border px-4 py-1.5 text-[13px] transition-colors ${
                    hasActiveFilters
                        ? 'border-[#4A4948] bg-[#202020] text-[#949494]'
                        : 'border-[#282828] bg-[#202020] text-[#949494] hover:bg-[#282828]'
                }`}
            >
                Add filters
                {hasActiveFilters && (
                    <div className="ml-1 flex h-4 w-4 items-center justify-center rounded-full bg-[#383736] text-[10px] text-white">
                        {Object.keys(filters).length}
                    </div>
                )}
            </button>

            {isOpen && (
                <div className="absolute left-0 top-full mt-2 z-50 w-64 rounded-xl border border-[#383736] bg-[#1A1918] py-2 shadow-2xl backdrop-blur-md overflow-hidden animate-in fade-in zoom-in-95 duration-100">
                    {activeMenu === 'main' && (
                        <div className="flex flex-col">
                            <div className="px-3 py-1.5 flex justify-between items-center text-[#7B7A79] text-xs font-medium uppercase tracking-wider">
                                Filters
                                {hasActiveFilters && (
                                    <button
                                        onClick={handleClear}
                                        className="text-[#D6D5C9] hover:text-white transition-colors"
                                    >
                                        Clear
                                    </button>
                                )}
                            </div>

                            <button
                                onClick={() => setActiveMenu('type')}
                                className="flex w-full items-center justify-between px-3 py-2 text-[13px] text-[#D6D5C9] hover:bg-[#262524] transition-colors"
                            >
                                <div className="flex items-center gap-3">
                                    <Icons.Robot className="h-4 w-4 text-[#7B7A79]" />
                                    Type
                                </div>
                                <Icons.ChevronRight className="h-4 w-4 text-[#7B7A79]" />
                            </button>

                            <button
                                onClick={() => setActiveMenu('archived')}
                                className="flex w-full items-center justify-between px-3 py-2 text-[13px] text-[#D6D5C9] hover:bg-[#262524] transition-colors"
                            >
                                <div className="flex items-center gap-3">
                                    <Icons.Archive className="h-4 w-4 text-[#7B7A79]" />
                                    Archived Status
                                </div>
                                <Icons.ChevronRight className="h-4 w-4 text-[#7B7A79]" />
                            </button>

                            <button
                                onClick={() => setActiveMenu('pinned')}
                                className="flex w-full items-center justify-between px-3 py-2 text-[13px] text-[#D6D5C9] hover:bg-[#262524] transition-colors"
                            >
                                <div className="flex items-center gap-3">
                                    <Icons.Pin className="h-4 w-4 text-[#7B7A79]" />
                                    Pinned Status
                                </div>
                                <Icons.ChevronRight className="h-4 w-4 text-[#7B7A79]" />
                            </button>
                        </div>
                    )}

                    {activeMenu === 'type' && (
                        <div className="flex flex-col">
                            <div className="flex items-center gap-2 px-3 py-2 border-b border-[#383736] text-[13px] text-[#D6D5C9]">
                                <button
                                    onClick={() => setActiveMenu('main')}
                                    className="p-1 hover:bg-[#262524] rounded-md transition-colors text-[#7B7A79]"
                                >
                                    <Icons.ChevronLeft className="h-4 w-4" />
                                </button>
                                Select Type
                            </div>
                            {['WEB', 'CLI', 'SEARCH'].map((t) => (
                                <button
                                    key={t}
                                    onClick={() => onFiltersChange({ ...filters, type: t as any })}
                                    className="flex w-full items-center justify-between px-4 py-2 text-[13px] text-[#D6D5C9] hover:bg-[#262524]"
                                >
                                    {t}
                                    {filters.type === t && (
                                        <Icons.Check className="h-4 w-4 text-[#D6D5C9]" />
                                    )}
                                </button>
                            ))}
                        </div>
                    )}

                    {activeMenu === 'archived' && (
                        <div className="flex flex-col">
                            <div className="flex items-center gap-2 px-3 py-2 border-b border-[#383736] text-[13px] text-[#D6D5C9]">
                                <button
                                    onClick={() => setActiveMenu('main')}
                                    className="p-1 hover:bg-[#262524] rounded-md transition-colors text-[#7B7A79]"
                                >
                                    <Icons.ChevronLeft className="h-4 w-4" />
                                </button>
                                Archived Status
                            </div>
                            <button
                                onClick={() => onFiltersChange({ ...filters, isArchived: true })}
                                className="flex w-full items-center justify-between px-4 py-2 text-[13px] text-[#D6D5C9] hover:bg-[#262524]"
                            >
                                Archived
                                {filters.isArchived === true && (
                                    <Icons.Check className="h-4 w-4 text-[#D6D5C9]" />
                                )}
                            </button>
                            <button
                                onClick={() => onFiltersChange({ ...filters, isArchived: false })}
                                className="flex w-full items-center justify-between px-4 py-2 text-[13px] text-[#D6D5C9] hover:bg-[#262524]"
                            >
                                Active
                                {filters.isArchived === false && (
                                    <Icons.Check className="h-4 w-4 text-[#D6D5C9]" />
                                )}
                            </button>
                        </div>
                    )}

                    {activeMenu === 'pinned' && (
                        <div className="flex flex-col">
                            <div className="flex items-center gap-2 px-3 py-2 border-b border-[#383736] text-[13px] text-[#D6D5C9]">
                                <button
                                    onClick={() => setActiveMenu('main')}
                                    className="p-1 hover:bg-[#262524] rounded-md transition-colors text-[#7B7A79]"
                                >
                                    <Icons.ChevronLeft className="h-4 w-4" />
                                </button>
                                Pinned Status
                            </div>
                            <button
                                onClick={() => onFiltersChange({ ...filters, isPinned: true })}
                                className="flex w-full items-center justify-between px-4 py-2 text-[13px] text-[#D6D5C9] hover:bg-[#262524]"
                            >
                                Pinned
                                {filters.isPinned === true && (
                                    <Icons.Check className="h-4 w-4 text-[#D6D5C9]" />
                                )}
                            </button>
                            <button
                                onClick={() => onFiltersChange({ ...filters, isPinned: false })}
                                className="flex w-full items-center justify-between px-4 py-2 text-[13px] text-[#D6D5C9] hover:bg-[#262524]"
                            >
                                Unpinned
                                {filters.isPinned === false && (
                                    <Icons.Check className="h-4 w-4 text-[#D6D5C9]" />
                                )}
                            </button>
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}
