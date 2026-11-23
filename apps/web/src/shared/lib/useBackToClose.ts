import React from 'react'

// the phone back button (and the back swipe) closes the popup on top instead of leaving
// the page. used by bottom sheets, modals, the search modal and the Super Crew card.
//
// - an open popup adds one history entry with the same url. back pops it and the popup
//   closes (or goes up a level when onBack returns true)
// - popups can stack: only the one on top answers a back press
// - when a popup closes on its own it removes its entry again, but only while that entry
//   is still on top. if a page was opened meanwhile (close, then navigate) the entry stays,
//   so the navigation is never undone
// - closeThen(fn) closes the popup and runs fn after its entry is gone, for rows that
//   navigate

interface BackToCloseOptions {
    isOpen: boolean
    onClose: () => void
    /** return true when the back press was handled inside the popup (went up a level) */
    onBack?: () => boolean
}

const STATE_KEY = 'decemberOverlay'

// when a popup removes its own entry, that pop can arrive after the popup is gone (or, in
// strict mode, on the remount), so one app-wide listener, installed before any popup
// listener, marks those pops and popups ignore them
let pendingSelfPops = 0
let lastPopWasSelf = false
let selfPopListenerInstalled = false
const installSelfPopListener = () => {
    if (selfPopListenerInstalled) return
    selfPopListenerInstalled = true
    window.addEventListener('popstate', () => {
        lastPopWasSelf = pendingSelfPops > 0
        if (lastPopWasSelf) pendingSelfPops -= 1
    })
}

/** open popups, last opened on top */
const openStack: number[] = []
let nextId = 1

const isOwnEntryOnTop = (id: number) => window.history.state?.[STATE_KEY] === id

export const useBackToClose = ({ isOpen, onClose, onBack }: BackToCloseOptions) => {
    const onCloseRef = React.useRef(onClose)
    const onBackRef = React.useRef(onBack)
    React.useEffect(() => {
        onCloseRef.current = onClose
        onBackRef.current = onBack
    }, [onClose, onBack])

    const hasEntryRef = React.useRef(false)
    const afterPopRef = React.useRef<(() => void) | null>(null)

    React.useEffect(() => {
        if (!isOpen || typeof window === 'undefined') return
        installSelfPopListener()
        const id = nextId++
        const pushEntry = () => {
            window.history.pushState({ [STATE_KEY]: id }, '')
            hasEntryRef.current = true
        }
        openStack.push(id)
        pushEntry()

        const onPop = () => {
            if (lastPopWasSelf) return
            if (openStack[openStack.length - 1] !== id) return
            hasEntryRef.current = false
            const after = afterPopRef.current
            if (after) {
                afterPopRef.current = null
                after()
                return
            }
            if (onBackRef.current?.()) {
                pushEntry()
                return
            }
            onCloseRef.current()
        }

        window.addEventListener('popstate', onPop)
        return () => {
            window.removeEventListener('popstate', onPop)
            const index = openStack.lastIndexOf(id)
            if (index !== -1) openStack.splice(index, 1)
            if (hasEntryRef.current) {
                hasEntryRef.current = false
                if (isOwnEntryOnTop(id)) {
                    pendingSelfPops += 1
                    window.history.back()
                }
            }
        }
    }, [isOpen])

    const closeThen = React.useCallback((fn: () => void) => {
        if (hasEntryRef.current && typeof window !== 'undefined') {
            afterPopRef.current = () => {
                onCloseRef.current()
                fn()
            }
            window.history.back()
            return
        }
        onCloseRef.current()
        fn()
    }, [])

    return { closeThen }
}
