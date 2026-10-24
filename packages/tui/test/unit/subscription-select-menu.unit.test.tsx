import { describe, it, expect, mock } from 'bun:test'
import { render } from 'ink-testing-library'
import React from 'react'

import {
    SubscriptionSelectMenu,
    SUBSCRIPTION_MENU_ITEMS,
} from '../../src/components/menus/subscription-select-menu'
import { KeyboardLayerProvider } from '../../src/providers/keyboard-layer'

describe('SubscriptionSelectMenu Component (Unit)', () => {
    it('has 4 subscription items', () => {
        expect(SUBSCRIPTION_MENU_ITEMS.length).toBe(4)
        expect(SUBSCRIPTION_MENU_ITEMS[0].value).toBe('claude')
        expect(SUBSCRIPTION_MENU_ITEMS[1].value).toBe('copilot')
        expect(SUBSCRIPTION_MENU_ITEMS[2].value).toBe('gemini')
        expect(SUBSCRIPTION_MENU_ITEMS[3].value).toBe('codex')
    })

    it('renders all subscriptions', () => {
        const handleSelect = mock(() => {})
        const { lastFrame } = render(
            <KeyboardLayerProvider>
                <SubscriptionSelectMenu handleSubscriptionSelect={handleSelect} />
            </KeyboardLayerProvider>
        )

        const frame = lastFrame() || ''
        expect(frame).toContain('Subscriptions')
        expect(frame).toContain('Anthropic (Claude)')
        expect(frame).not.toContain('[detected locally]')
        expect(frame).toContain('GitHub (Copilot)')
        expect(frame).toContain('Google (Antigravity)')
        expect(frame).toContain('OpenAI (ChatGPT)')
        expect(frame).not.toContain('Requires Claude Pro or Max')
        expect(frame).not.toContain('Requires active Copilot plan')
        expect(frame).not.toContain('Requires Gemini Advanced / Antigravity')
        expect(frame).not.toContain('Requires ChatGPT Plus / Pro')
    })

    it('navigates with arrows and selects subscription', async () => {
        let selectedItem: any = null
        const handleSelect = (item: any) => {
            selectedItem = item
        }

        const { stdin, lastFrame } = render(
            <KeyboardLayerProvider>
                <SubscriptionSelectMenu handleSubscriptionSelect={handleSelect} />
            </KeyboardLayerProvider>
        )

        expect(lastFrame()).toContain('❭ Anthropic (Claude)')

        // Down arrow to GitHub
        stdin.write('\u001B[B')
        await new Promise((resolve) => setTimeout(resolve, 10))

        expect(lastFrame()).toContain('❭ GitHub (Copilot)')

        // Press Enter
        stdin.write('\r')
        await new Promise((resolve) => setTimeout(resolve, 10))

        expect(selectedItem).toBeDefined()
        expect(selectedItem?.value).toBe('copilot')
    })

    it('renders search prompt and Search in footer initially', () => {
        const { lastFrame } = render(
            <KeyboardLayerProvider>
                <SubscriptionSelectMenu handleSubscriptionSelect={mock()} />
            </KeyboardLayerProvider>
        )
        const frame = lastFrame() || ''
        expect(frame).toContain('Search:')
        expect(frame).toContain('[/ to filter]')
        expect(frame).toContain('Search')
    })

    it('activates search mode on / and filters subscriptions live', async () => {
        const { lastFrame, stdin } = render(
            <KeyboardLayerProvider>
                <SubscriptionSelectMenu handleSubscriptionSelect={mock()} />
            </KeyboardLayerProvider>
        )

        // Press '/' to enter search mode
        stdin.write('/')
        await new Promise((r) => setTimeout(r, 50))

        // Type query 'copilot'
        stdin.write('copilot')
        await new Promise((r) => setTimeout(r, 50))

        const output = lastFrame() || ''
        expect(output).toContain('GitHub (Copilot)')
        expect(output).not.toContain('Anthropic (Claude)')
        expect(output).toContain('focus list')
        expect(output).toContain('exit search')
    })

    it('activates search mode on s and filters subscriptions live', async () => {
        const { lastFrame, stdin } = render(
            <KeyboardLayerProvider>
                <SubscriptionSelectMenu handleSubscriptionSelect={mock()} />
            </KeyboardLayerProvider>
        )

        // Press 's' to enter search mode
        stdin.write('s')
        await new Promise((r) => setTimeout(r, 50))

        // Type query 'claude'
        stdin.write('claude')
        await new Promise((r) => setTimeout(r, 50))

        const output = lastFrame() || ''
        expect(output).toContain('Anthropic (Claude)')
        expect(output).not.toContain('GitHub (Copilot)')
    })

    it('exits search mode on escape without closing the menu', async () => {
        const setAuthMode = mock()
        const { lastFrame, stdin } = render(
            <KeyboardLayerProvider>
                <SubscriptionSelectMenu
                    handleSubscriptionSelect={mock()}
                    setAuthMode={setAuthMode}
                />
            </KeyboardLayerProvider>
        )

        // Enter search mode
        stdin.write('/')
        await new Promise((r) => setTimeout(r, 50))

        // Type filter query
        stdin.write('copilot')
        await new Promise((r) => setTimeout(r, 50))

        // Press Escape - should exit search mode, NOT close the menu
        stdin.write('\x1B')
        await new Promise((r) => setTimeout(r, 50))

        const output = lastFrame() || ''
        expect(output).toContain('GitHub (Copilot)')
        expect(output).toContain('[/ to filter]')
        expect(setAuthMode).not.toHaveBeenCalled()
    })

    it('clears query on escape when in navigation mode with filter, and closes on next escape', async () => {
        const setAuthMode = mock()
        const { lastFrame, stdin } = render(
            <KeyboardLayerProvider>
                <SubscriptionSelectMenu
                    handleSubscriptionSelect={mock()}
                    setAuthMode={setAuthMode}
                />
            </KeyboardLayerProvider>
        )

        // Enter search mode, type query, and exit search mode with Enter
        stdin.write('/')
        await new Promise((r) => setTimeout(r, 50))
        stdin.write('copilot')
        await new Promise((r) => setTimeout(r, 50))
        stdin.write('\r')
        await new Promise((r) => setTimeout(r, 50))

        // First escape: clears search query
        stdin.write('\x1B')
        await new Promise((r) => setTimeout(r, 50))

        const output = lastFrame() || ''
        expect(output).toContain('Anthropic (Claude)')
        expect(output).toContain('GitHub (Copilot)')
        expect(setAuthMode).not.toHaveBeenCalled()

        // Second escape: goes back to auth menu
        stdin.write('\x1B')
        await new Promise((r) => setTimeout(r, 50))
        expect(setAuthMode).toHaveBeenCalledWith('menu')
    })

    it('selects filtered subscription on enter in navigation mode', async () => {
        let selectedItem: any = null
        const handleSelect = (item: any) => {
            selectedItem = item
        }

        const { stdin } = render(
            <KeyboardLayerProvider>
                <SubscriptionSelectMenu handleSubscriptionSelect={handleSelect} />
            </KeyboardLayerProvider>
        )

        // Search for 'codex'
        stdin.write('/')
        await new Promise((r) => setTimeout(r, 50))
        stdin.write('codex')
        await new Promise((r) => setTimeout(r, 50))

        // Press enter to focus list
        stdin.write('\r')
        await new Promise((r) => setTimeout(r, 50))

        // Press enter to select
        stdin.write('\r')
        await new Promise((r) => setTimeout(r, 50))

        expect(selectedItem).toBeDefined()
        expect(selectedItem?.value).toBe('codex')
    })

    it('renders "No providers found." when filter matches nothing', async () => {
        const { lastFrame, stdin } = render(
            <KeyboardLayerProvider>
                <SubscriptionSelectMenu handleSubscriptionSelect={mock()} />
            </KeyboardLayerProvider>
        )

        stdin.write('/')
        await new Promise((r) => setTimeout(r, 50))
        stdin.write('unknown')
        await new Promise((r) => setTimeout(r, 50))

        const output = lastFrame() || ''
        expect(output).toContain('No providers found.')
    })

    it('navigates with mouse wheel down and mouse wheel up', async () => {
        const { stdin, lastFrame } = render(
            <KeyboardLayerProvider>
                <SubscriptionSelectMenu handleSubscriptionSelect={mock()} />
            </KeyboardLayerProvider>
        )

        expect(lastFrame()).toContain('❭ Anthropic (Claude)')

        // Mouse wheel down: \u001B[<65;10;10M
        stdin.write('\u001B[<65;10;10M')
        await new Promise((resolve) => setTimeout(resolve, 20))

        expect(lastFrame()).toContain('❭ GitHub (Copilot)')

        // Mouse wheel up: \u001B[<64;10;10M
        stdin.write('\u001B[<64;10;10M')
        await new Promise((resolve) => setTimeout(resolve, 20))

        expect(lastFrame()).toContain('❭ Anthropic (Claude)')
    })

    it('prompts to switch account when credentials detected and handles y (forceLogin)', async () => {
        let selectedItem: any = null
        const handleSelect = (item: any) => {
            selectedItem = item
        }

        const { stdin, lastFrame } = render(
            <KeyboardLayerProvider>
                <SubscriptionSelectMenu
                    handleSubscriptionSelect={handleSelect}
                    detectedSubscriptions={['claude']}
                />
            </KeyboardLayerProvider>
        )

        // Select Claude on index 0
        stdin.write('\r')
        await new Promise((r) => setTimeout(r, 50))

        const frame = lastFrame() || ''
        expect(frame).toContain('Existing credentials detected for Anthropic (Claude)')
        expect(frame).toContain('Do you want to switch to a different account? (y/n)')

        // Press 'y' to switch account
        stdin.write('y')
        await new Promise((r) => setTimeout(r, 50))

        expect(selectedItem).toBeDefined()
        expect(selectedItem.value).toBe('claude')
        expect(selectedItem.forceLogin).toBe(true)
    })

    it('prompts to switch account when credentials detected and handles n (keep current)', async () => {
        let selectedItem: any = null
        const handleSelect = (item: any) => {
            selectedItem = item
        }

        const { stdin, lastFrame } = render(
            <KeyboardLayerProvider>
                <SubscriptionSelectMenu
                    handleSubscriptionSelect={handleSelect}
                    detectedSubscriptions={['claude']}
                />
            </KeyboardLayerProvider>
        )

        // Select Claude on index 0
        stdin.write('\r')
        await new Promise((r) => setTimeout(r, 50))

        const frame = lastFrame() || ''
        expect(frame).toContain('Do you want to switch to a different account? (y/n)')

        // Press 'n' to keep current
        stdin.write('n')
        await new Promise((r) => setTimeout(r, 50))

        expect(selectedItem).toBeDefined()
        expect(selectedItem.value).toBe('claude')
        expect(selectedItem.forceLogin).toBeUndefined()
    })

    it('cancels switch prompt on escape in SubscriptionSelectMenu', async () => {
        let selectedItem: any = null
        const handleSelect = (item: any) => {
            selectedItem = item
        }

        const { stdin, lastFrame } = render(
            <KeyboardLayerProvider>
                <SubscriptionSelectMenu
                    handleSubscriptionSelect={handleSelect}
                    detectedSubscriptions={['claude']}
                />
            </KeyboardLayerProvider>
        )

        // Select Claude on index 0
        stdin.write('\r')
        await new Promise((r) => setTimeout(r, 50))

        expect(lastFrame()).toContain('Do you want to switch to a different account? (y/n)')

        // Press escape
        stdin.write('\u001B')
        await new Promise((r) => setTimeout(r, 50))

        // Back to menu list
        expect(lastFrame()).toContain('❭ Anthropic (Claude)')
        expect(selectedItem).toBeNull()
    })

    it('bypasses switch prompt when subscription is in unlinkedSubscriptions in SubscriptionSelectMenu', async () => {
        let selectedItem: any = null
        const handleSelect = (item: any) => {
            selectedItem = item
        }

        const { stdin, lastFrame } = render(
            <KeyboardLayerProvider>
                <SubscriptionSelectMenu
                    handleSubscriptionSelect={handleSelect}
                    detectedSubscriptions={['claude']}
                    unlinkedSubscriptions={['claude']}
                />
            </KeyboardLayerProvider>
        )

        // Select Claude on index 0
        stdin.write('\r')
        await new Promise((r) => setTimeout(r, 50))

        // Should not show confirmation prompt
        const frame = lastFrame() || ''
        expect(frame).not.toContain('Do you want to switch to a different account? (y/n)')

        // Directly triggers select
        expect(selectedItem).toBeDefined()
        expect(selectedItem.value).toBe('claude')
        expect(selectedItem.forceLogin).toBeUndefined()
    })
})
