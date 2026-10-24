import { describe, it, expect, mock } from 'bun:test'
import { render } from 'ink-testing-library'
import React from 'react'

import { ModelSelectMenu } from '../../src/components/menus/model-select-menu'
import { KeyboardLayerProvider } from '../../src/providers/keyboard-layer'

describe('ModelSelectMenu Component (Unit)', () => {
    const mockModels = [
        { label: 'GPT-5.6 Sol', value: 'gpt-5.6-sol' },
        { label: 'GPT-5.6 Terra', value: 'gpt-5.6-terra' },
        { label: 'GPT-5.6 Luna', value: 'gpt-5.6-luna' },
        { label: 'GPT-5.5 Pro', value: 'gpt-5.5-pro' },
        { label: 'GPT-5.5', value: 'gpt-5.5' },
        { label: 'GPT-5.4 Pro', value: 'gpt-5.4-pro' },
        { label: 'GPT-5.4 Mini', value: 'gpt-5.4-mini' },
        { label: 'o4-mini', value: 'o4-mini' },
        { label: 'o3-pro', value: 'o3-pro' },
        { label: 'o3', value: 'o3' },
    ]

    it('renders 7 visible items with down more indicator when models > 7', () => {
        const handleSelect = mock(() => {})
        const { lastFrame } = render(
            <KeyboardLayerProvider>
                <ModelSelectMenu
                    selectedProvider="openai"
                    items={mockModels}
                    handleModelSelect={handleSelect}
                />
            </KeyboardLayerProvider>
        )

        const frame = lastFrame() || ''
        expect(frame).toContain('Models')
        expect(frame).toContain('GPT-5.6 Sol')
        expect(frame).toContain('GPT-5.6 Terra')
        expect(frame).toContain('GPT-5.4 Mini')
        expect(frame).toContain('↓ 3 more')
    })

    it('navigates with arrow keys and shifts window', async () => {
        let selectedItem: any = null
        const handleSelect = (item: any) => {
            selectedItem = item
        }

        const { stdin, lastFrame } = render(
            <KeyboardLayerProvider>
                <ModelSelectMenu
                    selectedProvider="openai"
                    items={mockModels}
                    handleModelSelect={handleSelect}
                />
            </KeyboardLayerProvider>
        )

        expect(lastFrame()).toContain('❭ GPT-5.6 Sol')

        // Move down 7 times to shift window
        for (let i = 0; i < 7; i++) {
            stdin.write('\u001B[B') // Down arrow
            await new Promise((resolve) => setTimeout(resolve, 10))
        }

        const frameAfterScroll = lastFrame() || ''
        expect(frameAfterScroll).toContain('↑ 1 more')
        expect(frameAfterScroll).toContain('o4-mini')

        // Press Enter to select
        stdin.write('\r')
        await new Promise((resolve) => setTimeout(resolve, 10))
        expect(selectedItem?.value).toBe('o4-mini')
    })

    it('handles esc key to exit', async () => {
        const setAuthMode = mock()

        const { stdin } = render(
            <KeyboardLayerProvider>
                <ModelSelectMenu
                    selectedProvider="openai"
                    items={mockModels}
                    handleModelSelect={() => {}}
                    setAuthMode={setAuthMode}
                />
            </KeyboardLayerProvider>
        )

        stdin.write('\x1B') // ESC key
        await new Promise((resolve) => setTimeout(resolve, 50))
        expect(setAuthMode).toHaveBeenCalledWith('none')
    })

    it('renders search prompt and Search in footer initially', () => {
        const { lastFrame } = render(
            <KeyboardLayerProvider>
                <ModelSelectMenu
                    selectedProvider="openai"
                    items={mockModels}
                    handleModelSelect={mock()}
                />
            </KeyboardLayerProvider>
        )
        const frame = lastFrame() || ''
        expect(frame).toContain('Search:')
        expect(frame).toContain('[/ to filter]')
        expect(frame).toContain('Search')
    })

    it('activates search mode on / and filters models live', async () => {
        const { lastFrame, stdin } = render(
            <KeyboardLayerProvider>
                <ModelSelectMenu
                    selectedProvider="openai"
                    items={mockModels}
                    handleModelSelect={mock()}
                />
            </KeyboardLayerProvider>
        )

        // Press '/' to enter search mode
        stdin.write('/')
        await new Promise((r) => setTimeout(r, 50))

        // Type query 'o4'
        stdin.write('o4')
        await new Promise((r) => setTimeout(r, 50))

        const output = lastFrame() || ''
        expect(output).toContain('o4-mini')
        expect(output).not.toContain('GPT-5.6 Sol')
        expect(output).toContain('focus list')
        expect(output).toContain('exit search')
    })

    it('activates search mode on s and filters models live', async () => {
        const { lastFrame, stdin } = render(
            <KeyboardLayerProvider>
                <ModelSelectMenu
                    selectedProvider="openai"
                    items={mockModels}
                    handleModelSelect={mock()}
                />
            </KeyboardLayerProvider>
        )

        // Press 's' to enter search mode
        stdin.write('s')
        await new Promise((r) => setTimeout(r, 50))

        // Type query 'terra'
        stdin.write('terra')
        await new Promise((r) => setTimeout(r, 50))

        const output = lastFrame() || ''
        expect(output).toContain('GPT-5.6 Terra')
        expect(output).not.toContain('GPT-5.6 Sol')
    })

    it('exits search mode on escape without closing the menu', async () => {
        const setAuthMode = mock()
        const { lastFrame, stdin } = render(
            <KeyboardLayerProvider>
                <ModelSelectMenu
                    selectedProvider="openai"
                    items={mockModels}
                    handleModelSelect={mock()}
                    setAuthMode={setAuthMode}
                />
            </KeyboardLayerProvider>
        )

        // Enter search mode
        stdin.write('/')
        await new Promise((r) => setTimeout(r, 50))

        // Type filter query
        stdin.write('o4')
        await new Promise((r) => setTimeout(r, 50))

        // Press Escape - should exit search mode, NOT close the menu
        stdin.write('\x1B')
        await new Promise((r) => setTimeout(r, 50))

        const output = lastFrame() || ''
        expect(output).toContain('o4-mini')
        expect(output).toContain('[/ to filter]')
        expect(setAuthMode).not.toHaveBeenCalled()
    })

    it('clears query on escape when in navigation mode with filter, and closes on next escape', async () => {
        const setAuthMode = mock()
        const { lastFrame, stdin } = render(
            <KeyboardLayerProvider>
                <ModelSelectMenu
                    selectedProvider="openai"
                    items={mockModels}
                    handleModelSelect={mock()}
                    setAuthMode={setAuthMode}
                />
            </KeyboardLayerProvider>
        )

        // Enter search mode, type query, and exit search mode with Enter
        stdin.write('/')
        await new Promise((r) => setTimeout(r, 50))
        stdin.write('o4')
        await new Promise((r) => setTimeout(r, 50))
        stdin.write('\r')
        await new Promise((r) => setTimeout(r, 50))

        // First escape: clears search query
        stdin.write('\x1B')
        await new Promise((r) => setTimeout(r, 50))

        const output = lastFrame() || ''
        expect(output).toContain('GPT-5.6 Sol')
        expect(setAuthMode).not.toHaveBeenCalled()

        // Second escape: closes model menu
        stdin.write('\x1B')
        await new Promise((r) => setTimeout(r, 50))
        expect(setAuthMode).toHaveBeenCalledWith('none')
    })

    it('selects filtered model on enter in navigation mode', async () => {
        let selectedItem: any = null
        const handleSelect = (item: any) => {
            selectedItem = item
        }

        const { stdin } = render(
            <KeyboardLayerProvider>
                <ModelSelectMenu
                    selectedProvider="openai"
                    items={mockModels}
                    handleModelSelect={handleSelect}
                />
            </KeyboardLayerProvider>
        )

        // Search for 'o3-pro'
        stdin.write('/')
        await new Promise((r) => setTimeout(r, 50))
        stdin.write('o3-pro')
        await new Promise((r) => setTimeout(r, 50))

        // Press enter to focus list
        stdin.write('\r')
        await new Promise((r) => setTimeout(r, 50))

        // Press enter to select
        stdin.write('\r')
        await new Promise((r) => setTimeout(r, 50))

        expect(selectedItem).toBeDefined()
        expect(selectedItem?.value).toBe('o3-pro')
    })

    it('renders "No models found." when filter matches nothing', async () => {
        const { lastFrame, stdin } = render(
            <KeyboardLayerProvider>
                <ModelSelectMenu
                    selectedProvider="openai"
                    items={mockModels}
                    handleModelSelect={mock()}
                />
            </KeyboardLayerProvider>
        )

        stdin.write('/')
        await new Promise((r) => setTimeout(r, 50))
        stdin.write('unknown-model-xyz')
        await new Promise((r) => setTimeout(r, 50))

        const output = lastFrame() || ''
        expect(output).toContain('No models found.')
    })

    it('navigates with mouse wheel down and up', async () => {
        const { lastFrame, stdin } = render(
            <KeyboardLayerProvider>
                <ModelSelectMenu
                    selectedProvider="openai"
                    items={mockModels}
                    handleModelSelect={mock()}
                />
            </KeyboardLayerProvider>
        )

        expect(lastFrame()).toContain('❭ GPT-5.6 Sol')

        // Mouse wheel down
        stdin.write('\u001B[<65;10;10M')
        await new Promise((r) => setTimeout(r, 20))

        expect(lastFrame()).toContain('❭ GPT-5.6 Terra')

        // Mouse wheel up
        stdin.write('\u001B[<64;10;10M')
        await new Promise((r) => setTimeout(r, 20))

        expect(lastFrame()).toContain('❭ GPT-5.6 Sol')
    })
})
