import React from 'react'

import { Modal } from '@/shared/components/ui/Modal'
import { Button } from '@/shared/components/ui/Button'
import type { ProjectDeleteModalProps } from '@/features/projects/types'

export const ProjectDeleteModal: React.FC<ProjectDeleteModalProps> = ({
    isOpen,
    projectTitle,
    isPending,
    onClose,
    onConfirm,
}) => {
    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Delete project?" maxWidth="max-w-[400px]">
            <div className="flex flex-col gap-4">
                <p className="text-sm text-neutral-400 leading-relaxed">
                    Are you sure you want to delete{' '}
                    <span className="text-white font-medium">"{projectTitle}"</span>? This action
                    cannot be undone.
                </p>
                <div className="mt-2 flex items-center justify-end gap-3">
                    <Button variant="ghost" onClick={onClose} disabled={isPending}>
                        Cancel
                    </Button>
                    <Button
                        variant="danger"
                        className="bg-red-600 text-white border-0 hover:bg-red-700"
                        onClick={onConfirm}
                        isLoading={isPending}
                    >
                        Continue
                    </Button>
                </div>
            </div>
        </Modal>
    )
}
