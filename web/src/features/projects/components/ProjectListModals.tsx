import React from 'react'
import { ProjectRenameModal } from './ProjectRenameModal'
import { ProjectDuplicateModal } from './ProjectDuplicateModal'
import { ProjectDeleteModal } from './ProjectDeleteModal'
import type {
    DeleteModalState,
    DuplicateModalState,
    RenameModalState,
} from '@/features/projects/types'

interface ProjectListModalsProps {
    renameModal: RenameModalState
    duplicateModal: DuplicateModalState
    deleteModal: DeleteModalState
    isRenamePending: boolean
    isDuplicatePending: boolean
    isDeletePending: boolean
    onCloseRename: () => void
    onRenameChange: (nextValue: string) => void
    onRenameSubmit: (event: React.FormEvent) => void
    onCloseDuplicate: () => void
    onDuplicateConfirm: () => void
    onCloseDelete: () => void
    onDeleteConfirm: () => void
}

export const ProjectListModals: React.FC<ProjectListModalsProps> = ({
    renameModal,
    duplicateModal,
    deleteModal,
    isRenamePending,
    isDuplicatePending,
    isDeletePending,
    onCloseRename,
    onRenameChange,
    onRenameSubmit,
    onCloseDuplicate,
    onDuplicateConfirm,
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

            <ProjectDuplicateModal
                isOpen={duplicateModal.isOpen}
                projectTitle={duplicateModal.project?.title}
                isPending={isDuplicatePending}
                onClose={onCloseDuplicate}
                onConfirm={onDuplicateConfirm}
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
