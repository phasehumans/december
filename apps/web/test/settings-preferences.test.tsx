import { GlobalRegistrator } from '@happy-dom/global-registrator'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
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
const { BASE_PREFERENCES, changedPreferences, pickPreferences, usePreferences } =
    await import('../src/features/profile/lib/preferences')
const { profileAPI } = await import('../src/features/profile/api/profile')

// each change is also saved on the account (#636)
const saved: Array<Record<string, unknown>> = []
const realUpdatePreferences = profileAPI.updatePreferences

const renderSection = () =>
    render(
        <QueryClientProvider client={new QueryClient()}>
            <AccountPreferencesSection />
        </QueryClientProvider>
    )

describe('settings: preferences', () => {
    beforeEach(() => {
        cleanup()
        window.localStorage.clear()
        usePreferences.setState({
            sendKey: 'enter',
            soundOnFinish: false,
            messageWhileWorking: 'queue',
        })
        setConnectionsDemo(null)
        saved.length = 0
        profileAPI.updatePreferences = async (values) => {
            saved.push(values)
            return { preferences: values }
        }
    })

    afterEach(() => {
        cleanup()
        setConnectionsDemo(null)
        profileAPI.updatePreferences = realUpdatePreferences
    })

    test('the shortcut list follows the send key', () => {
        const byLabel = (key: 'enter' | 'mod-enter') => Object.fromEntries(getShortcuts(key))
        expect(byLabel('enter').Send).toBe('Enter')
        expect(byLabel('enter')['New line']).toBe('Shift Enter')
        expect(byLabel('mod-enter').Send).toBe('Ctrl Enter')
        expect(byLabel('mod-enter')['New line']).toBe('Enter')
    })

    test('Send with saves the choice in the store and in the browser', () => {
        renderSection()
        const group = screen.getByRole('radiogroup', { name: 'Send with' })
        expect(group).toBeDefined()

        fireEvent.click(screen.getByRole('radio', { name: 'Ctrl + Enter' }))
        expect(usePreferences.getState().sendKey).toBe('mod-enter')
        expect(JSON.parse(window.localStorage.getItem('december:preferences')!).sendKey).toBe(
            'mod-enter'
        )
        expect(saved).toEqual([{ sendKey: 'mod-enter' }])
    })

    test('the sound switch saves, and View opens the shortcut list', () => {
        renderSection()
        fireEvent.click(screen.getByRole('switch', { name: 'Sound when a session finishes' }))
        expect(usePreferences.getState().soundOnFinish).toBe(true)
        expect(saved).toEqual([{ soundOnFinish: true }])

        expect(screen.queryByText('Open or close the sidebar')).toBeNull()
        fireEvent.click(screen.getByRole('button', { name: 'View' }))
        expect(screen.getByText('Open or close the sidebar')).toBeDefined()
    })

    test('values saved on the account replace the ones in this browser', () => {
        usePreferences
            .getState()
            .applyPreferences(pickPreferences({ sendKey: 'mod-enter', soundOnFinish: 'yes' }))
        expect(usePreferences.getState().sendKey).toBe('mod-enter')
        // a bad saved value is ignored
        expect(usePreferences.getState().soundOnFinish).toBe(false)
        expect(JSON.parse(window.localStorage.getItem('december:preferences')!)).toEqual({
            sendKey: 'mod-enter',
            soundOnFinish: false,
            messageWhileWorking: 'queue',
        })
    })

    test('only changed values go to an account that has none saved', () => {
        expect(changedPreferences({ ...BASE_PREFERENCES })).toEqual({})
        expect(
            changedPreferences({ ...BASE_PREFERENCES, sendKey: 'mod-enter', soundOnFinish: true })
        ).toEqual({ sendKey: 'mod-enter', soundOnFinish: true })
    })
})
