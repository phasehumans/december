import { AnimatePresence, motion } from 'framer-motion'
import React from 'react'

import { CATEGORIES, SORT_OPTIONS } from '../data'

import { EmptyTemplatesState } from './EmptyTemplatesState'
import { FeaturedTemplates } from './FeaturedTemplates'
import { TemplateCard } from './TemplateCard'
import { TemplateRemixModal } from './TemplateRemixModal'
import { TemplatesSkeleton } from './TemplatesSkeleton'

import { useTemplatesController } from '@/features/templates/hooks/useTemplatesController'
import { ErrorAlert } from '@/shared/components/ui/ErrorAlert'
import { Icons } from '@/shared/components/ui/Icons'

interface TemplatesViewProps {
    onOpenProject: (projectId: string) => void
}

export const TemplatesView: React.FC<TemplatesViewProps> = ({ onOpenProject }) => {
    const {
        searchQuery,
        setSearchQuery,
        selectedCategory,
        setSelectedCategory,
        visibleCount,
        setVisibleCount,
        activeDropdown,
        setActiveDropdown,
        dropdownDirection,
        selectedSort,
        setSelectedSort,
        likePendingTemplateId,
        remixPendingTemplateId,
        remixModal,
        setRemixModal,
        dropdownRef,
        likeMutation,
        hasTemplates,
        filteredFeaturedTemplates,
        hasFeaturedTemplates,
        filteredGridTemplates,
        visibleTemplates,
        displayedError,
        openRemixModal,
        handleRemixTemplate,
        isInitialLoading,
        toggleDropdown,
    } = useTemplatesController(onOpenProject)

    return (
        <div className="flex flex-col absolute inset-0 bg-background overflow-hidden font-sans">
            <div className="relative h-full w-full flex-1 flex-col overflow-y-auto bg-background px-8 pb-8 pt-20 font-sans md:p-16 [&::-webkit-scrollbar]:w-[12px] [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-[#383736] [&::-webkit-scrollbar-thumb]:bg-clip-padding [&::-webkit-scrollbar-thumb]:border-[4px] [&::-webkit-scrollbar-thumb]:border-solid [&::-webkit-scrollbar-thumb]:border-transparent [&::-webkit-scrollbar-thumb]:rounded-full hover:[&::-webkit-scrollbar-thumb]:bg-[#4A4948]">
                <div className="relative z-10 mx-auto max-w-[1200px] w-full flex-1 flex flex-col">
                    <div className="mb-10 flex flex-col items-start gap-5">
                        <div className="flex flex-col gap-2">
                            <h1 className="text-[24px] font-medium text-[#D6D5C9] mb-1">
                                Community Templates
                            </h1>
                            <p className="text-[13px] text-[#7B7A79] max-w-xl leading-relaxed">
                                Explore community-built apps, websites, and components ready to
                                remix and make your own.
                            </p>
                        </div>

                        <div className="relative w-full max-w-[400px]">
                            <Icons.Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#7B7A79]" />
                            <input
                                type="text"
                                className="w-full bg-[#141414] hover:bg-[#191919] focus:bg-[#191919] border border-[#383736] rounded-lg pl-9 pr-8 py-1.5 text-[13px] text-[#D6D5C9] placeholder:text-[#7B7A79] focus:outline-none focus:border-[#7B7A79] transition-colors"
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

                    {displayedError && (
                        <div className="mb-6 w-full flex justify-start">
                            <ErrorAlert message={displayedError} />
                        </div>
                    )}

                    {isInitialLoading ? (
                        <TemplatesSkeleton />
                    ) : !hasTemplates ? (
                        <EmptyTemplatesState />
                    ) : (
                        <>
                            {hasFeaturedTemplates && (
                                <motion.div
                                    initial={{ opacity: 0, y: 8 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: 0.1 }}
                                >
                                    <FeaturedTemplates
                                        templates={filteredFeaturedTemplates}
                                        likePendingTemplateId={likePendingTemplateId}
                                        remixPendingTemplateId={remixPendingTemplateId}
                                        onToggleLike={(template) =>
                                            likeMutation.mutate({
                                                templateId: template.id,
                                                isLiked: !template.isLiked,
                                            })
                                        }
                                        onRemix={openRemixModal}
                                    />
                                </motion.div>
                            )}

                            <div>
                                <div className="flex items-center justify-between mb-4 border-b border-[#242323] pb-4">
                                    <h2 className="text-[15px] font-medium text-[#D6D5C9]">
                                        {searchQuery ? 'Search Results' : 'Templates'}
                                    </h2>

                                    <div
                                        className="hidden md:flex items-center gap-2"
                                        ref={dropdownRef}
                                    >
                                        <div className="relative">
                                            <button
                                                id="sort-filter-btn"
                                                onClick={(e) => toggleDropdown('sort', e)}
                                                className="flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-[#383736] bg-[#141414] text-[13px] text-[#D6D5C9] hover:bg-[#191919] transition-colors"
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
                                                        className={`absolute right-0 ${dropdownDirection === 'up' ? 'bottom-full mb-2' : 'top-full mt-2'} w-44 rounded-xl border border-[#383736] bg-[#1E1E1E] py-2 shadow-xl z-50`}
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
                                                                className="w-full flex items-center justify-between px-3 py-1.5 text-[13px] text-[#D6D5C9] hover:bg-[#262626] transition-colors"
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

                                        <div className="relative">
                                            <button
                                                id="category-filter-btn"
                                                onClick={(e) => toggleDropdown('category', e)}
                                                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-full border transition-colors text-[13px] ${
                                                    selectedCategory
                                                        ? 'border-[#D6D5C9] bg-[#D6D5C9] text-[#141414] font-medium hover:bg-[#E8E7E4]'
                                                        : 'border-[#383736] bg-[#141414] text-[#D6D5C9] hover:bg-[#191919]'
                                                }`}
                                            >
                                                {selectedCategory ? selectedCategory.label : 'All'}
                                                <Icons.ChevronDown
                                                    className={`h-3 w-3 ${selectedCategory ? 'text-[#141414]' : 'text-[#7B7A79]'}`}
                                                />
                                            </button>
                                            <AnimatePresence>
                                                {activeDropdown === 'category' && (
                                                    <motion.div
                                                        initial={{ opacity: 0, y: -6, scale: 0.97 }}
                                                        animate={{ opacity: 1, y: 0, scale: 1 }}
                                                        exit={{ opacity: 0, y: -6, scale: 0.97 }}
                                                        transition={{ duration: 0.15 }}
                                                        className={`absolute right-0 ${dropdownDirection === 'up' ? 'bottom-full mb-2' : 'top-full mt-2'} w-44 rounded-xl border border-[#383736] bg-[#1E1E1E] py-2 shadow-xl z-50`}
                                                    >
                                                        <div className="px-3 pb-2 text-[11px] font-medium text-[#7B7A79] border-b border-[#383736] mb-1 uppercase tracking-wider flex items-center justify-between">
                                                            <span>Category</span>
                                                            {selectedCategory && (
                                                                <button
                                                                    onClick={(e) => {
                                                                        e.stopPropagation()
                                                                        setSelectedCategory(null)
                                                                        setActiveDropdown(null)
                                                                        setVisibleCount(9)
                                                                    }}
                                                                    className="text-[#D6D5C9] hover:text-white hover:underline lowercase"
                                                                >
                                                                    clear
                                                                </button>
                                                            )}
                                                        </div>
                                                        <div className="max-h-[240px] overflow-y-auto no-scrollbar">
                                                            {CATEGORIES.map((cat) => (
                                                                <button
                                                                    key={cat.id}
                                                                    onClick={() => {
                                                                        setSelectedCategory(
                                                                            selectedCategory?.id ===
                                                                                cat.id
                                                                                ? null
                                                                                : cat
                                                                        )
                                                                        setActiveDropdown(null)
                                                                        setVisibleCount(9)
                                                                    }}
                                                                    className="w-full flex items-center justify-between px-3 py-1.5 text-[13px] text-[#D6D5C9] hover:bg-[#262626] transition-colors"
                                                                >
                                                                    {cat.label}
                                                                    {selectedCategory?.id ===
                                                                        cat.id && (
                                                                        <Icons.Check className="h-3.5 w-3.5 text-[#7B7A79]" />
                                                                    )}
                                                                </button>
                                                            ))}
                                                        </div>
                                                    </motion.div>
                                                )}
                                            </AnimatePresence>
                                        </div>
                                    </div>
                                </div>

                                {filteredGridTemplates.length === 0 ? (
                                    <div className="py-20 text-center">
                                        <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-[#191919] border border-[#242323] mb-4">
                                            <Icons.Search className="w-5 h-5 text-[#7B7A79]" />
                                        </div>
                                        <h3 className="text-[15px] font-medium text-[#D6D5C9]">
                                            No matches found
                                        </h3>
                                        <p className="mt-1 text-[13px] text-[#7B7A79]">
                                            Try adjusting your filters or search term.
                                        </p>
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-5 md:gap-x-6 gap-y-10">
                                        {visibleTemplates.map((template) => (
                                            <TemplateCard
                                                key={template.id}
                                                template={template}
                                                isLikePending={
                                                    likePendingTemplateId === template.id
                                                }
                                                isRemixPending={
                                                    remixPendingTemplateId === template.id
                                                }
                                                onToggleLike={() =>
                                                    likeMutation.mutate({
                                                        templateId: template.id,
                                                        isLiked: !template.isLiked,
                                                    })
                                                }
                                                onRemix={() => openRemixModal(template)}
                                            />
                                        ))}
                                    </div>
                                )}

                                {filteredGridTemplates.length > visibleCount && (
                                    <div className="mt-12 flex justify-center border-t border-[#242323] pt-12">
                                        <button
                                            onClick={() => setVisibleCount((prev) => prev + 9)}
                                            className="px-6 py-2.5 rounded-full border border-[#383736] bg-[#141414] hover:bg-[#191919] text-[#D6D5C9] text-[13px] font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-[#555453] focus:border-transparent"
                                        >
                                            Load more templates
                                        </button>
                                    </div>
                                )}
                            </div>
                        </>
                    )}
                </div>
            </div>

            <TemplateRemixModal
                isOpen={remixModal.isOpen}
                template={remixModal.template}
                isPending={remixPendingTemplateId === remixModal.template?.id}
                onClose={() => setRemixModal({ isOpen: false, template: null })}
                onConfirm={handleRemixTemplate}
            />
        </div>
    )
}
