import React from 'react'
import { Modal } from '@/shared/components/ui/Modal'
import { Button } from '@/shared/components/ui/Button'
import { AlertCircle } from 'lucide-react'

interface ProfileSignOutAllSessionsModalProps {
    isOpen: boolean
    isPending?: boolean
    onClose: () => void
    onConfirm: () => void
}

export const ProfileSignOutAllSessionsModal: React.FC<ProfileSignOutAllSessionsModalProps> = ({
    isOpen,
    isPending,
    onClose,
    onConfirm,
}) => {
    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title="Sign Out All Sessions"
            maxWidth="max-w-[425px]"
        >
            <div className="space-y-4">
                <p className="text-[14px] text-[#7B7A79]">
                    Are you sure you want to sign out of all sessions? You will be signed out from
                    all other devices and browsers immediately.
                </p>
                <div className="mt-8 flex items-center justify-end gap-3">
                    <Button variant="ghost" onClick={onClose} disabled={isPending}>
                        Cancel
                    </Button>
                    <Button variant="secondary" onClick={onConfirm} isLoading={isPending}>
                        {isPending ? 'Signing out...' : 'Confirm'}
                    </Button>
                </div>
            </div>
        </Modal>
    )
}
