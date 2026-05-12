import React from 'react'

import { Modal } from '@/shared/components/ui/Modal'
import { Button } from '@/shared/components/ui/Button'
import type { ProjectShareModalProps } from '@/features/projects/types'

export const ProjectShareModal: React.FC<ProjectShareModalProps> = ({
    isOpen,
    projectTitle,
    isSharedAsTemplate,
    isPending,
    onClose,
    onConfirm,
}) => {
    const displayTitle = projectTitle?.trim() ? `"${projectTitle}"` : 'this project'

    const handleSubmit = (event: React.FormEvent) => {
        event.preventDefault()
        onConfirm()
    }

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={isSharedAsTemplate ? 'Unshare project' : 'Share project'}
            description={
                isSharedAsTemplate
                    ? 'Remove this project from the Community Templates page.'
                    : 'Share this project in the Community Templates page.'
            }
        >
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                <p className="text-sm leading-relaxed text-neutral-400">
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
                <div className="mt-4 flex items-center justify-end gap-3">
                    <Button variant="ghost" type="button" onClick={onClose} disabled={isPending}>
                        Cancel
                    </Button>
                    <Button type="submit" isLoading={isPending}>
                        {isSharedAsTemplate ? 'Unshare' : 'Share'}
                    </Button>
                </div>
            </form>
        </Modal>
    )
}
