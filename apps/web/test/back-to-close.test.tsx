import { GlobalRegistrator } from '@happy-dom/global-registrator'
import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test'
import React from 'react'

if (!globalThis.document) {
    GlobalRegistrator.register()
}

const { render, cleanup, act } = await import('@testing-library/react')

import { useBackToClose } from '../src/shared/lib/useBackToClose'

const Popup: React.FC<{
    isOpen: boolean
    onClose: () => void
    onBack?: () => boolean
    onReady?: (closeThen: (fn: () => void) => void) => void
}> = ({ isOpen, onClose, onBack, onReady }) => {
    const { closeThen } = useBackToClose({ isOpen, onClose, onBack })
    onReady?.(closeThen)
    return null
}

// history.back fires popstate later; give it a moment
const settle = () => act(() => new Promise((resolve) => setTimeout(resolve, 30)))
const pressBack = async () => {
    window.history.back()
    await settle()
}

describe('useBackToClose', () => {
    beforeEach(() => {
        cleanup()
        ;(window as unknown as { happyDOM: { setURL: (url: string) => void } }).happyDOM.setURL(
            'http://localhost/start'
        )
        window.history.replaceState({ page: 'start' }, '', '/start')
    })
    afterEach(() => cleanup())

    test('back closes an open popup and stays on the page', async () => {
        const onClose = mock(() => {})
        render(<Popup isOpen onClose={onClose} />)
        expect(window.location.pathname).toBe('/start')

        await pressBack()
        expect(onClose).toHaveBeenCalledTimes(1)
        expect(window.location.pathname).toBe('/start')
    })

    test('back goes up a level first when onBack handles it', async () => {
        const onClose = mock(() => {})
        let levels = 1
        const onBack = () => {
            if (levels === 0) return false
            levels -= 1
            return true
        }
        render(<Popup isOpen onClose={onClose} onBack={onBack} />)

        await pressBack()
        expect(onClose).not.toHaveBeenCalled()
        await pressBack()
        expect(onClose).toHaveBeenCalledTimes(1)
    })

    test('with two popups open, back closes only the top one', async () => {
        const closeLower = mock(() => {})
        const closeTop = mock(() => {})
        const { rerender } = render(
            <>
                <Popup isOpen onClose={closeLower} />
                <Popup isOpen={false} onClose={closeTop} />
            </>
        )
        rerender(
            <>
                <Popup isOpen onClose={closeLower} />
                <Popup isOpen onClose={closeTop} />
            </>
        )

        await pressBack()
        expect(closeTop).toHaveBeenCalledTimes(1)
        expect(closeLower).not.toHaveBeenCalled()
    })

    test('closing on its own removes its entry, without closing others', async () => {
        const closeLower = mock(() => {})
        const { rerender } = render(
            <>
                <Popup isOpen onClose={closeLower} />
                <Popup isOpen={false} onClose={() => {}} />
            </>
        )
        rerender(
            <>
                <Popup isOpen onClose={closeLower} />
                <Popup isOpen onClose={() => {}} />
            </>
        )
        // the top popup closes from its own button
        rerender(
            <>
                <Popup isOpen onClose={closeLower} />
                <Popup isOpen={false} onClose={() => {}} />
            </>
        )
        await settle()
        expect(closeLower).not.toHaveBeenCalled()

        // the next back press belongs to the lower popup
        await pressBack()
        expect(closeLower).toHaveBeenCalledTimes(1)
        expect(window.location.pathname).toBe('/start')
    })

    test('a page opened while closing is not undone', async () => {
        const { rerender } = render(<Popup isOpen onClose={() => {}} />)
        // a button closes the popup and opens another page in the same click
        window.history.pushState({ page: 'next' }, '', '/next')
        rerender(<Popup isOpen={false} onClose={() => {}} />)
        await settle()
        expect(window.location.pathname).toBe('/next')
    })

    test('closeThen runs after the entry is gone, so its navigation stays', async () => {
        const onClose = mock(() => {})
        let closeThen: (fn: () => void) => void = () => {}
        render(<Popup isOpen onClose={onClose} onReady={(fn) => (closeThen = fn)} />)

        closeThen(() => window.history.pushState({ page: 'next' }, '', '/next'))
        await settle()
        expect(onClose).toHaveBeenCalledTimes(1)
        expect(window.location.pathname).toBe('/next')
    })
})
