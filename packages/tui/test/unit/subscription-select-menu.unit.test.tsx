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
        expect(frame).toContain('Select AI Subscription Provider:')
        expect(frame).toContain('Anthropic (Claude)')
        expect(frame).not.toContain('[detected locally]')
        expect(frame).toContain('GitHub (Copilot)')
        expect(frame).toContain('Google (Gemini / Antigravity)')
        expect(frame).not.toContain('[connect]')
        expect(frame).toContain('OpenAI (ChatGPT)')
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
        expect(output).toContain('Focus List')
        expect(output).toContain('Exit Search')
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
})
