import React from 'react'

import type { SessionDeleteModalProps } from '@/features/sessions/types'

import { ModalActions } from '@/features/connections/components/ConnectionsUi'
import { Modal } from '@/shared/components/ui/Modal'

export const SessionDeleteModal: React.FC<SessionDeleteModalProps> = ({
    isOpen,
    isPending,
    onClose,
    onConfirm,
    description = 'Its sandbox stops. You cannot undo this.',
}) => {
    // sent at once: closing the modal can no longer delete a moment later
    const handleConfirm = (event: React.FormEvent) => {
        event.preventDefault()
        if (isPending) return
        onConfirm()
    }

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title="Delete session"
            description={description}
            variant="premium"
            showLogo={false}
            sheetOnPhone
        >
            {/* no session name: the title and the line under it say what happens */}
            <form onSubmit={handleConfirm} className="flex flex-col gap-4">
                <ModalActions
                    onCancel={onClose}
                    submitLabel="Delete"
                    danger
                    isPending={isPending}
                />
            </form>
        </Modal>
    )
}
