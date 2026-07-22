import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import React, { useState, useEffect } from 'react'

import { apiFetch } from '@/shared/api/client'
import { Icons } from '@/shared/components/ui/Icons'

export interface WikiPage {
    id: string
    wikiId: string
    slug: string
    title: string
    content: string
    order: number
    createdAt?: string
    updatedAt?: string
}

export interface RepositoryWiki {
    id: string
    userId: string
    repoFullName: string
    repoOwner: string
    repoName: string
    status: 'IDLE' | 'GENERATING' | 'COMPLETED' | 'FAILED'
    pages: WikiPage[]
}

export interface WikiReaderProps {
    repoOwner: string
    repoName: string
    onBack: () => void
    initialWiki?: RepositoryWiki
}

export const WikiReader: React.FC<WikiReaderProps> = ({
    repoOwner,
    repoName,
    onBack,
    initialWiki,
}) => {
    const queryClient = useQueryClient()
    const [activePageId, setActivePageId] = useState<string | null>(null)

    // Modal state
    const [isAddModalOpen, setIsAddModalOpen] = useState(false)
    const [isEditModalOpen, setIsEditModalOpen] = useState(false)
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)

    // Form inputs
    const [formTitle, setFormTitle] = useState('')
    const [formContent, setFormContent] = useState('')
    const [formError, setFormError] = useState('')

    const { data: wikiData, isLoading } = useQuery<{ wiki: RepositoryWiki }>({
        queryKey: ['wiki', 'repo', repoOwner, repoName],
        queryFn: async () => {
            const res = await apiFetch(`/wiki/repos/${repoOwner}/${repoName}`)
            if (!res.ok) {
                throw new Error('Failed to fetch wiki data')
            }
            return res.json()
        },
        initialData: initialWiki ? { wiki: initialWiki } : undefined,
        staleTime: initialWiki ? Infinity : 0,
    })

    const wiki = wikiData?.wiki
    const pages = wiki?.pages || []

    // Default to first page if activePageId is not set or invalid
    useEffect(() => {
        if (pages.length > 0) {
            if (!activePageId || !pages.some((p) => p.id === activePageId)) {
                setActivePageId(pages[0].id)
            }
        } else {
            setActivePageId(null)
        }
    }, [pages, activePageId])

    const activePage = pages.find((p) => p.id === activePageId) || pages[0]

    // Create page mutation
    const createPageMutation = useMutation({
        mutationFn: async ({ title, content }: { title: string; content: string }) => {
            if (!wiki) throw new Error('Wiki not loaded')
            const res = await apiFetch('/wiki/pages', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    wikiId: wiki.id,
                    title,
                    content,
                }),
            })
            if (!res.ok) {
                const errData = await res.json().catch(() => ({}))
                throw new Error(errData.error || 'Failed to create page')
            }
            return res.json()
        },
        onSuccess: (data) => {
            setFormError('')
            setIsAddModalOpen(false)
            setFormTitle('')
            setFormContent('')
            queryClient.invalidateQueries({ queryKey: ['wiki', 'repo', repoOwner, repoName] })
            if (data.page?.id) {
                setActivePageId(data.page.id)
            }
        },
        onError: (err: Error) => {
            setFormError(err.message)
        },
    })

    // Edit page mutation
    const updatePageMutation = useMutation({
        mutationFn: async ({
            id,
            title,
            content,
        }: {
            id: string
            title: string
            content: string
        }) => {
            const res = await apiFetch(`/wiki/pages/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ title, content }),
            })
            if (!res.ok) {
                const errData = await res.json().catch(() => ({}))
                throw new Error(errData.error || 'Failed to update page')
            }
            return res.json()
        },
        onSuccess: () => {
            setFormError('')
            setIsEditModalOpen(false)
            queryClient.invalidateQueries({ queryKey: ['wiki', 'repo', repoOwner, repoName] })
        },
        onError: (err: Error) => {
            setFormError(err.message)
        },
    })

    // Delete page mutation
    const deletePageMutation = useMutation({
        mutationFn: async (id: string) => {
            const res = await apiFetch(`/wiki/pages/${id}`, {
                method: 'DELETE',
            })
            if (!res.ok) {
                throw new Error('Failed to delete page')
            }
        },
        onSuccess: () => {
            setIsDeleteModalOpen(false)
            queryClient.invalidateQueries({ queryKey: ['wiki', 'repo', repoOwner, repoName] })
        },
    })

    const handleOpenAddModal = () => {
        setFormTitle('')
        setFormContent('')
        setFormError('')
        setIsAddModalOpen(true)
    }

    const handleOpenEditModal = () => {
        if (!activePage) return
        setFormTitle(activePage.title)
        setFormContent(activePage.content)
        setFormError('')
        setIsEditModalOpen(true)
    }

    const handleCreateSubmit = (e: React.FormEvent) => {
        e.preventDefault()
        if (!formTitle.trim()) {
            setFormError('Title is required')
            return
        }
        createPageMutation.mutate({ title: formTitle.trim(), content: formContent })
    }

    const handleEditSubmit = (e: React.FormEvent) => {
        e.preventDefault()
        if (!activePage) return
        if (!formTitle.trim()) {
            setFormError('Title is required')
            return
        }
        updatePageMutation.mutate({
            id: activePage.id,
            title: formTitle.trim(),
            content: formContent,
        })
    }

    const handleDeleteConfirm = () => {
        if (!activePage) return
        deletePageMutation.mutate(activePage.id)
    }

    if (isLoading && !wiki) {
        return (
            <div className="flex flex-col h-full bg-[#141414] text-gray-100 p-6 md:p-8 overflow-y-auto">
                <div className="max-w-6xl mx-auto w-full animate-pulse">
                    <div className="h-6 w-32 bg-[#222222] rounded mb-6" />
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                        <div className="h-64 bg-[#1A1A1A] rounded-xl border border-[#262626]" />
                        <div className="md:col-span-3 h-96 bg-[#1A1A1A] rounded-xl border border-[#262626]" />
                    </div>
                </div>
            </div>
        )
    }

    return (
        <div className="flex flex-col h-full bg-[#141414] text-gray-100 overflow-hidden font-sans">
            {/* Header Navigation */}
            <div className="bg-[#1A1A1A] border-b border-[#282828] px-6 py-4 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-3">
                    <button
                        onClick={onBack}
                        className="px-3 py-1.5 rounded-lg bg-[#242424] hover:bg-[#303030] border border-[#333333] text-xs font-medium text-gray-300 hover:text-white transition-colors flex items-center gap-1.5 cursor-pointer"
                    >
                        <Icons.ChevronLeft className="w-4 h-4" />
                        <span>Repositories</span>
                    </button>
                    <div className="h-4 w-px bg-[#333333]" />
                    <div className="flex items-center gap-2">
                        <Icons.DocsBook className="w-4 h-4 text-blue-400" />
                        <span className="font-semibold text-sm text-white">
                            {repoOwner} / {repoName}
                        </span>
                    </div>
                </div>

                <button
                    onClick={handleOpenAddModal}
                    className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium transition-colors flex items-center gap-1.5 cursor-pointer shadow-sm"
                >
                    <Icons.Plus className="w-3.5 h-3.5" />
                    <span>Add Page</span>
                </button>
            </div>

            {/* Main Content Area: Sidebar + Reader */}
            <div className="flex-1 flex overflow-hidden">
                {/* Left Sidebar: Page List */}
                <div className="w-64 bg-[#181818] border-r border-[#282828] flex flex-col shrink-0">
                    <div className="p-4 border-b border-[#242424] flex items-center justify-between">
                        <span className="text-xs font-semibold uppercase tracking-wider text-[#8F8E8D]">
                            Pages ({pages.length})
                        </span>
                    </div>

                    <div className="flex-1 overflow-y-auto p-2 space-y-1">
                        {pages.length > 0 ? (
                            pages.map((page) => {
                                const isActive = activePage?.id === page.id
                                return (
                                    <button
                                        key={page.id}
                                        onClick={() => setActivePageId(page.id)}
                                        className={`w-full text-left px-3 py-2 rounded-lg text-xs font-medium transition-all flex items-center gap-2 cursor-pointer ${
                                            isActive
                                                ? 'bg-blue-600/15 border border-blue-500/30 text-blue-400 font-semibold'
                                                : 'text-gray-300 hover:bg-[#242424] hover:text-white border border-transparent'
                                        }`}
                                    >
                                        <Icons.DocsBook className="w-3.5 h-3.5 shrink-0 opacity-70" />
                                        <span className="truncate">{page.title}</span>
                                    </button>
                                )
                            })
                        ) : (
                            <div className="p-4 text-center text-xs text-[#8F8E8D]">
                                No wiki pages found.
                            </div>
                        )}
                    </div>
                </div>

                {/* Right Panel: Page View */}
                <div className="flex-1 flex flex-col overflow-y-auto bg-[#141414] p-6 md:p-8">
                    {activePage ? (
                        <div className="max-w-4xl w-full mx-auto space-y-6">
                            {/* Page Header */}
                            <div className="flex items-start justify-between border-b border-[#282828] pb-4">
                                <div>
                                    <h1 className="text-2xl font-bold text-white tracking-tight mb-1">
                                        {activePage.title}
                                    </h1>
                                    <div className="flex items-center gap-2">
                                        <span className="text-[11px] font-mono bg-[#242424] text-[#A1A1AA] px-2 py-0.5 rounded border border-[#333333]">
                                            slug: {activePage.slug}
                                        </span>
                                    </div>
                                </div>

                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={handleOpenEditModal}
                                        className="px-3 py-1.5 rounded-lg bg-[#242424] hover:bg-[#303030] border border-[#333333] text-xs font-medium text-gray-300 hover:text-white transition-colors flex items-center gap-1.5 cursor-pointer"
                                    >
                                        <Icons.Edit className="w-3.5 h-3.5 text-blue-400" />
                                        <span>Edit Page</span>
                                    </button>
                                    <button
                                        onClick={() => setIsDeleteModalOpen(true)}
                                        className="px-3 py-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-xs font-medium text-rose-400 hover:text-rose-300 transition-colors flex items-center gap-1.5 cursor-pointer"
                                    >
                                        <Icons.Trash className="w-3.5 h-3.5" />
                                        <span>Delete</span>
                                    </button>
                                </div>
                            </div>

                            {/* Markdown Render Body */}
                            <div className="prose prose-invert max-w-none text-sm leading-relaxed text-gray-300 space-y-4">
                                {activePage.content.split('\n\n').map((paragraph, idx) => {
                                    if (paragraph.startsWith('# ')) {
                                        return (
                                            <h1
                                                key={idx}
                                                className="text-xl font-semibold text-white mt-4 mb-2"
                                            >
                                                {paragraph.replace('# ', '')}
                                            </h1>
                                        )
                                    }
                                    if (paragraph.startsWith('## ')) {
                                        return (
                                            <h2
                                                key={idx}
                                                className="text-lg font-semibold text-white mt-3 mb-2"
                                            >
                                                {paragraph.replace('## ', '')}
                                            </h2>
                                        )
                                    }
                                    if (paragraph.startsWith('```')) {
                                        const codeLines = paragraph.replace(/```[a-z]*/g, '').trim()
                                        return (
                                            <pre
                                                key={idx}
                                                className="bg-[#1A1A1A] border border-[#282828] p-4 rounded-xl font-mono text-xs text-gray-200 overflow-x-auto"
                                            >
                                                <code>{codeLines}</code>
                                            </pre>
                                        )
                                    }
                                    return <p key={idx}>{paragraph}</p>
                                })}
                            </div>
                        </div>
                    ) : (
                        <div className="flex-1 flex flex-col items-center justify-center text-center p-12">
                            <Icons.DocsBook className="w-12 h-12 text-[#333333] mb-3" />
                            <h3 className="text-base font-semibold text-white mb-1">
                                No page selected
                            </h3>
                            <p className="text-xs text-[#8F8E8D] mb-4">
                                Select a page from the sidebar or create a new page.
                            </p>
                            <button
                                onClick={handleOpenAddModal}
                                className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium transition-colors flex items-center gap-2 cursor-pointer"
                            >
                                <Icons.Plus className="w-4 h-4" />
                                <span>Create First Page</span>
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* Create Page Modal */}
            {isAddModalOpen && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-[#1A1A1A] border border-[#2A2A2A] rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
                        <div className="flex items-center justify-between border-b border-[#282828] pb-3">
                            <h3 className="text-base font-bold text-white">Add Wiki Page</h3>
                            <button
                                onClick={() => setIsAddModalOpen(false)}
                                className="text-gray-400 hover:text-white p-1"
                            >
                                <Icons.X className="w-4 h-4" />
                            </button>
                        </div>

                        {formError && (
                            <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-lg text-xs text-rose-400">
                                {formError}
                            </div>
                        )}

                        <form onSubmit={handleCreateSubmit} className="space-y-4">
                            <div>
                                <label className="block text-xs font-medium text-gray-300 mb-1">
                                    Title
                                </label>
                                <input
                                    type="text"
                                    value={formTitle}
                                    onChange={(e) => setFormTitle(e.target.value)}
                                    placeholder="Page title (e.g. API Guidelines)"
                                    className="w-full bg-[#141414] border border-[#2A2A2A] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-medium text-gray-300 mb-1">
                                    Content (Markdown)
                                </label>
                                <textarea
                                    rows={8}
                                    value={formContent}
                                    onChange={(e) => setFormContent(e.target.value)}
                                    placeholder="# Page Title\n\nWrite markdown content..."
                                    className="w-full bg-[#141414] border border-[#2A2A2A] rounded-lg px-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-blue-500 resize-none"
                                />
                            </div>

                            <div className="flex justify-end gap-2 pt-2 border-t border-[#282828]">
                                <button
                                    type="button"
                                    onClick={() => setIsAddModalOpen(false)}
                                    className="px-4 py-2 rounded-lg bg-[#242424] hover:bg-[#303030] text-xs font-medium text-gray-300 cursor-pointer"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={createPageMutation.isPending}
                                    className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-xs font-medium text-white cursor-pointer"
                                >
                                    {createPageMutation.isPending ? 'Creating...' : 'Create Page'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Edit Page Modal */}
            {isEditModalOpen && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-[#1A1A1A] border border-[#2A2A2A] rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
                        <div className="flex items-center justify-between border-b border-[#282828] pb-3">
                            <h3 className="text-base font-bold text-white">Edit Wiki Page</h3>
                            <button
                                onClick={() => setIsEditModalOpen(false)}
                                className="text-gray-400 hover:text-white p-1"
                            >
                                <Icons.X className="w-4 h-4" />
                            </button>
                        </div>

                        {formError && (
                            <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-lg text-xs text-rose-400">
                                {formError}
                            </div>
                        )}

                        <form onSubmit={handleEditSubmit} className="space-y-4">
                            <div>
                                <label className="block text-xs font-medium text-gray-300 mb-1">
                                    Title
                                </label>
                                <input
                                    type="text"
                                    value={formTitle}
                                    onChange={(e) => setFormTitle(e.target.value)}
                                    className="w-full bg-[#141414] border border-[#2A2A2A] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-medium text-gray-300 mb-1">
                                    Content (Markdown)
                                </label>
                                <textarea
                                    rows={8}
                                    value={formContent}
                                    onChange={(e) => setFormContent(e.target.value)}
                                    className="w-full bg-[#141414] border border-[#2A2A2A] rounded-lg px-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-blue-500 resize-none"
                                />
                            </div>

                            <div className="flex justify-end gap-2 pt-2 border-t border-[#282828]">
                                <button
                                    type="button"
                                    onClick={() => setIsEditModalOpen(false)}
                                    className="px-4 py-2 rounded-lg bg-[#242424] hover:bg-[#303030] text-xs font-medium text-gray-300 cursor-pointer"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={updatePageMutation.isPending}
                                    className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-xs font-medium text-white cursor-pointer"
                                >
                                    {updatePageMutation.isPending ? 'Saving...' : 'Save Changes'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Delete Confirmation Modal */}
            {isDeleteModalOpen && activePage && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-[#1A1A1A] border border-[#2A2A2A] rounded-2xl max-w-sm w-full p-6 shadow-2xl space-y-4">
                        <h3 className="text-base font-bold text-white">Delete Page</h3>
                        <p className="text-xs text-gray-300 leading-relaxed">
                            Are you sure you want to delete{' '}
                            <span className="font-semibold text-white">"{activePage.title}"</span>?
                            This action cannot be undone.
                        </p>
                        <div className="flex justify-end gap-2 pt-2 border-t border-[#282828]">
                            <button
                                onClick={() => setIsDeleteModalOpen(false)}
                                className="px-4 py-2 rounded-lg bg-[#242424] hover:bg-[#303030] text-xs font-medium text-gray-300 cursor-pointer"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleDeleteConfirm}
                                disabled={deletePageMutation.isPending}
                                className="px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-xs font-medium text-white cursor-pointer"
                            >
                                {deletePageMutation.isPending ? 'Deleting...' : 'Delete'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
