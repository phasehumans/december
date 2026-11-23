import React from 'react'

import type { ProfileNameModalProps } from '@/features/profile/types'

import {
    FormError,
    ModalActions,
    inputClass,
} from '@/features/connections/components/ConnectionsUi'
import { Modal } from '@/shared/components/ui/Modal'

export const ProfileNameModal: React.FC<ProfileNameModalProps> = ({
    isOpen,
    value,
    isPending,
    title,
    label,
    errorMessage,
    onClose,
    onChange,
    onSave,
}) => {
    const fieldName = label?.toLowerCase() || 'name'

    const handleFormSubmit = (e: React.FormEvent) => {
        e.preventDefault()
        // the modal is portaled, so stop the submit reaching a form behind it
        e.stopPropagation()
        if (value.trim() && !isPending) {
            onSave()
        }
    }

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={title || 'Change name'}
            description={`Your new ${fieldName} shows everywhere in December.`}
            variant="premium"
            showLogo={false}
            sheetOnPhone
        >
            <form onSubmit={handleFormSubmit} className="flex flex-col gap-4">
                <input
                    id="profile-name-input"
                    type="text"
                    autoFocus
                    aria-label={label || 'Name'}
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    className={inputClass}
                    placeholder={label || 'Name'}
                    disabled={isPending}
                />
                <FormError>{errorMessage}</FormError>
                <ModalActions
                    onCancel={onClose}
                    submitLabel="Save"
                    submitDisabled={!value.trim()}
                    isPending={isPending}
                />
            </form>
        </Modal>
    )
}
