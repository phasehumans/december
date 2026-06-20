import React from 'react'

import { ProjectDeleteModal } from './ProjectDeleteModal'
import { ProjectDuplicateModal } from './ProjectDuplicateModal'
import { ProjectRenameModal } from './ProjectRenameModal'
import { ProjectShareModal } from './ProjectShareModal'
import { ProjectOpenConfirmModal } from './ProjectOpenConfirmModal'

import type {
    DeleteModalState,
    DuplicateModalState,
    RenameModalState,
    ShareModalState,
    Project,
} from '@/features/projects/types'

interface ProjectListModalsProps {
    renameModal: RenameModalState
    duplicateModal: DuplicateModalState
    shareModal: ShareModalState
    deleteModal: DeleteModalState
    openConfirmModal: { isOpen: boolean; project: Project | null }
    isRenamePending: boolean
    isDuplicatePending: boolean
    isSharePending: boolean
    isDeletePending: boolean
    onCloseRename: () => void
    onRenameChange: (nextValue: string) => void
    onRenameSubmit: (event: React.FormEvent) => void
    onCloseDuplicate: () => void
    onDuplicateConfirm: (name: string) => void
    onCloseShare: () => void
    onShareConfirm: (category?: string) => void
    onCloseDelete: () => void
    onDeleteConfirm: () => void
    onCloseOpenConfirm: () => void
    onOpenConfirm: () => void
}

export const ProjectListModals: React.FC<ProjectListModalsProps> = ({
    renameModal,
    duplicateModal,
    shareModal,
    deleteModal,
    openConfirmModal,
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
    onCloseOpenConfirm,
    onOpenConfirm,
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

            <ProjectOpenConfirmModal
                isOpen={openConfirmModal.isOpen}
                projectTitle={openConfirmModal.project?.title}
                onClose={onCloseOpenConfirm}
                onConfirm={onOpenConfirm}
            />
        </>
    )
}
