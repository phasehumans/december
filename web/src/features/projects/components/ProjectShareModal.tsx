import React from 'react'

import { Modal } from '@/shared/components/ui/Modal'
import { Button } from '@/shared/components/ui/Button'
import type { ProjectShareModalProps } from '@/features/projects/types'

export const ProjectShareModal: React.FC<ProjectShareModalProps> = ({
    isOpen,
    projectTitle,
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
            title="Share project"
            description="Share this project in the Community Templates page."
        >
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                <p className="text-sm leading-relaxed text-neutral-400">
                    This will share <span className="font-medium text-white">{displayTitle}</span>{' '}
                    in the Community Templates page so other users can discover and remix it.
                </p>
                <div className="mt-4 flex items-center justify-end gap-3">
                    <Button variant="ghost" type="button" onClick={onClose} disabled={isPending}>
                        Cancel
                    </Button>
                    <Button type="submit" isLoading={isPending}>
                        Share
                    </Button>
                </div>
            </form>
        </Modal>
    )
}
