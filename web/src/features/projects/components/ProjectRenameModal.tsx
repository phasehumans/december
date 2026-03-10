import React from 'react'
import { Modal } from '@/shared/components/ui/Modal'
import { Button } from '@/shared/components/ui/Button'
import { Input } from '@/shared/components/ui/Input'
import type { ProjectRenameModalProps } from '@/features/projects/types'

export const ProjectRenameModal: React.FC<ProjectRenameModalProps> = ({
    isOpen,
    value,
    isPending,
    onClose,
    onChange,
    onSubmit,
}) => {
    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title="Rename project"
            description="Update how this project appears in your workspace."
        >
            <form onSubmit={onSubmit} className="flex flex-col gap-4">
                <Input
                    label="Display Name"
                    autoFocus
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                />
                <div className="mt-4 flex items-center justify-end gap-3">
                    <Button variant="ghost" type="button" onClick={onClose} disabled={isPending}>
                        Cancel
                    </Button>
                    <Button
                        type="submit"
                        disabled={!value.trim() || isPending}
                        isLoading={isPending}
                    >
                        Save
                    </Button>
                </div>
            </form>
        </Modal>
    )
}
