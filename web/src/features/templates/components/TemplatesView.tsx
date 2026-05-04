import React, { useState, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

import { DUMMY_TEMPLATES, CATEGORIES, SORT_OPTIONS } from '../data'

import { TemplateCard } from './TemplateCard'
import { FeaturedTemplates } from './FeaturedTemplates'

import { Icons } from '@/shared/components/ui/Icons'

export const TemplatesView: React.FC = () => {
    const [searchQuery, setSearchQuery] = useState('')
    const [selectedCategory, setSelectedCategory] = useState<{ id: string; label: string } | null>(
        null
    )
    const [visibleCount, setVisibleCount] = useState(9)
    const [activeDropdown, setActiveDropdown] = useState<string | null>(null)
    const [selectedSort, setSelectedSort] = useState(SORT_OPTIONS[0]!)
    const dropdownRef = useRef<HTMLDivElement>(null)

    React.useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
                setActiveDropdown(null)
            }
        }
        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])

    const filteredGridTemplates = DUMMY_TEMPLATES.filter((template) => {
        const matchesSearch =
            template.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
            template.author.toLowerCase().includes(searchQuery.toLowerCase())
        const matchesCategory = selectedCategory ? template.category === selectedCategory.id : true
        return matchesSearch && matchesCategory
    })

    const visibleTemplates = filteredGridTemplates.slice(0, visibleCount)

    return (
        <div className="flex flex-col h-full bg-background overflow-hidden relative font-sans">
            <div className="flex-1 overflow-y-auto no-scrollbar pb-24 pt-8 md:pt-12">
                <div className="max-w-[1200px] mx-auto px-5 lg:px-8">
                    <>
                        {/* Page Header */}
                        <div className="mb-10 flex flex-col items-start gap-5">
                            <div className="flex flex-col gap-2">
                                <h1 className="text-[24px] font-medium text-[#D6D5C9] mb-1">
                                    Community Templates
                                </h1>
                                <p className="text-[13px] text-[#7B7A79] max-w-xl leading-relaxed">
                                    Discover websites, apps, components, and starters shared by the
                                    community — ready to remix, customize, and make your own.
                                </p>
                            </div>

                            {/* Search */}
                            <div className="relative w-full max-w-[400px]">
                                <Icons.Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#7B7A79]" />
                                <input
                                    type="text"
                                    className="w-full bg-[#171615] hover:bg-[#1E1D1B] focus:bg-[#1E1D1B] border border-[#383736] rounded-lg pl-9 pr-8 py-1.5 text-[13px] text-[#D6D5C9] placeholder:text-[#7B7A79] focus:outline-none focus:border-[#7B7A79] transition-colors"
                                    placeholder="Search templates..."
                                    value={searchQuery}
                                    onChange={(e) => {
                                        setSearchQuery(e.target.value)
                                        setVisibleCount(9)
                                    }}
                                />
                                {searchQuery && (
                                    <button
                                        onClick={() => {
                                            setSearchQuery('')
                                            setVisibleCount(9)
                                        }}
                                        className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-[#7B7A79] hover:text-[#D6D5C9] transition-colors"
                                    >
                                        <Icons.X className="w-3.5 h-3.5" />
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Featured Templates Section */}
                        <motion.div
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.1 }}
                        >
                            <FeaturedTemplates />
                        </motion.div>

                        {/* Templates Grid Section */}
                        <div>
                            {/* Section header + filters */}
                            <div className="flex items-center justify-between mb-4 border-b border-[#242323] pb-4">
                                <h2 className="text-[15px] font-medium text-[#D6D5C9]">
                                    {searchQuery ? 'Search Results' : 'Templates'}
                                </h2>

                                {/* Filter Pills */}
                                <div className="flex items-center gap-2" ref={dropdownRef}>
                                    {/* Sort */}
                                    <div className="relative">
                                        <button
                                            id="sort-filter-btn"
                                            onClick={() =>
                                                setActiveDropdown(
                                                    activeDropdown === 'sort' ? null : 'sort'
                                                )
                                            }
                                            className="flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-[#383736] bg-[#171615] text-[13px] text-[#D6D5C9] hover:bg-[#1E1D1B] transition-colors"
                                        >
                                            Sort: {selectedSort.label}
                                            <Icons.ChevronDown className="h-3 w-3 text-[#7B7A79]" />
                                        </button>
                                        <AnimatePresence>
                                            {activeDropdown === 'sort' && (
                                                <motion.div
                                                    initial={{ opacity: 0, y: -6, scale: 0.97 }}
                                                    animate={{ opacity: 1, y: 0, scale: 1 }}
                                                    exit={{ opacity: 0, y: -6, scale: 0.97 }}
                                                    transition={{ duration: 0.15 }}
                                                    className="absolute right-0 top-full mt-2 w-44 rounded-xl border border-[#383736] bg-[#1E1D1C] py-2 shadow-xl z-50"
                                                >
                                                    <div className="px-3 pb-2 text-[11px] font-medium text-[#7B7A79] border-b border-[#383736] mb-1 uppercase tracking-wider">
                                                        Sort by
                                                    </div>
                                                    {SORT_OPTIONS.map((opt) => (
                                                        <button
                                                            key={opt.id}
                                                            onClick={() => {
                                                                setSelectedSort(opt)
                                                                setActiveDropdown(null)
                                                                setVisibleCount(9)
                                                            }}
                                                            className="w-full flex items-center justify-between px-3 py-1.5 text-[13px] text-[#D6D5C9] hover:bg-[#242323] transition-colors"
                                                        >
                                                            {opt.label}
                                                            {selectedSort.id === opt.id && (
                                                                <Icons.Check className="h-3.5 w-3.5 text-[#7B7A79]" />
                                                            )}
                                                        </button>
                                                    ))}
                                                </motion.div>
                                            )}
                                        </AnimatePresence>
                                    </div>

                                    {/* Category */}
                                    <div className="relative">
                                        <button
                                            id="category-filter-btn"
                                            onClick={() =>
                                                setActiveDropdown(
                                                    activeDropdown === 'category'
                                                        ? null
                                                        : 'category'
                                                )
                                            }
                                            className="flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-[#383736] bg-[#171615] text-[13px] text-[#D6D5C9] hover:bg-[#1E1D1B] transition-colors"
                                        >
                                            Category:{' '}
                                            {selectedCategory ? selectedCategory.label : 'All'}
                                            <Icons.ChevronDown className="h-3 w-3 text-[#7B7A79]" />
                                        </button>
                                        <AnimatePresence>
                                            {activeDropdown === 'category' && (
                                                <motion.div
                                                    initial={{ opacity: 0, y: -6, scale: 0.97 }}
                                                    animate={{ opacity: 1, y: 0, scale: 1 }}
                                                    exit={{ opacity: 0, y: -6, scale: 0.97 }}
                                                    transition={{ duration: 0.15 }}
                                                    className="absolute right-0 top-full mt-2 w-48 rounded-xl border border-[#383736] bg-[#1E1D1C] py-2 shadow-xl z-50"
                                                >
                                                    <div className="px-3 pb-2 text-[11px] font-medium text-[#7B7A79] border-b border-[#383736] mb-1 uppercase tracking-wider">
                                                        Filter by
                                                    </div>
                                                    <button
                                                        onClick={() => {
                                                            setSelectedCategory(null)
                                                            setActiveDropdown(null)
                                                            setVisibleCount(9)
                                                        }}
                                                        className="w-full flex items-center justify-between px-3 py-1.5 text-[13px] text-[#D6D5C9] hover:bg-[#242323] transition-colors"
                                                    >
                                                        All
                                                        {!selectedCategory && (
                                                            <Icons.Check className="h-3.5 w-3.5 text-[#7B7A79]" />
                                                        )}
                                                    </button>
                                                    {CATEGORIES.map((cat) => (
                                                        <button
                                                            key={cat.id}
                                                            onClick={() => {
                                                                setSelectedCategory(cat)
                                                                setActiveDropdown(null)
                                                                setVisibleCount(9)
                                                            }}
                                                            className="w-full flex items-center justify-between px-3 py-1.5 text-[13px] text-[#D6D5C9] hover:bg-[#242323] transition-colors"
                                                        >
                                                            {cat.label}
                                                            {selectedCategory?.id === cat.id && (
                                                                <Icons.Check className="h-3.5 w-3.5 text-[#7B7A79]" />
                                                            )}
                                                        </button>
                                                    ))}
                                                </motion.div>
                                            )}
                                        </AnimatePresence>
                                    </div>
                                </div>
                            </div>

                            {/* Grid */}
                            {filteredGridTemplates.length > 0 ? (
                                <>
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-5 md:gap-x-6 gap-y-10">
                                        <AnimatePresence mode="popLayout">
                                            {visibleTemplates.map((template) => (
                                                <motion.div
                                                    key={template.id}
                                                    layout
                                                    initial={{ opacity: 0, scale: 0.98 }}
                                                    animate={{ opacity: 1, scale: 1 }}
                                                    exit={{ opacity: 0, scale: 0.98 }}
                                                    transition={{ duration: 0.2 }}
                                                >
                                                    <TemplateCard template={template} />
                                                </motion.div>
                                            ))}
                                        </AnimatePresence>
                                    </div>

                                    {/* Load More */}
                                    {visibleCount < filteredGridTemplates.length && (
                                        <div className="mt-14 flex justify-center">
                                            <button
                                                onClick={() => setVisibleCount((prev) => prev + 9)}
                                                className="px-4 py-1.5 rounded-md border border-[#383736] text-[13px] text-[#D6D5C9] hover:bg-[#1E1D1B] transition-colors"
                                            >
                                                Load more
                                            </button>
                                        </div>
                                    )}
                                </>
                            ) : (
                                <motion.div
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    className="flex flex-col items-center justify-center py-20 text-center"
                                >
                                    <div className="w-12 h-12 rounded-xl bg-[#171615] border border-[#383736] flex items-center justify-center mb-4 text-[#7B7A79]">
                                        <Icons.Search className="w-5 h-5" />
                                    </div>
                                    <h3 className="text-sm font-medium text-[#D6D5C9] mb-1.5">
                                        No templates found
                                    </h3>
                                    <p className="text-[#7B7A79] text-[13px] max-w-sm">
                                        We couldn't find any templates for this criteria.
                                    </p>
                                </motion.div>
                            )}
                        </div>
                    </>
                </div>
            </div>
        </div>
    )
}
