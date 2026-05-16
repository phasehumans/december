import React from 'react'

import type { ProfileNameModalProps } from '@/features/profile/types'

import { Button } from '@/shared/components/ui/Button'
import { Input } from '@/shared/components/ui/Input'
import { Modal } from '@/shared/components/ui/Modal'

export const ProfileNameModal: React.FC<ProfileNameModalProps> = ({
    isOpen,
    value,
    isPending,
    title,
    label,
    onClose,
    onChange,
    onSave,
}) => {
    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={title || 'Change Name'}
            maxWidth="max-w-[420px]"
        >
            <div className="space-y-4">
                <Input
                    label={label || 'Display Name'}
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    autoFocus
                />
                <div className="mt-8 flex items-center justify-end gap-3">
                    <Button variant="ghost" onClick={onClose} disabled={isPending}>
                        Cancel
                    </Button>
                    <Button onClick={onSave} isLoading={isPending} disabled={!value.trim()}>
                        Save Changes
                    </Button>
                </div>
            </div>
        </Modal>
    )
}
