import React from 'react'

import { ModalActions } from '@/features/connections/components/ConnectionsUi'
import { Modal } from '@/shared/components/ui/Modal'

interface SessionArchiveModalProps {
    isOpen: boolean
    onClose: () => void
    onConfirm: () => void
    description?: string
}

const ARCHIVE_DESCRIPTION = 'It moves to Archived and loses its pin. You can unarchive it there.'

// the same look as the delete dialog: a title, one line, Cancel and Archive
export const SessionArchiveModal: React.FC<SessionArchiveModalProps> = ({
    isOpen,
    onClose,
    onConfirm,
    description = ARCHIVE_DESCRIPTION,
}) => {
    const handleConfirm = (event: React.FormEvent) => {
        event.preventDefault()
        onConfirm()
    }

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title="Archive session"
            description={description}
            variant="premium"
            showLogo={false}
            sheetOnPhone
        >
            <form onSubmit={handleConfirm} className="flex flex-col gap-4">
                <ModalActions onCancel={onClose} submitLabel="Archive" />
            </form>
        </Modal>
    )
}

/**
 * asks before an archive. `confirmArchive(run)` opens the dialog and `run` goes only on
 * Archive; render `archiveModal` once where the hook is used. unarchive needs no question.
 * `description` replaces the grey line, for a page where the row does something else
 */
export const useArchiveConfirm = (description?: string) => {
    const [run, setRun] = React.useState<(() => void) | null>(null)

    // a function in state is stored through an updater, so React does not call it
    const confirmArchive = React.useCallback((next: () => void) => setRun(() => next), [])
    const close = React.useCallback(() => setRun(null), [])

    const archiveModal = (
        <SessionArchiveModal
            isOpen={run !== null}
            onClose={close}
            description={description}
            onConfirm={() => {
                setRun(null)
                run?.()
            }}
        />
    )

    return { confirmArchive, archiveModal }
}
