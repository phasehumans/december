import React from 'react'

import { Modal } from '@/shared/components/ui/Modal'

interface ExitConfirmModalProps {
    isOpen: boolean
    onClose: () => void
    onConfirm: () => void
}

export const ExitConfirmModal: React.FC<ExitConfirmModalProps> = ({
    isOpen,
    onClose,
    onConfirm,
}) => {
    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title="Exit Project"
            description="Your current generation and the preview container will stop."
            variant="premium"
            maxWidth="max-w-[380px]"
        >
            <div className="flex flex-col gap-4">
                <p className="text-[13px] text-[#8F8E8D] leading-relaxed">
                    Are you sure you want to exit the current project? The active preview
                    environment and all running code generation processes will be stopped.
                </p>
                <div className="flex items-center justify-end gap-2.5">
                    <button
                        type="button"
                        onClick={onClose}
                        className="bg-transparent text-white hover:bg-white/5 active:scale-95 transition-[transform,background-color,border-color,color] duration-200 text-[13px] font-medium px-4 py-2 rounded-lg focus:outline-none"
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        onClick={onConfirm}
                        className="bg-[#EF4444] text-white hover:bg-red-600 active:scale-95 transition-[transform,background-color,border-color,color] duration-200 text-[13px] font-medium px-4 py-2 rounded-lg focus:outline-none flex items-center justify-center min-w-[100px]"
                    >
                        Exit Project
                    </button>
                </div>
            </div>
        </Modal>
    )
}
