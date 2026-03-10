import React, { useEffect, useState } from 'react'
import { useProjectListMutations } from '../hooks/useProjectListMutations'
import type {
    DeleteModalState,
    Project,
    ProjectListProps,
    RenameModalState,
} from '@/features/projects/types'
import { ProjectListView } from './ProjectListView'
import { ProjectListModals } from './ProjectListModals'

export const ProjectList: React.FC<ProjectListProps> = ({
    onNewProject,
    projects,
    isLoading,
    isFetching,
    errorMessage,
}) => {
    const [menuOpenId, setMenuOpenId] = useState<string | null>(null)
    const [renameModal, setRenameModal] = useState<RenameModalState>({
        isOpen: false,
        project: null,
        value: '',
    })
    const [deleteModal, setDeleteModal] = useState<DeleteModalState>({
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

    const { toggleStarMutation, renameMutation, deleteMutation } = useProjectListMutations({
        setActionError,
        onRenameMutate: () => setRenameModal({ isOpen: false, project: null, value: '' }),
        onDeleteMutate: () => setDeleteModal({ isOpen: false, project: null }),
    })

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

    const openModal = (event: React.MouseEvent, setter: () => void) => {
        event.stopPropagation()
        setter()
        setMenuOpenId(null)
    }

    const openRenameModal = (project: Project, event: React.MouseEvent) =>
        openModal(event, () => setRenameModal({ isOpen: true, project, value: project.title }))

    const openDeleteModal = (project: Project, event: React.MouseEvent) =>
        openModal(event, () => setDeleteModal({ isOpen: true, project }))

    const handleRename = (event: React.FormEvent) => {
        event.preventDefault()
        if (!renameModal.project || !renameModal.value.trim()) return
        renameMutation.mutate({
            projectId: renameModal.project.id,
            rename: renameModal.value.trim(),
        })
    }

    const handleDelete = () => {
        if (!deleteModal.project) return
        deleteMutation.mutate(deleteModal.project.id)
    }

    return (
        <div className="relative h-full w-full flex-1 overflow-y-auto bg-background px-8 pb-8 pt-20 font-sans no-scrollbar md:p-16">
            <div className="relative z-10 mx-auto min-h-[520px] max-w-6xl">
                <ProjectListView
                    projects={projects}
                    onNewProject={onNewProject}
                    isInitialLoading={isInitialLoading}
                    isFetching={isFetching}
                    errorMessage={errorMessage}
                    actionError={actionError}
                    menuOpenId={menuOpenId}
                    isTogglePending={toggleStarMutation.isPending}
                    onToggleStar={toggleStar}
                    onToggleMenu={toggleMenu}
                    onOpenRename={openRenameModal}
                    onOpenDelete={openDeleteModal}
                />
            </div>

            <ProjectListModals
                renameModal={renameModal}
                deleteModal={deleteModal}
                isRenamePending={renameMutation.isPending}
                isDeletePending={deleteMutation.isPending}
                onCloseRename={() => setRenameModal((prev) => ({ ...prev, isOpen: false }))}
                onRenameChange={(nextValue) =>
                    setRenameModal((prev) => ({ ...prev, value: nextValue }))
                }
                onRenameSubmit={handleRename}
                onCloseDelete={() => setDeleteModal((prev) => ({ ...prev, isOpen: false }))}
                onDeleteConfirm={handleDelete}
            />
        </div>
    )
}
