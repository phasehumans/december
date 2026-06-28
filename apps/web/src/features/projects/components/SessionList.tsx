import React, { useEffect, useState, useMemo } from 'react'

import { useProjectListMutations } from '../hooks/useProjectListMutations'

import { ProjectListModals } from './ProjectListModals'
import { SessionListView } from './SessionListView'

import type {
    DeleteModalState,
    DuplicateModalState,
    Project,
    ProjectListProps,
    RenameModalState,
    ShareModalState,
} from '@/features/projects/types'

import { toProjectSlug } from '@/app/types'
import { SettingsBigModal } from '@/features/preview/components/settings/SettingsBigModal'

export type SortOption = 'newest' | 'oldest'
export type StatusFilter = 'any' | 'Draft' | 'Generating' | 'Generated' | 'Deployed' | 'Failed'

export const SessionList: React.FC<ProjectListProps> = ({
    onNewProject,
    onOpenProject,
    projects,
    isLoading,
    isFetching,
    errorMessage,
    selectedModel,
    setSelectedModel,
}) => {
    const [menuOpenId, setMenuOpenId] = useState<string | null>(null)
    const [searchQuery, setSearchQuery] = useState('')
    const [sortOption, setSortOption] = useState<SortOption>('newest')
    const [statusFilter, setStatusFilter] = useState<StatusFilter>('any')
    const [renameModal, setRenameModal] = useState<RenameModalState>({
        isOpen: false,
        project: null,
        value: '',
    })
    const [duplicateModal, setDuplicateModal] = useState<DuplicateModalState>({
        isOpen: false,
        project: null,
    })
    const [shareModal, setShareModal] = useState<ShareModalState>({
        isOpen: false,
        project: null,
    })
    const [deleteModal, setDeleteModal] = useState<DeleteModalState>({
        isOpen: false,
        project: null,
    })
    const [openConfirmModal, setOpenConfirmModal] = useState<{
        isOpen: boolean
        project: Project | null
    }>({
        isOpen: false,
        project: null,
    })
    const [settingsModal, setSettingsModal] = useState<{
        isOpen: boolean
        project: Project | null
    }>({
        isOpen: false,
        project: null,
    })
    const [actionError, setActionError] = useState<string | null>(null)
    const isInitialLoading = isLoading && projects.length === 0

    useEffect(() => {
        const handleClickOutside = () => setMenuOpenId(null)
        if (menuOpenId) window.addEventListener('click', handleClickOutside)
        return () => window.removeEventListener('click', handleClickOutside)
    }, [menuOpenId])

    const { toggleStarMutation, renameMutation, duplicateMutation, shareMutation, deleteMutation } =
        useProjectListMutations({
            setActionError,
            onRenameMutate: () => setRenameModal({ isOpen: false, project: null, value: '' }),
            onDuplicateMutate: () => setDuplicateModal({ isOpen: false, project: null }),
            onShareMutate: () => setShareModal({ isOpen: false, project: null }),
            onDeleteMutate: () => setDeleteModal({ isOpen: false, project: null }),
        })

    const filteredAndSortedProjects = useMemo(() => {
        let result = [...projects]

        // Search filter
        if (searchQuery.trim()) {
            const query = searchQuery.toLowerCase().trim()
            result = result.filter(
                (project) =>
                    project.title.toLowerCase().includes(query) ||
                    project.description.toLowerCase().includes(query)
            )
        }

        // Status filter
        if (statusFilter !== 'any') {
            result = result.filter((project) => {
                const projectStatus = project.status || 'Draft'
                return projectStatus === statusFilter
            })
        }

        // Sort
        if (sortOption === 'oldest') {
            result.reverse()
        }

        return result
    }, [projects, searchQuery, statusFilter, sortOption])

    const toggleStar = (id: string, event: React.MouseEvent) => {
        event.stopPropagation()
        const project = projects.find((item) => item.id === id)
        if (!project) return
        toggleStarMutation.mutate({ projectId: id, isStarred: !project.isStarred })
    }

    const toggleMenu = (id: string, event: React.MouseEvent) => {
        event.stopPropagation()
        setMenuOpenId((prev) => (prev === id ? null : id))
    }

    const openProjectFromMenu = (projectId: string, event: React.MouseEvent) => {
        event.stopPropagation()
        setMenuOpenId(null)
        const proj = projects.find((p) => p.id === projectId)
        if (proj) {
            const slug = toProjectSlug(proj.title)
            window.open(`/project/${slug}`, '_blank')
        } else {
            onOpenProject(projectId)
        }
    }

    const toggleStarFromMenu = (project: Project, event: React.MouseEvent) => {
        event.stopPropagation()
        setMenuOpenId(null)
        toggleStarMutation.mutate({ projectId: project.id, isStarred: !project.isStarred })
    }

    const openModal = (event: React.MouseEvent, setter: () => void) => {
        event.stopPropagation()
        setter()
        setMenuOpenId(null)
    }

    const openRenameModal = (project: Project, event: React.MouseEvent) =>
        openModal(event, () => setRenameModal({ isOpen: true, project, value: project.title }))

    const openDuplicateModal = (project: Project, event: React.MouseEvent) =>
        openModal(event, () => setDuplicateModal({ isOpen: true, project }))

    const openShareModal = (project: Project, event: React.MouseEvent) =>
        openModal(event, () => setShareModal({ isOpen: true, project }))

    const openDeleteModal = (project: Project, event: React.MouseEvent) =>
        openModal(event, () => setDeleteModal({ isOpen: true, project }))

    const openSettingsModal = (project: Project, event: React.MouseEvent) =>
        openModal(event, () => setSettingsModal({ isOpen: true, project }))

    const handleRename = (event: React.FormEvent) => {
        event.preventDefault()
        if (!renameModal.project || !renameModal.value.trim()) return
        renameMutation.mutate({
            projectId: renameModal.project.id,
            rename: renameModal.value.trim(),
        })
    }

    const handleDuplicate = (name: string) => {
        if (!duplicateModal.project) return
        duplicateMutation.mutate({ projectId: duplicateModal.project.id, name })
    }

    const handleShare = (category?: string) => {
        if (!shareModal.project) return
        shareMutation.mutate({
            projectId: shareModal.project.id,
            isSharedAsTemplate: !shareModal.project.isSharedAsTemplate,
            projectCategory: category,
        })
    }

    const handleDelete = () => {
        if (!deleteModal.project) return
        deleteMutation.mutate(deleteModal.project.id)
    }

    const handleOpenProjectClick = (projectId: string) => {
        const project = projects.find((p) => p.id === projectId)
        if (project) {
            setOpenConfirmModal({
                isOpen: true,
                project,
            })
        } else {
            onOpenProject(projectId)
        }
    }

    const handleOpenConfirm = () => {
        if (openConfirmModal.project) {
            onOpenProject(openConfirmModal.project.id)
            setOpenConfirmModal({ isOpen: false, project: null })
        }
    }

    return (
        <div className="relative h-full w-full flex-1 overflow-y-auto bg-background px-8 pb-8 pt-20 font-sans no-scrollbar md:p-16">
            <div className="relative z-10 mx-auto min-h-[520px] max-w-6xl">
                <SessionListView
                    projects={filteredAndSortedProjects}
                    onNewProject={onNewProject}
                    onOpenProject={handleOpenProjectClick}
                    isInitialLoading={isInitialLoading}
                    isFetching={isFetching}
                    errorMessage={errorMessage}
                    actionError={actionError}
                    menuOpenId={menuOpenId}
                    isTogglePending={toggleStarMutation.isPending}
                    onToggleStar={toggleStar}
                    onToggleMenu={toggleMenu}
                    onOpenProjectFromMenu={openProjectFromMenu}
                    onToggleStarFromMenu={toggleStarFromMenu}
                    onOpenRename={openRenameModal}
                    onOpenDuplicate={openDuplicateModal}
                    onOpenShare={openShareModal}
                    onOpenDelete={openDeleteModal}
                    onOpenSettings={openSettingsModal}
                    searchQuery={searchQuery}
                    onSearchChange={setSearchQuery}
                    sortOption={sortOption}
                    onSortChange={setSortOption}
                    statusFilter={statusFilter}
                    onStatusFilterChange={setStatusFilter}
                    hasUnfilteredProjects={projects.length > 0}
                />
            </div>

            <ProjectListModals
                renameModal={renameModal}
                duplicateModal={duplicateModal}
                shareModal={shareModal}
                deleteModal={deleteModal}
                openConfirmModal={openConfirmModal}
                isRenamePending={renameMutation.isPending}
                isDuplicatePending={duplicateMutation.isPending}
                isSharePending={shareMutation.isPending}
                isDeletePending={deleteMutation.isPending}
                onCloseRename={() => setRenameModal((prev) => ({ ...prev, isOpen: false }))}
                onRenameChange={(nextValue) =>
                    setRenameModal((prev) => ({ ...prev, value: nextValue }))
                }
                onRenameSubmit={handleRename}
                onCloseDuplicate={() => setDuplicateModal((prev) => ({ ...prev, isOpen: false }))}
                onDuplicateConfirm={handleDuplicate}
                onCloseShare={() => setShareModal((prev) => ({ ...prev, isOpen: false }))}
                onShareConfirm={handleShare}
                onCloseDelete={() => setDeleteModal((prev) => ({ ...prev, isOpen: false }))}
                onDeleteConfirm={handleDelete}
                onCloseOpenConfirm={() => setOpenConfirmModal({ isOpen: false, project: null })}
                onOpenConfirm={handleOpenConfirm}
            />

            {settingsModal.isOpen && settingsModal.project && (
                <SettingsBigModal
                    onClose={() => setSettingsModal({ isOpen: false, project: null })}
                    initialTab="general"
                    projectName={settingsModal.project.title}
                    projectId={settingsModal.project.id}
                />
            )}
        </div>
    )
}
