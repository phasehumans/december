import React, { useState, useEffect } from 'react'

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
        if (isConfirmEnabled && !isPending) {
            onConfirm()
        }
    }

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title="Delete account"
            description="This action is irreversible. Please read carefully."
            variant="premium"
        >
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                <p className="text-[13px] text-[#8F8E8D] leading-relaxed">
                    This will permanently delete your account and all associated data after 90 days.
                    All your projects, settings, and usage history will be removed. This action{' '}
                    <span className="font-semibold text-white">cannot be undone</span>.
                </p>

                <div>
                    <label
                        htmlFor="delete-confirm-input"
                        className="text-[13px] text-[#8F8E8D] mb-2 block leading-relaxed"
                    >
                        To confirm, type{' '}
                        <span className="font-semibold text-white bg-white/[0.06] px-1.5 py-0.5 rounded text-[12px] font-mono">
                            delete
                        </span>{' '}
                        below:
                    </label>
                    <input
                        id="delete-confirm-input"
                        type="text"
                        autoFocus
                        value={confirmText}
                        onChange={(e) => setConfirmText(e.target.value)}
                        className="w-full bg-white/[0.03] border border-[#2B2A27] rounded-lg px-3.5 py-2.5 text-white text-[13px] focus:outline-none focus:border-[#4E4D49] focus:ring-1 focus:ring-[#4E4D49] transition-[border-color,box-shadow] duration-200 placeholder:text-[#4A4948]"
                        placeholder="delete"
                        disabled={isPending}
                        autoComplete="off"
                        spellCheck={false}
                    />
                </div>

                <div className="flex items-center justify-end gap-2.5">
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={isPending}
                        className="border border-[#2B2A27] bg-transparent text-white hover:bg-white/5 active:scale-95 transition-[transform,background-color,border-color,color] duration-200 text-[13px] font-medium px-4 py-2 rounded-lg focus:outline-none disabled:opacity-50"
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        disabled={!isConfirmEnabled || isPending}
                        className="bg-[#EF4444] text-white hover:bg-red-600 active:scale-[0.97] transition-[transform,background-color,border-color,color] duration-200 text-[13px] font-medium px-4 py-2 rounded-lg focus:outline-none disabled:opacity-30 disabled:pointer-events-none flex items-center justify-center min-w-[140px]"
                    >
                        {isPending ? (
                            <div className="flex items-center gap-1.5 justify-center">
                                <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                <span>Deleting...</span>
                            </div>
                        ) : (
                            'Delete my account'
                        )}
                    </button>
                </div>
            </form>
        </Modal>
    )
}
