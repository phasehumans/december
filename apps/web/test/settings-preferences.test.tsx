import { GlobalRegistrator } from '@happy-dom/global-registrator'
import { expect, test, describe, afterEach, beforeEach } from 'bun:test'
import React from 'react'

if (!globalThis.document) {
    GlobalRegistrator.register()
}

const { render, screen, cleanup, fireEvent } = await import('@testing-library/react')

const { setConnectionsDemo } = await import('../src/features/connections/lib/connectionsDemo')
const { getShortcuts } = await import('../src/features/home/slash/shortcuts')
const { AccountPreferencesSection } =
    await import('../src/features/profile/components/AccountPreferencesSection')
const { usePreferences } = await import('../src/features/profile/lib/preferences')

describe('settings: preferences', () => {
    beforeEach(() => {
        cleanup()
        window.localStorage.clear()
        usePreferences.setState({ sendKey: 'enter', soundOnFinish: false })
        setConnectionsDemo(null)
    })

    afterEach(() => {
        cleanup()
        setConnectionsDemo(null)
    })

    test('the shortcut list follows the send key', () => {
        const byLabel = (key: 'enter' | 'mod-enter') => Object.fromEntries(getShortcuts(key))
        expect(byLabel('enter').Send).toBe('Enter')
        expect(byLabel('enter')['New line']).toBe('Shift Enter')
        expect(byLabel('mod-enter').Send).toBe('Ctrl Enter')
        expect(byLabel('mod-enter')['New line']).toBe('Enter')
    })

    test('Send with saves the choice in the store and in the browser', () => {
        render(<AccountPreferencesSection />)
        const group = screen.getByRole('radiogroup', { name: 'Send with' })
        expect(group).toBeDefined()

        fireEvent.click(screen.getByRole('radio', { name: 'Ctrl + Enter' }))
        expect(usePreferences.getState().sendKey).toBe('mod-enter')
        expect(JSON.parse(window.localStorage.getItem('december:preferences')!).sendKey).toBe(
            'mod-enter'
        )
    })

    test('the sound switch saves, and View opens the shortcut list', () => {
        render(<AccountPreferencesSection />)
        fireEvent.click(screen.getByRole('switch', { name: 'Sound when a session finishes' }))
        expect(usePreferences.getState().soundOnFinish).toBe(true)

        expect(screen.queryByText('Open or close the sidebar')).toBeNull()
        fireEvent.click(screen.getByRole('button', { name: 'View' }))
        expect(screen.getByText('Open or close the sidebar')).toBeDefined()
    })
})
