import React from 'react'

import type { SessionRenameModalProps } from '@/features/sessions/types'

import { ModalActions, inputClass } from '@/features/connections/components/ConnectionsUi'
import { Modal } from '@/shared/components/ui/Modal'

/** the server takes a name up to this long */
const MAX_TITLE_LENGTH = 100

export const SessionRenameModal: React.FC<SessionRenameModalProps> = ({
    isOpen,
    value,
    initialValue,
    isPending,
    onClose,
    onChange,
    onSubmit,
}) => {
    const inputRef = React.useRef<HTMLInputElement>(null)
    const trimmed = value.trim()
    // Save stays off until the name changes (R1)
    const isUnchanged = trimmed === (initialValue ?? '').trim()

    // the name is selected on open, so typing replaces it (R2)
    React.useEffect(() => {
        if (isOpen) inputRef.current?.select()
    }, [isOpen])

    // sent at once: closing the modal can no longer rename a moment later
    const handleSubmit = (event: React.FormEvent) => {
        event.preventDefault()
        if (!trimmed || isUnchanged || isPending) return
        onSubmit(event)
    }

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title="Rename session"
            description="Shows in the sidebar and on the Sessions page."
            variant="premium"
            showLogo={false}
            sheetOnPhone
        >
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                <input
                    ref={inputRef}
                    id="project-rename-input"
                    type="text"
                    autoFocus
                    aria-label="Session name"
                    maxLength={MAX_TITLE_LENGTH}
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    className={inputClass}
                    placeholder="Session name"
                    disabled={isPending}
                />
                <ModalActions
                    onCancel={onClose}
                    submitLabel="Save"
                    submitDisabled={!trimmed || isUnchanged}
                    isPending={isPending}
                />
            </form>
        </Modal>
    )
}
