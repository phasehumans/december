import { GlobalRegistrator } from '@happy-dom/global-registrator'
import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import React from 'react'

if (!globalThis.document) {
    GlobalRegistrator.register()
}

const { render, cleanup, act } = await import('@testing-library/react')

import { useAppStore } from '../src/app/store'
import { useSwipeUpToOpenMenu } from '../src/features/navigation/hooks/useSwipeUpToOpenMenu'
import { useBackToClose } from '../src/shared/lib/useBackToClose'

// the home screen on phones: a swipe up opens the menu sheet

const Popup: React.FC = () => {
    useBackToClose({ isOpen: true, onClose: () => {} })
    return null
}

const Screen: React.FC<{ menuOpen?: boolean; popupOpen?: boolean }> = ({
    menuOpen = false,
    popupOpen = false,
}) => {
    const ref = React.useRef<HTMLElement | null>(null)
    useSwipeUpToOpenMenu(ref)
    return (
        <main ref={ref} data-testid="screen">
            <div data-testid="page">page</div>
            <textarea data-testid="box" />
            <div data-testid="list" style={{ overflowY: 'auto' }}>
                <div data-testid="list-row">row</div>
            </div>
            {menuOpen && <div role="menu">menu</div>}
            {popupOpen && <Popup />}
        </main>
    )
}

let restoreMatchMedia: (() => void) | null = null
const setWidth = (isPhone: boolean) => {
    const original = window.matchMedia
    window.matchMedia = ((query: string) => ({
        matches: isPhone && query.includes('max-width'),
        media: query,
        addEventListener: () => {},
        removeEventListener: () => {},
    })) as never
    restoreMatchMedia = () => {
        window.matchMedia = original
    }
}

interface Finger {
    x: number
    y: number
}

const touch = (el: Element, type: string, fingers: Finger[]) => {
    const event = new Event(type, { bubbles: true })
    Object.defineProperty(event, 'touches', {
        value: fingers.map((f) => ({ clientX: f.x, clientY: f.y })),
    })
    act(() => {
        el.dispatchEvent(event)
    })
}

/** one finger from one point to another, in two steps like a real swipe */
const swipe = (el: Element, from: Finger, to: Finger) => {
    touch(el, 'touchstart', [from])
    touch(el, 'touchmove', [{ x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 }])
    touch(el, 'touchmove', [to])
    touch(el, 'touchend', [])
}

const isSheetOpen = () => useAppStore.getState().isMobileSidebarOpen

describe('swipe up on the phone home screen', () => {
    beforeEach(() => {
        setWidth(true)
        useAppStore.setState({ isMobileSidebarOpen: false, mobileSheetStart: 'inbox' })
    })
    afterEach(() => {
        cleanup()
        restoreMatchMedia?.()
        restoreMatchMedia = null
        useAppStore.setState({ isMobileSidebarOpen: false, mobileSheetStart: 'menu' })
    })

    test('a swipe up opens the sheet on the menu level', () => {
        const { getByTestId } = render(<Screen />)
        swipe(getByTestId('page'), { x: 180, y: 500 }, { x: 186, y: 420 })
        expect(isSheetOpen()).toBe(true)
        expect(useAppStore.getState().mobileSheetStart).toBe('menu')
    })

    test('the sheet opens while the finger is still down, at 60px', () => {
        const { getByTestId } = render(<Screen />)
        const page = getByTestId('page')
        touch(page, 'touchstart', [{ x: 180, y: 500 }])
        touch(page, 'touchmove', [{ x: 180, y: 445 }])
        expect(isSheetOpen()).toBe(false)
        touch(page, 'touchmove', [{ x: 180, y: 440 }])
        expect(isSheetOpen()).toBe(true)
    })

    test('a short swipe, a swipe down and a swipe to the side do nothing', () => {
        const { getByTestId } = render(<Screen />)
        const page = getByTestId('page')
        swipe(page, { x: 180, y: 500 }, { x: 180, y: 460 })
        swipe(page, { x: 180, y: 300 }, { x: 180, y: 420 })
        swipe(page, { x: 100, y: 500 }, { x: 240, y: 490 })
        // far enough up, but more to the side than a swipe up goes
        swipe(page, { x: 100, y: 500 }, { x: 160, y: 430 })
        expect(isSheetOpen()).toBe(false)
    })

    test('a swipe that went to the side does not open later in the same touch', () => {
        const { getByTestId } = render(<Screen />)
        const page = getByTestId('page')
        touch(page, 'touchstart', [{ x: 100, y: 500 }])
        touch(page, 'touchmove', [{ x: 170, y: 435 }])
        touch(page, 'touchmove', [{ x: 170, y: 200 }])
        touch(page, 'touchend', [])
        expect(isSheetOpen()).toBe(false)
    })

    test('nothing happens on a wide screen', () => {
        restoreMatchMedia?.()
        setWidth(false)
        const { getByTestId } = render(<Screen />)
        swipe(getByTestId('page'), { x: 180, y: 500 }, { x: 180, y: 400 })
        expect(isSheetOpen()).toBe(false)
    })

    test('two fingers do nothing', () => {
        const { getByTestId } = render(<Screen />)
        const page = getByTestId('page')
        touch(page, 'touchstart', [
            { x: 150, y: 500 },
            { x: 220, y: 500 },
        ])
        touch(page, 'touchmove', [
            { x: 150, y: 400 },
            { x: 220, y: 400 },
        ])
        expect(isSheetOpen()).toBe(false)

        // a second finger that lands during a swipe stops it
        touch(page, 'touchstart', [{ x: 150, y: 500 }])
        touch(page, 'touchmove', [
            { x: 150, y: 400 },
            { x: 220, y: 400 },
        ])
        touch(page, 'touchmove', [{ x: 150, y: 380 }])
        expect(isSheetOpen()).toBe(false)
    })

    test('a swipe that starts in the text box does nothing', () => {
        const { getByTestId } = render(<Screen />)
        swipe(getByTestId('box'), { x: 180, y: 500 }, { x: 180, y: 400 })
        expect(isSheetOpen()).toBe(false)
    })

    test('a swipe that starts in a list that scrolls does nothing', () => {
        const { getByTestId } = render(<Screen />)
        const list = getByTestId('list')
        const row = getByTestId('list-row')

        // the list fits: the swipe is free
        swipe(row, { x: 180, y: 500 }, { x: 180, y: 400 })
        expect(isSheetOpen()).toBe(true)

        act(() => useAppStore.setState({ isMobileSidebarOpen: false }))
        Object.defineProperty(list, 'scrollHeight', { value: 400, configurable: true })
        Object.defineProperty(list, 'clientHeight', { value: 120, configurable: true })
        swipe(row, { x: 180, y: 500 }, { x: 180, y: 400 })
        expect(isSheetOpen()).toBe(false)
    })

    test('nothing happens while a menu of the page is open', () => {
        const { getByTestId } = render(<Screen menuOpen />)
        swipe(getByTestId('page'), { x: 180, y: 500 }, { x: 180, y: 400 })
        expect(isSheetOpen()).toBe(false)
    })

    test('nothing happens while a sheet or modal is open', () => {
        const { getByTestId } = render(<Screen popupOpen />)
        swipe(getByTestId('page'), { x: 180, y: 500 }, { x: 180, y: 400 })
        expect(isSheetOpen()).toBe(false)
    })

    test('nothing happens while the keyboard is up', () => {
        const original = Object.getOwnPropertyDescriptor(window, 'visualViewport')
        Object.defineProperty(window, 'visualViewport', {
            value: { height: window.innerHeight - 300 },
            configurable: true,
        })
        try {
            const { getByTestId } = render(<Screen />)
            swipe(getByTestId('page'), { x: 180, y: 500 }, { x: 180, y: 400 })
            expect(isSheetOpen()).toBe(false)
        } finally {
            if (original) Object.defineProperty(window, 'visualViewport', original)
            else delete (window as { visualViewport?: unknown }).visualViewport
        }
    })
})
