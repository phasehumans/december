import React from 'react'

import { ProjectDeleteModal } from './ProjectDeleteModal'
import { ProjectDuplicateModal } from './ProjectDuplicateModal'
import { ProjectRenameModal } from './ProjectRenameModal'
import { ProjectShareModal } from './ProjectShareModal'

import type {
    DeleteModalState,
    DuplicateModalState,
    RenameModalState,
    ShareModalState,
} from '@/features/projects/types'

interface ProjectListModalsProps {
    renameModal: RenameModalState
    duplicateModal: DuplicateModalState
    shareModal: ShareModalState
    deleteModal: DeleteModalState
    isRenamePending: boolean
    isDuplicatePending: boolean
    isSharePending: boolean
    isDeletePending: boolean
    onCloseRename: () => void
    onRenameChange: (nextValue: string) => void
    onRenameSubmit: (event: React.FormEvent) => void
    onCloseDuplicate: () => void
    onDuplicateConfirm: () => void
    onCloseShare: () => void
    onShareConfirm: () => void
    onCloseDelete: () => void
    onDeleteConfirm: () => void
}

export const ProjectListModals: React.FC<ProjectListModalsProps> = ({
    renameModal,
    duplicateModal,
    shareModal,
    deleteModal,
    isRenamePending,
    isDuplicatePending,
    isSharePending,
    isDeletePending,
    onCloseRename,
    onRenameChange,
    onRenameSubmit,
    onCloseDuplicate,
    onDuplicateConfirm,
    onCloseShare,
    onShareConfirm,
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

            <ProjectShareModal
                isOpen={shareModal.isOpen}
                projectTitle={shareModal.project?.title}
                isSharedAsTemplate={shareModal.project?.isSharedAsTemplate ?? false}
                isPending={isSharePending}
                onClose={onCloseShare}
                onConfirm={onShareConfirm}
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
