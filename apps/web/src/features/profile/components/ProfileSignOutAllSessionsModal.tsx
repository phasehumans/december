import React from 'react'

import { Modal } from '@/shared/components/ui/Modal'

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
            title="Sign out all sessions"
            description="This will immediately invalidate all active sessions."
            variant="premium"
        >
            <div className="flex flex-col gap-4">
                <p className="text-[13px] text-[#8F8E8D] leading-relaxed">
                    Are you sure you want to sign out of all sessions? You will be signed out from
                    all other devices and browsers immediately.
                </p>
                <div className="flex items-center justify-end gap-2.5">
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={isPending}
                        className="bg-transparent text-white hover:bg-white/5 active:scale-95 transition-[transform,background-color,border-color,color] duration-200 text-[13px] font-medium px-4 py-2 rounded-lg focus:outline-none disabled:opacity-50"
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        onClick={onConfirm}
                        disabled={isPending}
                        className="bg-white text-black hover:bg-neutral-200 active:scale-95 transition-[transform,background-color,border-color,color] duration-200 text-[13px] font-medium px-4 py-2 rounded-lg focus:outline-none disabled:opacity-40 disabled:pointer-events-none flex items-center justify-center min-w-[100px]"
                    >
                        {isPending ? (
                            <div className="flex items-center gap-1.5 justify-center">
                                <span className="w-3.5 h-3.5 border-2 border-black border-t-transparent rounded-full animate-spin" />
                                <span>Signing out...</span>
                            </div>
                        ) : (
                            'Confirm'
                        )}
                    </button>
                </div>
            </div>
        </Modal>
    )
}
