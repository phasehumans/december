import { describe, it, expect, mock } from 'bun:test'
import { render } from 'ink-testing-library'
import React from 'react'

import { MenuMenu } from '../../src/components/menus/menu-menu'
import { KeyboardLayerProvider } from '../../src/providers/keyboard-layer'

describe('MenuMenu Component (Unit)', () => {
    it('renders both authentication method options (Use your own Key or Subscription, Login via December)', () => {
        const { lastFrame } = render(
            <KeyboardLayerProvider>
                <MenuMenu />
            </KeyboardLayerProvider>
        )

        const frame = lastFrame() || ''
        expect(frame).toContain('Authentication')
        expect(frame).toContain('Use your own Key or Subscription')
        expect(frame).not.toContain('Use AI Subscription')
        expect(frame).toContain('Login via December')
    })

    it('navigates with arrows and selects option', async () => {
        let selectedItem: any = null
        const handleSelect = (item: any) => {
            selectedItem = item
        }

        const { stdin, lastFrame } = render(
            <KeyboardLayerProvider>
                <MenuMenu handleAuthMenuSelect={handleSelect} />
            </KeyboardLayerProvider>
        )

        expect(lastFrame()).toContain('❭ Use your own Key or Subscription')

        // Down arrow to Login via December
        stdin.write('\u001B[B')
        await new Promise((resolve) => setTimeout(resolve, 10))

        expect(lastFrame()).toContain('❭ Login via December')

        // Press Enter
        stdin.write('\r')
        await new Promise((resolve) => setTimeout(resolve, 10))

        expect(selectedItem).toBeDefined()
        expect(selectedItem?.value).toBe('december')
    })

    it('cancels menu on pressing escape key', async () => {
        const setAuthMode = mock(() => {})
        const { stdin } = render(
            <KeyboardLayerProvider>
                <MenuMenu setAuthMode={setAuthMode} />
            </KeyboardLayerProvider>
        )

        stdin.write('\x1B')
        await new Promise((resolve) => setTimeout(resolve, 50))

        expect(setAuthMode).toHaveBeenCalledWith('none')
    })

    it('renders logged in label when user is already authenticated with December', () => {
        const { lastFrame } = render(
            <KeyboardLayerProvider>
                <MenuMenu
                    isAuthenticated={true}
                    currentEmail="dev.chaitanyasonawane@gmail.com"
                    authMethod="december"
                />
            </KeyboardLayerProvider>
        )

        const frame = lastFrame() || ''
        expect(frame).toContain('Login via December (Logged in as dev.chaitanyasonawane@gmail.com)')
    })

    it('prompts confirmation when selecting December while already logged in and cancels on n', async () => {
        let selectedItem: any = null
        const handleSelect = (item: any) => {
            selectedItem = item
        }
        const setAuthMode = mock(() => {})
        const addToast = mock(() => {})

        const { stdin, lastFrame } = render(
            <KeyboardLayerProvider>
                <MenuMenu
                    isAuthenticated={true}
                    currentEmail="dev.chaitanyasonawane@gmail.com"
                    authMethod="december"
                    handleAuthMenuSelect={handleSelect}
                    setAuthMode={setAuthMode}
                    addToast={addToast}
                />
            </KeyboardLayerProvider>
        )

        // Down arrow to December
        stdin.write('\u001B[B')
        await new Promise((resolve) => setTimeout(resolve, 10))

        // Press Enter
        stdin.write('\r')
        await new Promise((resolve) => setTimeout(resolve, 10))

        // Should NOT have called handleSelect yet; should render confirmation
        expect(selectedItem).toBeNull()
        const frame = lastFrame() || ''
        expect(frame).toContain('You are already logged in as dev.chaitanyasonawane@gmail.com.')
        expect(frame).toContain('Do you want to switch to a different account? (y/n)')

        // Press 'n' to cancel
        stdin.write('n')
        await new Promise((resolve) => setTimeout(resolve, 10))

        expect(setAuthMode).toHaveBeenCalledWith('none')
        expect(addToast).toHaveBeenCalledWith(
            'Already logged in as dev.chaitanyasonawane@gmail.com.',
            'info'
        )
        expect(selectedItem).toBeNull()
    })

    it('confirms account switch and invokes handleSelect with force: true on y', async () => {
        let selectedItem: any = null
        const handleSelect = (item: any) => {
            selectedItem = item
        }
        const setAuthMode = mock(() => {})
        const addToast = mock(() => {})

        const { stdin, lastFrame } = render(
            <KeyboardLayerProvider>
                <MenuMenu
                    isAuthenticated={true}
                    currentEmail="dev.chaitanyasonawane@gmail.com"
                    authMethod="december"
                    handleAuthMenuSelect={handleSelect}
                    setAuthMode={setAuthMode}
                    addToast={addToast}
                />
            </KeyboardLayerProvider>
        )

        // Down arrow to December
        stdin.write('\u001B[B')
        await new Promise((resolve) => setTimeout(resolve, 10))

        // Press Enter
        stdin.write('\r')
        await new Promise((resolve) => setTimeout(resolve, 10))

        expect(lastFrame()).toContain('Do you want to switch to a different account? (y/n)')

        // Press 'y' to confirm
        stdin.write('y')
        await new Promise((resolve) => setTimeout(resolve, 10))

        expect(selectedItem).toBeDefined()
        expect(selectedItem?.value).toBe('december')
        expect(selectedItem?.force).toBe(true)
    })

    it('renders logged in label when active authMethod is subscription but December account is linked (hasDecember: true)', () => {
        const { lastFrame } = render(
            <KeyboardLayerProvider>
                <MenuMenu
                    isAuthenticated={true}
                    currentEmail="phasehumans@gmail.com"
                    authMethod="subscription"
                    hasDecember={true}
                    decemberEmail="dev.chaitanyasonawane@gmail.com"
                />
            </KeyboardLayerProvider>
        )

        const frame = lastFrame() || ''
        expect(frame).toContain('Login via December (Logged in as dev.chaitanyasonawane@gmail.com)')
    })

    it('renders unlinked label and selects December without confirmation when on subscription and hasDecember is false', async () => {
        let selectedItem: any = null
        const handleSelect = (item: any) => {
            selectedItem = item
        }

        const { stdin, lastFrame } = render(
            <KeyboardLayerProvider>
                <MenuMenu
                    isAuthenticated={true}
                    currentEmail="phasehumans@gmail.com"
                    authMethod="subscription"
                    hasDecember={false}
                    handleAuthMenuSelect={handleSelect}
                />
            </KeyboardLayerProvider>
        )

        const frame = lastFrame() || ''
        expect(frame).toContain('Login via December')
        expect(frame).not.toContain('(Logged in')

        // Down arrow to December
        stdin.write('\u001B[B')
        await new Promise((resolve) => setTimeout(resolve, 10))

        // Press Enter
        stdin.write('\r')
        await new Promise((resolve) => setTimeout(resolve, 10))

        // Should directly call handleSelect without switch confirmation
        expect(selectedItem).toBeDefined()
        expect(selectedItem?.value).toBe('december')
        expect(selectedItem?.force).toBeUndefined()
    })
})
