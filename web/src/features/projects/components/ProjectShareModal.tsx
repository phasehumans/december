import React, { useState } from 'react'

import type { ProjectShareModalProps } from '@/features/projects/types'

import { Modal } from '@/shared/components/ui/Modal'

export const ProjectShareModal: React.FC<ProjectShareModalProps> = ({
    isOpen,
    projectTitle,
    isSharedAsTemplate,
    isPending,
    onClose,
    onConfirm,
}) => {
    const displayTitle = projectTitle?.trim() ? `"${projectTitle}"` : 'this project'
    const [isProcessing, setIsProcessing] = useState(false)
    const isDisabled = isPending || isProcessing

    const handleSubmit = (event: React.FormEvent) => {
        event.preventDefault()
        if (isDisabled) return
        setIsProcessing(true)
        setTimeout(() => {
            setIsProcessing(false)
            onConfirm()
        }, 800)
    }

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={isSharedAsTemplate ? 'Unshare template' : 'Share as template'}
            description={
                isSharedAsTemplate
                    ? 'Remove this project from the Community Templates page.'
                    : 'Share this project in the Community Templates page.'
            }
            variant="premium"
        >
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                <p className="text-[13px] leading-relaxed text-[#8F8E8D]">
                    {isSharedAsTemplate ? (
                        <>
                            This will remove{' '}
                            <span className="font-medium text-white">{displayTitle}</span> from the
                            Community Templates page. Other users will no longer be able to discover
                            and remix it.
                        </>
                    ) : (
                        <>
                            This will share{' '}
                            <span className="font-medium text-white">{displayTitle}</span> in the
                            Community Templates page so other users can discover and remix it.
                        </>
                    )}
                </p>

                <div className="mt-1 flex items-center justify-end gap-2.5">
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={isDisabled}
                        className="border border-[#2B2A27] bg-transparent text-white hover:bg-white/5 active:scale-95 transition-[transform,background-color,border-color,color] duration-200 text-[13px] font-medium px-4 py-2 rounded-lg focus:outline-none disabled:opacity-50"
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        disabled={isDisabled}
                        className="bg-white text-black hover:bg-neutral-200 active:scale-95 transition-[transform,background-color,border-color,color] duration-200 text-[13px] font-medium px-4 py-2 rounded-lg focus:outline-none disabled:opacity-40 disabled:pointer-events-none flex items-center justify-center min-w-[145px]"
                    >
                        {isProcessing ? (
                            <div className="flex items-center gap-1.5 justify-center">
                                <span className="w-3.5 h-3.5 border-2 border-black border-t-transparent rounded-full animate-spin" />
                                <span>{isSharedAsTemplate ? 'Unsharing...' : 'Sharing...'}</span>
                            </div>
                        ) : isSharedAsTemplate ? (
                            'Unshare template'
                        ) : (
                            'Share as template'
                        )}
                    </button>
                </div>
            </form>
        </Modal>
    )
}
