import React from 'react'

import { SessionDeleteModal } from './SessionDeleteModal'
import { SessionDuplicateModal } from './SessionDuplicateModal'
import { SessionOpenConfirmModal } from './SessionOpenConfirmModal'
import { SessionRenameModal } from './SessionRenameModal'
import { SessionShareModal } from './SessionShareModal'

import type {
    DeleteModalState,
    DuplicateModalState,
    RenameModalState,
    ShareModalState,
    Project,
} from '@/features/sessions/types'

interface SessionListModalsProps {
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

export const SessionListModals: React.FC<SessionListModalsProps> = ({
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
            <SessionRenameModal
                isOpen={renameModal.isOpen}
                value={renameModal.value}
                isPending={isRenamePending}
                onClose={onCloseRename}
                onChange={onRenameChange}
                onSubmit={onRenameSubmit}
            />

            <SessionDuplicateModal
                isOpen={duplicateModal.isOpen}
                projectTitle={duplicateModal.project?.title}
                isPending={isDuplicatePending}
                onClose={onCloseDuplicate}
                onConfirm={onDuplicateConfirm}
            />

            <SessionShareModal
                isOpen={shareModal.isOpen}
                projectTitle={shareModal.project?.title}
                isSharedAsTemplate={shareModal.project?.isSharedAsTemplate ?? false}
                isPending={isSharePending}
                onClose={onCloseShare}
                onConfirm={onShareConfirm}
            />

            <SessionDeleteModal
                isOpen={deleteModal.isOpen}
                projectTitle={deleteModal.project?.title}
                isPending={isDeletePending}
                onClose={onCloseDelete}
                onConfirm={onDeleteConfirm}
            />

            <SessionOpenConfirmModal
                isOpen={openConfirmModal.isOpen}
                projectTitle={openConfirmModal.project?.title}
                onClose={onCloseOpenConfirm}
                onConfirm={onOpenConfirm}
            />
        </>
    )
}
