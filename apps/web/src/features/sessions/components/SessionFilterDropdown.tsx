import React, { useState, useRef, useEffect } from 'react'
import { Icons } from '@/shared/components/ui/Icons'

// ── Filter state type ──────────────────────────────────────────────
export type SessionFilterState = {
    types: Array<'WEB' | 'CLI' | 'SEARCH'>
    archivedStatus: 'any' | 'archived' | 'not_archived'
    pinnedStatus: 'any' | 'pinned' | 'not_pinned'
    tags: string[]
}

export const DEFAULT_FILTERS: SessionFilterState = {
    types: [],
    archivedStatus: 'any',
    pinnedStatus: 'any',
    tags: [],
}

export const hasActiveFilters = (filters: SessionFilterState): boolean =>
    filters.types.length > 0 ||
    filters.archivedStatus !== 'any' ||
    filters.pinnedStatus !== 'any' ||
    filters.tags.length > 0

export const countActiveFilters = (filters: SessionFilterState): number => {
    let count = 0
    if (filters.types.length > 0) count++
    if (filters.archivedStatus !== 'any') count++
    if (filters.pinnedStatus !== 'any') count++
    if (filters.tags.length > 0) count++
    return count
}

// ── Filter menu category definitions ──────────────────────────────
type FilterCategory = {
    id: string
    label: string
    icon: React.ReactNode
}

const FILTER_CATEGORIES: FilterCategory[] = [
    {
        id: 'type',
        label: 'Type',
        icon: <Icons.Layers className="h-4 w-4" />,
    },
    {
        id: 'archived',
        label: 'Archived Status',
        icon: <Icons.Archive className="h-4 w-4" />,
    },
    {
        id: 'pinned',
        label: 'Pinned Status',
        icon: <Icons.Pin className="h-4 w-4" />,
    },
    {
        id: 'tags',
        label: 'Tags',
        icon: <Icons.Bookmark className="h-4 w-4" />,
    },
]

// ── Sub-panel: Type ───────────────────────────────────────────────
const TypeSubPanel: React.FC<{
    selected: Array<'WEB' | 'CLI' | 'SEARCH'>
    onChange: (types: Array<'WEB' | 'CLI' | 'SEARCH'>) => void
}> = ({ selected, onChange }) => {
    const [search, setSearch] = useState('')

    const options: { value: 'WEB' | 'CLI' | 'SEARCH'; label: string }[] = [
        { value: 'WEB', label: 'Web' },
        { value: 'CLI', label: 'CLI' },
        { value: 'SEARCH', label: 'Search' },
    ]

    const filtered = options.filter((o) => o.label.toLowerCase().includes(search.toLowerCase()))

    const toggle = (val: 'WEB' | 'CLI' | 'SEARCH') => {
        if (selected.includes(val)) {
            onChange(selected.filter((v) => v !== val))
        } else {
            onChange([...selected, val])
        }
    }

    return (
        <div className="w-56 rounded-xl border border-[#383736] bg-[#1F1F1F] py-1 shadow-xl">
            <div className="px-3 py-2">
                <input
                    type="text"
                    placeholder="Search types..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full rounded-md border border-[#383736] bg-[#141414] px-3 py-1.5 text-[13px] text-[#D6D5C9] placeholder:text-[#7B7A79] focus:border-[#7B7A79] focus:outline-none"
                    autoFocus
                />
            </div>
            <div className="max-h-48 overflow-y-auto">
                {filtered.map((opt) => {
                    const isActive = selected.includes(opt.value)
                    return (
                        <button
                            key={opt.value}
                            onClick={() => toggle(opt.value)}
                            className={`flex w-full items-center gap-3 px-3 py-2 text-[13px] transition-colors ${
                                isActive
                                    ? 'bg-[#242323] text-[#D6D5C9]'
                                    : 'text-[#D6D5C9] hover:bg-[#242323]'
                            }`}
                        >
                            <span
                                className={`flex h-4 w-4 items-center justify-center rounded border ${
                                    isActive
                                        ? 'border-blue-500 bg-blue-500'
                                        : 'border-[#4A4948] bg-transparent'
                                }`}
                            >
                                {isActive && <Icons.Check className="h-3 w-3 text-white" />}
                            </span>
                            {opt.label}
                        </button>
                    )
                })}
                {filtered.length === 0 && (
                    <div className="px-3 py-3 text-[12px] text-[#7B7A79]">No types found</div>
                )}
            </div>
        </div>
    )
}

// ── Sub-panel: Archived Status ────────────────────────────────────
const ArchivedSubPanel: React.FC<{
    selected: 'any' | 'archived' | 'not_archived'
    onChange: (val: 'any' | 'archived' | 'not_archived') => void
}> = ({ selected, onChange }) => {
    const options: { value: 'any' | 'archived' | 'not_archived'; label: string }[] = [
        { value: 'any', label: 'Any' },
        { value: 'not_archived', label: 'Not Archived' },
        { value: 'archived', label: 'Archived' },
    ]

    return (
        <div className="w-56 rounded-xl border border-[#383736] bg-[#1F1F1F] py-1 shadow-xl">
            <div className="px-3 py-2">
                <input
                    type="text"
                    placeholder="Search archived states..."
                    className="w-full rounded-md border border-[#383736] bg-[#141414] px-3 py-1.5 text-[13px] text-[#D6D5C9] placeholder:text-[#7B7A79] focus:border-[#7B7A79] focus:outline-none"
                    disabled
                />
            </div>
            <div className="max-h-48 overflow-y-auto">
                {options.map((opt) => {
                    const isActive = selected === opt.value
                    return (
                        <button
                            key={opt.value}
                            onClick={() => onChange(opt.value)}
                            className={`flex w-full items-center gap-3 px-3 py-2 text-[13px] transition-colors ${
                                isActive
                                    ? 'bg-[#242323] text-[#D6D5C9]'
                                    : 'text-[#D6D5C9] hover:bg-[#242323]'
                            }`}
                        >
                            <span
                                className={`flex h-4 w-4 items-center justify-center rounded-full border ${
                                    isActive
                                        ? 'border-blue-500 bg-blue-500'
                                        : 'border-[#4A4948] bg-transparent'
                                }`}
                            >
                                {isActive && (
                                    <span className="block h-1.5 w-1.5 rounded-full bg-white" />
                                )}
                            </span>
                            {opt.label}
                        </button>
                    )
                })}
            </div>
        </div>
    )
}

// ── Sub-panel: Pinned Status ──────────────────────────────────────
const PinnedSubPanel: React.FC<{
    selected: 'any' | 'pinned' | 'not_pinned'
    onChange: (val: 'any' | 'pinned' | 'not_pinned') => void
}> = ({ selected, onChange }) => {
    const options: { value: 'any' | 'pinned' | 'not_pinned'; label: string }[] = [
        { value: 'any', label: 'Any' },
        { value: 'pinned', label: 'Pinned' },
        { value: 'not_pinned', label: 'Not Pinned' },
    ]

    return (
        <div className="w-56 rounded-xl border border-[#383736] bg-[#1F1F1F] py-1 shadow-xl">
            <div className="px-3 py-2">
                <input
                    type="text"
                    placeholder="Search pinned states..."
                    className="w-full rounded-md border border-[#383736] bg-[#141414] px-3 py-1.5 text-[13px] text-[#D6D5C9] placeholder:text-[#7B7A79] focus:border-[#7B7A79] focus:outline-none"
                    disabled
                />
            </div>
            <div className="max-h-48 overflow-y-auto">
                {options.map((opt) => {
                    const isActive = selected === opt.value
                    return (
                        <button
                            key={opt.value}
                            onClick={() => onChange(opt.value)}
                            className={`flex w-full items-center gap-3 px-3 py-2 text-[13px] transition-colors ${
                                isActive
                                    ? 'bg-[#242323] text-[#D6D5C9]'
                                    : 'text-[#D6D5C9] hover:bg-[#242323]'
                            }`}
                        >
                            <span
                                className={`flex h-4 w-4 items-center justify-center rounded-full border ${
                                    isActive
                                        ? 'border-blue-500 bg-blue-500'
                                        : 'border-[#4A4948] bg-transparent'
                                }`}
                            >
                                {isActive && (
                                    <span className="block h-1.5 w-1.5 rounded-full bg-white" />
                                )}
                            </span>
                            {opt.label}
                        </button>
                    )
                })}
            </div>
        </div>
    )
}

// ── Sub-panel: Tags ───────────────────────────────────────────────
const TagsSubPanel: React.FC<{
    selected: string[]
    onChange: (tags: string[]) => void
    availableTags: string[]
}> = ({ selected, onChange, availableTags }) => {
    const [search, setSearch] = useState('')

    const filtered = availableTags.filter((tag) => tag.toLowerCase().includes(search.toLowerCase()))

    const toggle = (tag: string) => {
        if (selected.includes(tag)) {
            onChange(selected.filter((t) => t !== tag))
        } else {
            onChange([...selected, tag])
        }
    }

    return (
        <div className="w-56 rounded-xl border border-[#383736] bg-[#1F1F1F] py-1 shadow-xl">
            <div className="px-3 py-2">
                <input
                    type="text"
                    placeholder="Search tags..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full rounded-md border border-[#383736] bg-[#141414] px-3 py-1.5 text-[13px] text-[#D6D5C9] placeholder:text-[#7B7A79] focus:border-[#7B7A79] focus:outline-none"
                    autoFocus
                />
            </div>
            {filtered.length > 0 && (
                <div className="px-3 pb-1 pt-1 text-[11px] font-medium uppercase tracking-wider text-[#7B7A79]">
                    Available tags
                </div>
            )}
            <div className="max-h-48 overflow-y-auto">
                {filtered.map((tag) => {
                    const isActive = selected.includes(tag)
                    return (
                        <button
                            key={tag}
                            onClick={() => toggle(tag)}
                            className={`flex w-full items-center gap-3 px-3 py-2 text-[13px] transition-colors ${
                                isActive
                                    ? 'bg-[#242323] text-[#D6D5C9]'
                                    : 'text-[#D6D5C9] hover:bg-[#242323]'
                            }`}
                        >
                            <span
                                className={`flex h-4 w-4 items-center justify-center rounded border ${
                                    isActive
                                        ? 'border-blue-500 bg-blue-500'
                                        : 'border-[#4A4948] bg-transparent'
                                }`}
                            >
                                {isActive && <Icons.Check className="h-3 w-3 text-white" />}
                            </span>
                            {tag}
                        </button>
                    )
                })}
                {filtered.length === 0 && (
                    <div className="px-3 py-3 text-[12px] text-[#7B7A79]">
                        {availableTags.length === 0 ? 'No tags available' : 'No tags found'}
                    </div>
                )}
            </div>
        </div>
    )
}

// ── Main dropdown component ───────────────────────────────────────
interface SessionFilterDropdownProps {
    filters: SessionFilterState
    onFiltersChange: (filters: SessionFilterState) => void
    availableTags: string[]
}

export const SessionFilterDropdown: React.FC<SessionFilterDropdownProps> = ({
    filters,
    onFiltersChange,
    availableTags,
}) => {
    const [isOpen, setIsOpen] = useState(false)
    const [hoveredCategory, setHoveredCategory] = useState<string | null>(null)
    const containerRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false)
                setHoveredCategory(null)
            }
        }
        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])

    const activeCount = countActiveFilters(filters)

    const handleClearAll = () => {
        onFiltersChange({ ...DEFAULT_FILTERS })
        setIsOpen(false)
        setHoveredCategory(null)
    }

    const renderSubPanel = () => {
        switch (hoveredCategory) {
            case 'type':
                return (
                    <TypeSubPanel
                        selected={filters.types}
                        onChange={(types) => onFiltersChange({ ...filters, types })}
                    />
                )
            case 'archived':
                return (
                    <ArchivedSubPanel
                        selected={filters.archivedStatus}
                        onChange={(archivedStatus) =>
                            onFiltersChange({ ...filters, archivedStatus })
                        }
                    />
                )
            case 'pinned':
                return (
                    <PinnedSubPanel
                        selected={filters.pinnedStatus}
                        onChange={(pinnedStatus) => onFiltersChange({ ...filters, pinnedStatus })}
                    />
                )
            case 'tags':
                return (
                    <TagsSubPanel
                        selected={filters.tags}
                        onChange={(tags) => onFiltersChange({ ...filters, tags })}
                        availableTags={availableTags}
                    />
                )
            default:
                return null
        }
    }

    // Check if a category has active filters for a dot indicator
    const isCategoryActive = (id: string): boolean => {
        switch (id) {
            case 'type':
                return filters.types.length > 0
            case 'archived':
                return filters.archivedStatus !== 'any'
            case 'pinned':
                return filters.pinnedStatus !== 'any'
            case 'tags':
                return filters.tags.length > 0
            default:
                return false
        }
    }

    return (
        <div className="relative" ref={containerRef}>
            <button
                onClick={() => {
                    setIsOpen(!isOpen)
                    if (isOpen) setHoveredCategory(null)
                }}
                className={`flex items-center gap-2 rounded-full border px-4 py-1.5 text-[13px] transition-colors ${
                    isOpen || activeCount > 0
                        ? 'border-[#4A4948] bg-[#191919] text-[#D6D5C9]'
                        : 'border-[#383736] bg-[#141414] text-[#D6D5C9] hover:bg-[#191919]'
                }`}
            >
                <Icons.SlidersVertical className="h-3.5 w-3.5 text-[#7B7A79]" />
                Filter
                {activeCount > 0 && (
                    <span className="flex h-4 min-w-[16px] items-center justify-center rounded-full bg-blue-500 px-1 text-[10px] font-medium text-white">
                        {activeCount}
                    </span>
                )}
                <Icons.ChevronDown className="h-3.5 w-3.5 text-[#7B7A79]" />
            </button>

            {isOpen && (
                <div className="absolute right-0 top-full mt-2 z-50 flex gap-0">
                    {/* Main category menu */}
                    <div className="w-52 rounded-xl border border-[#383736] bg-[#1E1E1E] py-1.5 shadow-xl">
                        {FILTER_CATEGORIES.map((cat) => (
                            <button
                                key={cat.id}
                                onMouseEnter={() => setHoveredCategory(cat.id)}
                                onClick={() =>
                                    setHoveredCategory(hoveredCategory === cat.id ? null : cat.id)
                                }
                                className={`flex w-full items-center justify-between px-3 py-2 text-[13px] transition-colors ${
                                    hoveredCategory === cat.id
                                        ? 'bg-[#242323] text-[#D6D5C9]'
                                        : 'text-[#D6D5C9] hover:bg-[#242323]'
                                }`}
                            >
                                <span className="flex items-center gap-2.5">
                                    <span className="text-[#7B7A79]">{cat.icon}</span>
                                    {cat.label}
                                    {isCategoryActive(cat.id) && (
                                        <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />
                                    )}
                                </span>
                                <Icons.ChevronRight className="h-3.5 w-3.5 text-[#4A4948]" />
                            </button>
                        ))}

                        {/* Divider + Clear all */}
                        <div className="mx-2 my-1.5 h-px bg-[#383736]" />
                        <button
                            onClick={handleClearAll}
                            disabled={activeCount === 0}
                            className={`flex w-full items-center gap-2.5 px-3 py-2 text-[13px] transition-colors ${
                                activeCount === 0
                                    ? 'cursor-not-allowed text-[#4A4948]'
                                    : 'text-[#D6D5C9] hover:bg-[#242323]'
                            }`}
                        >
                            <Icons.X className="h-4 w-4 text-[#7B7A79]" />
                            Clear all filters
                        </button>
                    </div>

                    {/* Sub-panel rendered to the right */}
                    {hoveredCategory && <div className="ml-1">{renderSubPanel()}</div>}
                </div>
            )}
        </div>
    )
}
