import React from 'react'
import { Modal } from '@/shared/components/ui/Modal'
import { Button } from '@/shared/components/ui/Button'
import type { ProjectDuplicateModalProps } from '@/features/projects/types'

export const ProjectDuplicateModal: React.FC<ProjectDuplicateModalProps> = ({
    isOpen,
    projectTitle,
    isPending,
    onClose,
    onConfirm,
}) => {
    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Duplicate project?" maxWidth="max-w-[400px]">
            <div className="flex flex-col gap-4">
                <p className="text-sm text-neutral-400 leading-relaxed">
                    Create a duplicate of <span className="text-white font-medium">"{projectTitle}"</span>?
                </p>
                <div className="mt-2 flex items-center justify-end gap-3">
                    <Button variant="ghost" onClick={onClose} disabled={isPending}>
                        Cancel
                    </Button>
                    <Button variant="secondary" onClick={onConfirm} isLoading={isPending}>
                        Continue
                    </Button>
                </div>
            </div>
        </Modal>
    )
}
