import React from 'react'

import { SessionDeleteModal } from './SessionDeleteModal'
import { SessionRenameModal } from './SessionRenameModal'
import { SessionTagsModal } from './SessionTagsModal'

import type { DeleteModalState, RenameModalState } from '@/features/sessions/types'

interface SessionListModalsProps {
    renameModal: RenameModalState
    deleteModal: DeleteModalState
    tagsModal: { isOpen: boolean; project: any | null }
    isRenamePending: boolean
    isDeletePending: boolean
    isTagsPending: boolean
    onCloseRename: () => void
    onRenameChange: (nextValue: string) => void
    onRenameSubmit: (event: React.FormEvent) => void
    onCloseDelete: () => void
    onDeleteConfirm: () => void
    onCloseTags: () => void
    onSaveTags: (tags: string[]) => void
}

export const SessionListModals: React.FC<SessionListModalsProps> = ({
    renameModal,
    deleteModal,
    tagsModal,
    isRenamePending,
    isDeletePending,
    isTagsPending,
    onCloseRename,
    onRenameChange,
    onRenameSubmit,
    onCloseDelete,
    onDeleteConfirm,
    onCloseTags,
    onSaveTags,
}) => {
    return (
        <>
            <SessionRenameModal
                isOpen={renameModal.isOpen}
                value={renameModal.value}
                initialValue={renameModal.project?.title ?? ''}
                isPending={isRenamePending}
                onClose={onCloseRename}
                onChange={onRenameChange}
                onSubmit={onRenameSubmit}
            />

            <SessionDeleteModal
                isOpen={deleteModal.isOpen}
                projectTitle={deleteModal.project?.title}
                isPending={isDeletePending}
                onClose={onCloseDelete}
                onConfirm={onDeleteConfirm}
            />

            <SessionTagsModal
                isOpen={tagsModal.isOpen}
                session={tagsModal.project}
                isPending={isTagsPending}
                onClose={onCloseTags}
                onSave={onSaveTags}
            />
        </>
    )
}
