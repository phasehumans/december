import React from 'react'
import { Modal } from '../../ui/Modal'
import { Button } from '../../ui/Button'
import { Input } from '../../ui/Input'

interface ProfileNameModalProps {
    isOpen: boolean
    value: string
    isPending: boolean
    onClose: () => void
    onChange: (value: string) => void
    onSave: () => void
}

export const ProfileNameModal: React.FC<ProfileNameModalProps> = ({
    isOpen,
    value,
    isPending,
    onClose,
    onChange,
    onSave,
}) => {
    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Change Name" maxWidth="max-w-[420px]">
            <div className="space-y-4">
                <Input
                    label="Display Name"
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
