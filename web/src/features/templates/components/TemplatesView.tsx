import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AnimatePresence, motion } from 'framer-motion'
import React, { useRef, useState } from 'react'

import { CATEGORIES, SORT_OPTIONS } from '../data'

import { FeaturedTemplates } from './FeaturedTemplates'
import { TemplateCard } from './TemplateCard'
import { TemplateRemixModal } from './TemplateRemixModal'

import { templateAPI } from '@/features/templates/api/template'
import { mapBackendTemplateToTemplate, type Template } from '@/features/templates/types'
import { Icons } from '@/shared/components/ui/Icons'

interface TemplatesViewProps {
    onOpenProject: (projectId: string) => void
}

const templatesQueryKey = ['templates', 'all'] as const
const featuredTemplatesQueryKey = ['templates', 'featured'] as const

const EmptyTemplatesState: React.FC = () => {
    return (
        <div className="flex min-h-[420px] flex-col items-center justify-center px-6 py-16 text-center">
            <div className="relative mb-6 h-28 w-32">
                <svg
                    viewBox="0 0 128 112"
                    fill="none"
                    className="h-full w-full text-[#8A8987]"
                    aria-hidden="true"
                >
                    <path
                        d="M28 42.5 64 22l36 20.5v43L64 106 28 85.5v-43Z"
                        stroke="currentColor"
                        strokeWidth="2.4"
                        strokeLinejoin="round"
                    />
                    <path
                        d="M28 42.5 64 63l36-20.5M64 63v43"
                        stroke="currentColor"
                        strokeWidth="2.4"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    />
                </svg>
            </div>
            <h2 className="text-[17px] font-medium text-[#D6D5C9]">No templates</h2>
            <p className="mt-2 max-w-sm text-[13px] leading-6 text-[#7B7A79]">
                Shared community templates will appear here.
            </p>
        </div>
    )
}

const sortTemplates = (templates: Template[], sortId: string) => {
    const sorted = [...templates]

    if (sortId === 'newest') {
        sorted.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        return sorted
    }

    if (sortId === 'oldest') {
        sorted.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
        return sorted
    }

    sorted.sort((a, b) => b.likeCount - a.likeCount)
    return sorted
}

export const TemplatesView: React.FC<TemplatesViewProps> = ({ onOpenProject }) => {
    const queryClient = useQueryClient()
    const [searchQuery, setSearchQuery] = useState('')
    const [selectedCategory, setSelectedCategory] = useState<{ id: string; label: string } | null>(
        null
    )
    const [visibleCount, setVisibleCount] = useState(9)
    const [activeDropdown, setActiveDropdown] = useState<string | null>(null)
    const [selectedSort, setSelectedSort] = useState(SORT_OPTIONS[0]!)
    const [actionError, setActionError] = useState<string | null>(null)
    const [likePendingTemplateId, setLikePendingTemplateId] = useState<string | null>(null)
    const [remixPendingTemplateId, setRemixPendingTemplateId] = useState<string | null>(null)
    const [remixModal, setRemixModal] = useState<{
        isOpen: boolean
        template: Template | null
    }>({
        isOpen: false,
        template: null,
    })
    const dropdownRef = useRef<HTMLDivElement>(null)

    const {
        data: templates = [],
        isLoading: isTemplatesLoading,
        error: templatesError,
    } = useQuery({
        queryKey: templatesQueryKey,
        queryFn: templateAPI.getTemplates,
        select: (data) => data.map(mapBackendTemplateToTemplate),
    })

    const {
        data: featuredTemplates = [],
        isLoading: isFeaturedLoading,
        error: featuredError,
    } = useQuery({
        queryKey: featuredTemplatesQueryKey,
        queryFn: templateAPI.getFeaturedTemplates,
        select: (data) => data.map(mapBackendTemplateToTemplate),
    })

    const setTemplateLikeState = (
        templateId: string,
        updater: (template: Template) => Template
    ) => {
        queryClient.setQueryData<Template[]>(templatesQueryKey, (current = []) =>
            current.map((template) => (template.id === templateId ? updater(template) : template))
        )
        queryClient.setQueryData<Template[]>(featuredTemplatesQueryKey, (current = []) =>
            current.map((template) => (template.id === templateId ? updater(template) : template))
        )
    }

    const likeMutation = useMutation({
        mutationFn: ({ templateId, isLiked }: { templateId: string; isLiked: boolean }) =>
            templateAPI.toggleLike(templateId, isLiked),
        onMutate: async ({ templateId, isLiked }) => {
            setActionError(null)
            setLikePendingTemplateId(templateId)
            await queryClient.cancelQueries({ queryKey: templatesQueryKey })
            await queryClient.cancelQueries({ queryKey: featuredTemplatesQueryKey })

            const previousTemplates = queryClient.getQueryData<Template[]>(templatesQueryKey)
            const previousFeaturedTemplates =
                queryClient.getQueryData<Template[]>(featuredTemplatesQueryKey)

            setTemplateLikeState(templateId, (template) => ({
                ...template,
                isLiked,
                likeCount: Math.max(0, template.likeCount + (isLiked ? 1 : -1)),
            }))

            return { previousTemplates, previousFeaturedTemplates }
        },
        onError: (error, _variables, context) => {
            if (context?.previousTemplates) {
                queryClient.setQueryData(templatesQueryKey, context.previousTemplates)
            }
            if (context?.previousFeaturedTemplates) {
                queryClient.setQueryData(
                    featuredTemplatesQueryKey,
                    context.previousFeaturedTemplates
                )
            }
            setActionError(
                error instanceof Error ? error.message : 'Failed to update template like'
            )
        },
        onSuccess: () => {
            setActionError(null)
        },
        onSettled: () => {
            setLikePendingTemplateId(null)
            queryClient.invalidateQueries({ queryKey: templatesQueryKey })
            queryClient.invalidateQueries({ queryKey: featuredTemplatesQueryKey })
        },
    })

    const remixMutation = useMutation({
        mutationFn: (templateId: string) => templateAPI.remixTemplate(templateId),
        onMutate: (templateId) => {
            setActionError(null)
            setRemixPendingTemplateId(templateId)
        },
        onError: (error) => {
            setActionError(error instanceof Error ? error.message : 'Failed to remix template')
        },
        onSuccess: (project) => {
            setRemixModal({ isOpen: false, template: null })
            onOpenProject(project.id)
        },
        onSettled: () => {
            setRemixPendingTemplateId(null)
            queryClient.invalidateQueries({ queryKey: ['projects'] })
        },
    })

    React.useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
                setActiveDropdown(null)
            }
        }
        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])

    const hasTemplates = templates.length > 0
    const hasFeaturedTemplates = featuredTemplates.length > 0

    const filteredGridTemplates = sortTemplates(
        templates.filter((template) => {
            const matchesSearch =
                template.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                template.author.toLowerCase().includes(searchQuery.toLowerCase())
            const matchesCategory = selectedCategory
                ? template.category === selectedCategory.id
                : true
            return matchesSearch && matchesCategory
        }),
        selectedSort.id
    )

    const visibleTemplates = filteredGridTemplates.slice(0, visibleCount)
    const displayedError =
        actionError ??
        (templatesError instanceof Error ? templatesError.message : null) ??
        (featuredError instanceof Error ? featuredError.message : null)

    const openRemixModal = (template: Template) => {
        setRemixModal({
            isOpen: true,
            template,
        })
    }

    const handleRemixTemplate = () => {
        if (!remixModal.template) return
        remixMutation.mutate(remixModal.template.id)
    }

    const isInitialLoading = isTemplatesLoading || isFeaturedLoading

    return (
        <div className="flex flex-col h-full bg-background overflow-hidden relative font-sans">
            <div className="flex-1 overflow-y-auto no-scrollbar pb-24 pt-8 md:pt-12">
                <div className="max-w-[1200px] mx-auto px-5 lg:px-8">
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

                    {displayedError && (
                        <div className="mb-6 max-w-[34rem] rounded-full border border-red-500/35 bg-red-500/15 px-4 py-1 text-xs font-medium text-red-200">
                            {displayedError}
                        </div>
                    )}

                    {!isInitialLoading && !hasTemplates ? (
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
                                        templates={featuredTemplates}
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

                                    <div className="flex items-center gap-2" ref={dropdownRef}>
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
                                                                {selectedCategory?.id ===
                                                                    cat.id && (
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
                                                        <TemplateCard
                                                            template={template}
                                                            isLikePending={
                                                                likePendingTemplateId ===
                                                                template.id
                                                            }
                                                            isRemixPending={
                                                                remixPendingTemplateId ===
                                                                template.id
                                                            }
                                                            onToggleLike={(selectedTemplate) =>
                                                                likeMutation.mutate({
                                                                    templateId: selectedTemplate.id,
                                                                    isLiked:
                                                                        !selectedTemplate.isLiked,
                                                                })
                                                            }
                                                            onRemix={openRemixModal}
                                                        />
                                                    </motion.div>
                                                ))}
                                            </AnimatePresence>
                                        </div>

                                        {visibleCount < filteredGridTemplates.length && (
                                            <div className="mt-14 flex justify-center">
                                                <button
                                                    onClick={() =>
                                                        setVisibleCount((prev) => prev + 9)
                                                    }
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
                                        <h3 className="text-sm font-medium text-[#D6D5C9] mb-1.5">
                                            No templates found
                                        </h3>
                                        <p className="text-[#7B7A79] text-[13px] max-w-sm">
                                            Try changing the search or category filter.
                                        </p>
                                    </motion.div>
                                )}
                            </div>
                        </>
                    )}
                </div>
            </div>

            <TemplateRemixModal
                isOpen={remixModal.isOpen}
                templateTitle={remixModal.template?.title}
                isPending={Boolean(remixPendingTemplateId)}
                onClose={() => setRemixModal((prev) => ({ ...prev, isOpen: false }))}
                onConfirm={handleRemixTemplate}
            />
        </div>
    )
}
