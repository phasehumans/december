import React from 'react'

import { ModalActions } from '@/features/connections/components/ConnectionsUi'
import { Modal } from '@/shared/components/ui/Modal'

interface ProfileSignOutAllSessionsModalProps {
    isOpen: boolean
    isPending?: boolean
    errorMessage?: string
    onClose: () => void
    onConfirm: () => void
}

export const ProfileSignOutAllSessionsModal: React.FC<ProfileSignOutAllSessionsModalProps> = ({
    isOpen,
    isPending,
    errorMessage,
    onClose,
    onConfirm,
}) => {
    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title="Sign out everywhere"
            description={errorMessage ?? 'You sign out on every device and browser.'}
            variant="premium"
            showLogo={false}
            sheetOnPhone
        >
            <form
                onSubmit={(e) => {
                    e.preventDefault()
                    // the modal is portaled, so stop the submit reaching a form behind it
                    e.stopPropagation()
                    if (!isPending) onConfirm()
                }}
            >
                <ModalActions onCancel={onClose} submitLabel="Sign out" isPending={isPending} />
            </form>
        </Modal>
    )
}
