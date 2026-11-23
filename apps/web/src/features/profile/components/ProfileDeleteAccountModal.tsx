import React, { useState, useEffect } from 'react'

import { ModalActions, inputClass } from '@/features/connections/components/ConnectionsUi'
import { Modal } from '@/shared/components/ui/Modal'

interface ProfileDeleteAccountModalProps {
    isOpen: boolean
    isPending?: boolean
    onClose: () => void
    onConfirm: () => void
}

export const ProfileDeleteAccountModal: React.FC<ProfileDeleteAccountModalProps> = ({
    isOpen,
    isPending,
    onClose,
    onConfirm,
}) => {
    const [confirmText, setConfirmText] = useState('')
    const isConfirmEnabled = confirmText === 'delete'

    useEffect(() => {
        if (!isOpen) {
            setConfirmText('')
        }
    }, [isOpen])

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault()
        // the modal is portaled, so stop the submit reaching a form behind it
        e.stopPropagation()
        if (isConfirmEnabled && !isPending) {
            onConfirm()
        }
    }

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title="Delete account"
            description="Your account and all its data are deleted after 90 days. You cannot undo this."
            variant="premium"
            showLogo={false}
            sheetOnPhone
        >
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                <input
                    id="delete-confirm-input"
                    type="text"
                    autoFocus
                    aria-label="Type delete to confirm"
                    value={confirmText}
                    onChange={(e) => setConfirmText(e.target.value)}
                    className={inputClass}
                    placeholder="Type delete to confirm"
                    disabled={isPending}
                    autoComplete="off"
                    autoCapitalize="off"
                    spellCheck={false}
                />
                <ModalActions
                    onCancel={onClose}
                    submitLabel="Delete account"
                    submitDisabled={!isConfirmEnabled}
                    isPending={isPending}
                    danger
                />
            </form>
        </Modal>
    )
}
