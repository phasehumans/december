import { describe, it, expect, mock } from 'bun:test'
import { render } from 'ink-testing-library'
import React from 'react'

import {
    ByokProviderMenu,
    PROVIDER_MENU_ITEMS,
} from '../../src/components/menus/byok-provider-menu'
import { KeyboardLayerProvider } from '../../src/providers/keyboard-layer'

describe('ByokProviderMenu Component (Unit)', () => {
    it('has 36 total API key and local provider items without subscriptions', () => {
        expect(PROVIDER_MENU_ITEMS.length).toBe(36)
        expect(PROVIDER_MENU_ITEMS[0].value).toBe('agentrouter')
        expect(PROVIDER_MENU_ITEMS[1].value).toBe('anthropic')
        expect(PROVIDER_MENU_ITEMS[2].value).toBe('arcee')
        expect(PROVIDER_MENU_ITEMS[3].value).toBe('cerebras')
    })

    it('renders 7 visible items with down more indicator initially', () => {
        const handleSelect = mock(() => {})
        const { lastFrame } = render(
            <KeyboardLayerProvider>
                <ByokProviderMenu handleProviderSelect={handleSelect} />
            </KeyboardLayerProvider>
        )

        const frame = lastFrame() || ''
        expect(frame).toContain('Select API Provider (BYOK):')
        expect(frame).toContain('AgentRouter')
        expect(frame).toContain('Anthropic')
        expect(frame).toContain('Arcee AI')
        expect(frame).toContain('Cerebras')
        expect(frame).toContain('Cohere')
        expect(frame).toContain('DeepSeek')
        expect(frame).toContain('Fireworks AI')
        expect(frame).toContain('↓ 29 more')
    })

    it('navigates through items with arrow keys and updates more indicators', async () => {
        let selectedItem: any = null
        const handleSelect = (item: any) => {
            selectedItem = item
        }

        const { stdin, lastFrame } = render(
            <KeyboardLayerProvider>
                <ByokProviderMenu handleProviderSelect={handleSelect} />
            </KeyboardLayerProvider>
        )

        expect(lastFrame()).toContain('❭ AgentRouter')

        // Move down 7 times to shift window
        for (let i = 0; i < 7; i++) {
            stdin.write('\u001B[B') // Down arrow
            await new Promise((resolve) => setTimeout(resolve, 10))
        }

        const frameAfterScroll = lastFrame() || ''
        expect(frameAfterScroll).toContain('↑ 1 more')
        expect(frameAfterScroll).toContain('↓ 28 more')

        // Press Enter to select current item (Google AI Studio)
        stdin.write('\r')
        await new Promise((resolve) => setTimeout(resolve, 10))
        expect(selectedItem).toBeDefined()
        expect(selectedItem?.value).toBe('google')
    })

    it('renders search prompt and Search in footer initially', () => {
        const { lastFrame } = render(
            <KeyboardLayerProvider>
                <ByokProviderMenu handleProviderSelect={mock()} />
            </KeyboardLayerProvider>
        )
        const frame = lastFrame() || ''
        expect(frame).toContain('Search:')
        expect(frame).toContain('[/ to filter]')
        expect(frame).toContain('Search')
    })

    it('activates search mode on / and filters providers live', async () => {
        const { lastFrame, stdin } = render(
            <KeyboardLayerProvider>
                <ByokProviderMenu handleProviderSelect={mock()} />
            </KeyboardLayerProvider>
        )

        // Press '/' to enter search mode
        stdin.write('/')
        await new Promise((r) => setTimeout(r, 50))

        // Type query 'groq'
        stdin.write('groq')
        await new Promise((r) => setTimeout(r, 50))

        const output = lastFrame() || ''
        expect(output).toContain('Groq')
        expect(output).not.toContain('Anthropic')
        expect(output).toContain('Focus List')
        expect(output).toContain('Exit Search')
    })

    it('activates search mode on s and filters providers live', async () => {
        const { lastFrame, stdin } = render(
            <KeyboardLayerProvider>
                <ByokProviderMenu handleProviderSelect={mock()} />
            </KeyboardLayerProvider>
        )

        // Press 's' to enter search mode
        stdin.write('s')
        await new Promise((r) => setTimeout(r, 50))

        // Type query 'cerebras'
        stdin.write('cerebras')
        await new Promise((r) => setTimeout(r, 50))

        const output = lastFrame() || ''
        expect(output).toContain('Cerebras')
        expect(output).not.toContain('Anthropic')
    })

    it('exits search mode on escape without closing the menu', async () => {
        const setAuthMode = mock()
        const { lastFrame, stdin } = render(
            <KeyboardLayerProvider>
                <ByokProviderMenu handleProviderSelect={mock()} setAuthMode={setAuthMode} />
            </KeyboardLayerProvider>
        )

        // Enter search mode
        stdin.write('/')
        await new Promise((r) => setTimeout(r, 50))

        // Type filter query
        stdin.write('groq')
        await new Promise((r) => setTimeout(r, 50))

        // Press Escape - should exit search mode, NOT close the menu
        stdin.write('\x1B')
        await new Promise((r) => setTimeout(r, 50))

        const output = lastFrame() || ''
        expect(output).toContain('Groq')
        expect(output).toContain('[/ to filter]')
        expect(setAuthMode).not.toHaveBeenCalled()
    })

    it('clears query on escape when in navigation mode with filter, and closes on next escape', async () => {
        const setAuthMode = mock()
        const { lastFrame, stdin } = render(
            <KeyboardLayerProvider>
                <ByokProviderMenu handleProviderSelect={mock()} setAuthMode={setAuthMode} />
            </KeyboardLayerProvider>
        )

        // Enter search mode, type query, and exit search mode with Enter
        stdin.write('/')
        await new Promise((r) => setTimeout(r, 50))
        stdin.write('groq')
        await new Promise((r) => setTimeout(r, 50))
        stdin.write('\r')
        await new Promise((r) => setTimeout(r, 50))

        // First escape: clears search query
        stdin.write('\x1B')
        await new Promise((r) => setTimeout(r, 50))

        const output = lastFrame() || ''
        expect(output).toContain('Anthropic')
        expect(output).toContain('AgentRouter')
        expect(setAuthMode).not.toHaveBeenCalled()

        // Second escape: goes back to auth menu
        stdin.write('\x1B')
        await new Promise((r) => setTimeout(r, 50))
        expect(setAuthMode).toHaveBeenCalledWith('menu')
    })

    it('selects filtered provider on enter in navigation mode', async () => {
        let selectedItem: any = null
        const handleSelect = (item: any) => {
            selectedItem = item
        }

        const { stdin } = render(
            <KeyboardLayerProvider>
                <ByokProviderMenu handleProviderSelect={handleSelect} />
            </KeyboardLayerProvider>
        )

        // Search for 'together'
        stdin.write('/')
        await new Promise((r) => setTimeout(r, 50))
        stdin.write('together')
        await new Promise((r) => setTimeout(r, 50))

        // Press enter to focus list
        stdin.write('\r')
        await new Promise((r) => setTimeout(r, 50))

        // Press enter to select
        stdin.write('\r')
        await new Promise((r) => setTimeout(r, 50))

        expect(selectedItem).toBeDefined()
        expect(selectedItem?.value).toBe('together')
    })

    it('selects Meta provider on enter after searching', async () => {
        let selectedItem: any = null
        const handleSelect = (item: any) => {
            selectedItem = item
        }

        const { stdin } = render(
            <KeyboardLayerProvider>
                <ByokProviderMenu handleProviderSelect={handleSelect} />
            </KeyboardLayerProvider>
        )

        // Search for 'meta'
        stdin.write('/')
        await new Promise((r) => setTimeout(r, 50))
        stdin.write('meta')
        await new Promise((r) => setTimeout(r, 50))

        // Press enter to focus list
        stdin.write('\r')
        await new Promise((r) => setTimeout(r, 50))

        // Press enter to select
        stdin.write('\r')
        await new Promise((r) => setTimeout(r, 50))

        expect(selectedItem).toBeDefined()
        expect(selectedItem?.value).toBe('meta')
        expect(selectedItem?.label).toBe('Meta')
    })

    it('selects Moonshot AI provider on enter after searching', async () => {
        let selectedItem: any = null
        const handleSelect = (item: any) => {
            selectedItem = item
        }

        const { stdin } = render(
            <KeyboardLayerProvider>
                <ByokProviderMenu handleProviderSelect={handleSelect} />
            </KeyboardLayerProvider>
        )

        // Search for 'moonshot'
        stdin.write('/')
        await new Promise((r) => setTimeout(r, 50))
        stdin.write('moonshot')
        await new Promise((r) => setTimeout(r, 50))

        // Press enter to focus list
        stdin.write('\r')
        await new Promise((r) => setTimeout(r, 50))

        // Press enter to select
        stdin.write('\r')
        await new Promise((r) => setTimeout(r, 50))

        expect(selectedItem).toBeDefined()
        expect(selectedItem?.value).toBe('moonshot')
        expect(selectedItem?.label).toBe('Moonshot AI')
    })

    it('selects Sarvam AI provider on enter after searching', async () => {
        let selectedItem: any = null
        const handleSelect = (item: any) => {
            selectedItem = item
        }

        const { stdin } = render(
            <KeyboardLayerProvider>
                <ByokProviderMenu handleProviderSelect={handleSelect} />
            </KeyboardLayerProvider>
        )

        // Search for 'sarvam'
        stdin.write('/')
        await new Promise((r) => setTimeout(r, 50))
        stdin.write('sarvam')
        await new Promise((r) => setTimeout(r, 50))

        // Press enter to focus list
        stdin.write('\r')
        await new Promise((r) => setTimeout(r, 50))

        // Press enter to select
        stdin.write('\r')
        await new Promise((r) => setTimeout(r, 50))

        expect(selectedItem).toBeDefined()
        expect(selectedItem?.value).toBe('sarvam')
        expect(selectedItem?.label).toBe('Sarvam AI')
    })

    it('selects StepFun (Global) provider on enter after searching', async () => {
        let selectedItem: any = null
        const handleSelect = (item: any) => {
            selectedItem = item
        }

        const { stdin } = render(
            <KeyboardLayerProvider>
                <ByokProviderMenu handleProviderSelect={handleSelect} />
            </KeyboardLayerProvider>
        )

        // Type / to search
        stdin.write('/')
        await new Promise((r) => setTimeout(r, 50))

        // Type 'stepfun'
        stdin.write('stepfun')
        await new Promise((r) => setTimeout(r, 50))

        // Press enter to focus list
        stdin.write('\r')
        await new Promise((r) => setTimeout(r, 50))

        // Press enter to select
        stdin.write('\r')
        await new Promise((r) => setTimeout(r, 50))

        expect(selectedItem).toBeDefined()
        expect(selectedItem?.value).toBe('stepfun')
        expect(selectedItem?.label).toBe('StepFun (Global)')
    })

    it('selects Upstage Solar provider on enter after searching', async () => {
        let selectedItem: any = null
        const handleSelect = (item: any) => {
            selectedItem = item
        }

        const { stdin } = render(
            <KeyboardLayerProvider>
                <ByokProviderMenu handleProviderSelect={handleSelect} />
            </KeyboardLayerProvider>
        )

        // Type / to search
        stdin.write('/')
        await new Promise((r) => setTimeout(r, 50))

        // Type 'upstage'
        stdin.write('upstage')
        await new Promise((r) => setTimeout(r, 50))

        // Press enter to focus list
        stdin.write('\r')
        await new Promise((r) => setTimeout(r, 50))

        // Press enter to select
        stdin.write('\r')
        await new Promise((r) => setTimeout(r, 50))

        expect(selectedItem).toBeDefined()
        expect(selectedItem?.value).toBe('upstage')
        expect(selectedItem?.label).toBe('Upstage Solar')
    })

    it('selects Thinking Machines (Tinker) provider on enter after searching', async () => {
        let selectedItem: any = null
        const handleSelect = (item: any) => {
            selectedItem = item
        }

        const { stdin } = render(
            <KeyboardLayerProvider>
                <ByokProviderMenu handleProviderSelect={handleSelect} />
            </KeyboardLayerProvider>
        )

        // Type / to search
        stdin.write('/')
        await new Promise((r) => setTimeout(r, 50))

        // Type 'thinking'
        stdin.write('thinking')
        await new Promise((r) => setTimeout(r, 50))

        // Press enter to focus list
        stdin.write('\r')
        await new Promise((r) => setTimeout(r, 50))

        // Press enter to select
        stdin.write('\r')
        await new Promise((r) => setTimeout(r, 50))

        expect(selectedItem).toBeDefined()
        expect(selectedItem?.value).toBe('thinkingmachines')
        expect(selectedItem?.label).toBe('Thinking Machines (Tinker)')
    })

    it('renders "No providers found." when filter matches nothing', async () => {
        const { lastFrame, stdin } = render(
            <KeyboardLayerProvider>
                <ByokProviderMenu handleProviderSelect={mock()} />
            </KeyboardLayerProvider>
        )

        stdin.write('/')
        await new Promise((r) => setTimeout(r, 50))
        stdin.write('zzzznotfound')
        await new Promise((r) => setTimeout(r, 50))

        const output = lastFrame() || ''
        expect(output).toContain('No providers found.')
    })
})
