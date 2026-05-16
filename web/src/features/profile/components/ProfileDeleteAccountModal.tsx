import React from 'react'

import { Button } from '@/shared/components/ui/Button'
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
    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Delete Account" maxWidth="max-w-[425px]">
            <div className="space-y-4">
                <p className="text-[14px] text-[#7B7A79]">
                    Are you sure you want to delete your account? This action will permanently
                    delete all your data after 90 days. This action cannot be undone.
                </p>
                <div className="mt-8 flex items-center justify-end gap-3">
                    <Button variant="ghost" onClick={onClose} disabled={isPending}>
                        Cancel
                    </Button>
                    <Button variant="danger" onClick={onConfirm} isLoading={isPending}>
                        {isPending ? 'Deleting...' : 'Confirm deletion'}
                    </Button>
                </div>
            </div>
        </Modal>
    )
}
