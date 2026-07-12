import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState, useRef, useEffect } from 'react'

import { SORT_OPTIONS } from '../data'

import { templateAPI } from '@/features/templates/api/template'
import { mapBackendTemplateToTemplate, type Template } from '@/features/templates/types'

export const templatesQueryKey = ['templates', 'all'] as const
export const featuredTemplatesQueryKey = ['templates', 'featured'] as const

export const sortTemplates = (templates: Template[], sortId: string) => {
    const sorted = [...templates]

    if (sortId === 'newest') {
        sorted.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        return sorted
    }

    if (sortId === 'oldest') {
        sorted.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
        return sorted
    }

    if (sortId === 'category') {
        sorted.sort((a, b) => (a.category || '').localeCompare(b.category || ''))
        return sorted
    }

    sorted.sort((a, b) => b.likeCount - a.likeCount)
    return sorted
}

export const useTemplatesController = (onOpenProject: (projectId: string) => void) => {
    const queryClient = useQueryClient()
    const [searchQuery, setSearchQuery] = useState('')
    const [selectedCategory, setSelectedCategory] = useState<{ id: string; label: string } | null>(
        null
    )
    const [visibleCount, setVisibleCount] = useState(9)
    const [activeDropdown, setActiveDropdown] = useState<string | null>(null)
    const [dropdownDirection, setDropdownDirection] = useState<'down' | 'up'>('down')
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
        mutationFn: ({ templateId, name }: { templateId: string; name?: string }) =>
            templateAPI.remixTemplate(templateId, name),
        onMutate: ({ templateId }) => {
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

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
                setActiveDropdown(null)
            }
        }
        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])

    const toggleDropdown = (type: string, event: React.MouseEvent<HTMLButtonElement>) => {
        if (activeDropdown === type) {
            setActiveDropdown(null)
            return
        }
        const rect = event.currentTarget.getBoundingClientRect()
        if (window.innerHeight - rect.bottom < 250 && rect.top > 250) {
            setDropdownDirection('up')
        } else {
            setDropdownDirection('down')
        }
        setActiveDropdown(type)
    }

    const hasTemplates = templates.length > 0
    const filteredFeaturedTemplates = featuredTemplates
    const hasFeaturedTemplates = filteredFeaturedTemplates.length > 0

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

    const handleRemixTemplate = (name: string) => {
        if (!remixModal.template) return
        remixMutation.mutate({ templateId: remixModal.template.id, name })
    }

    const isInitialLoading = isTemplatesLoading || isFeaturedLoading

    return {
        templates,
        featuredTemplates,
        isTemplatesLoading,
        isFeaturedLoading,
        templatesError,
        featuredError,
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
        actionError,
        likePendingTemplateId,
        remixPendingTemplateId,
        remixModal,
        setRemixModal,
        dropdownRef,
        likeMutation,
        remixMutation,
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
    }
}
