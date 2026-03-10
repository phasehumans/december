import React from 'react'
import { ProjectRenameModal } from './ProjectRenameModal'
import { ProjectDeleteModal } from './ProjectDeleteModal'
import type { DeleteModalState, RenameModalState } from '@/features/projects/types'

interface ProjectListModalsProps {
    renameModal: RenameModalState
    deleteModal: DeleteModalState
    isRenamePending: boolean
    isDeletePending: boolean
    onCloseRename: () => void
    onRenameChange: (nextValue: string) => void
    onRenameSubmit: (event: React.FormEvent) => void
    onCloseDelete: () => void
    onDeleteConfirm: () => void
}

export const ProjectListModals: React.FC<ProjectListModalsProps> = ({
    renameModal,
    deleteModal,
    isRenamePending,
    isDeletePending,
    onCloseRename,
    onRenameChange,
    onRenameSubmit,
    onCloseDelete,
    onDeleteConfirm,
}) => {
    return (
        <>
            <ProjectRenameModal
                isOpen={renameModal.isOpen}
                value={renameModal.value}
                isPending={isRenamePending}
                onClose={onCloseRename}
                onChange={onRenameChange}
                onSubmit={onRenameSubmit}
            />

            <ProjectDeleteModal
                isOpen={deleteModal.isOpen}
                projectTitle={deleteModal.project?.title}
                isPending={isDeletePending}
                onClose={onCloseDelete}
                onConfirm={onDeleteConfirm}
            />
        </>
    )
}
