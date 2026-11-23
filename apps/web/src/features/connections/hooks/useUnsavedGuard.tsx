import React from 'react'

import { ConfirmModal } from '../components/ConnectionsUi'

/**
 * Asks before leaving an editor with unsaved changes. Covers in-app links that go
 * through `guard`, and the browser's own prompt for closing or reloading the tab.
 */
export const useUnsavedGuard = (isDirty: boolean) => {
    const [pending, setPending] = React.useState<(() => void) | null>(null)

    React.useEffect(() => {
        if (!isDirty) return
        const onBeforeUnload = (e: BeforeUnloadEvent) => {
            e.preventDefault()
        }
        window.addEventListener('beforeunload', onBeforeUnload)
        return () => window.removeEventListener('beforeunload', onBeforeUnload)
    }, [isDirty])

    const guard = React.useCallback(
        (action: () => void) => {
            if (isDirty) setPending(() => action)
            else action()
        },
        [isDirty]
    )

    const modal = (
        <ConfirmModal
            isOpen={pending !== null}
            title="Discard changes?"
            confirmLabel="Discard"
            onClose={() => setPending(null)}
            onConfirm={() => {
                const action = pending
                setPending(null)
                action?.()
            }}
        />
    )

    return { guard, modal }
}
