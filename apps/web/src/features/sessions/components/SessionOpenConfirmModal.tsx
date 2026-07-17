import React from 'react'

import { Modal } from '@/shared/components/ui/Modal'

interface ProjectOpenConfirmModalProps {
    isOpen: boolean
    projectTitle?: string
    onClose: () => void
    onConfirm: () => void
}

export const ProjectOpenConfirmModal: React.FC<ProjectOpenConfirmModalProps> = ({
    isOpen,
    projectTitle,
    onClose,
    onConfirm,
}) => {
    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title="Open Project"
            description="Open this project in the output workspace."
            variant="premium"
            maxWidth="max-w-[380px]"
        >
            <div className="flex flex-col gap-4">
                <p className="text-[13px] text-[#8F8E8D] leading-relaxed">
                    Are you sure you want to open{' '}
                    <span className="text-white font-semibold">"{projectTitle}"</span>? This will
                    load the project in the workspace and start the live preview environment.
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
                        className="bg-white text-black hover:bg-neutral-200 active:scale-95 transition-[transform,background-color,border-color,color] duration-200 text-[13px] font-medium px-4 py-2 rounded-lg focus:outline-none flex items-center justify-center min-w-[95px]"
                    >
                        Confirm
                    </button>
                </div>
            </div>
        </Modal>
    )
}
