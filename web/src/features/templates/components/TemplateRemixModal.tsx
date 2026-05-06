import React from 'react'

import { Modal } from '@/shared/components/ui/Modal'
import { Button } from '@/shared/components/ui/Button'

interface TemplateRemixModalProps {
    isOpen: boolean
    templateTitle?: string
    isPending: boolean
    onClose: () => void
    onConfirm: () => void
}

export const TemplateRemixModal: React.FC<TemplateRemixModalProps> = ({
    isOpen,
    templateTitle,
    isPending,
    onClose,
    onConfirm,
}) => {
    const displayTitle = templateTitle?.trim() ? `"${templateTitle}"` : 'this template'

    const handleSubmit = (event: React.FormEvent) => {
        event.preventDefault()
        onConfirm()
    }

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title="Remix template"
            description="Create a new project from this template."
        >
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                <p className="text-sm text-neutral-400 leading-relaxed">
                    A new project will be created from{' '}
                    <span className="text-white font-medium">{displayTitle}</span>.
                </p>
                <div className="mt-4 flex items-center justify-end gap-3">
                    <Button variant="ghost" type="button" onClick={onClose} disabled={isPending}>
                        Cancel
                    </Button>
                    <Button type="submit" isLoading={isPending}>
                        Continue
                    </Button>
                </div>
            </form>
        </Modal>
    )
}
