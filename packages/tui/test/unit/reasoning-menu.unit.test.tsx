import { describe, expect, it, mock } from 'bun:test'
import { render } from 'ink-testing-library'
import React from 'react'

import { ReasoningMenu } from '../../src/components/menus/reasoning-menu'

describe('ReasoningMenu Component (Unit)', () => {
    it('renders the 5 reasoning levels and model in header', () => {
        const { lastFrame } = render(
            <ReasoningMenu
                activeModel="claude-3-7-sonnet"
                settingsThinkingLevel="medium"
                handleReasoningSelect={mock(() => {})}
            />
        )

        const frame = lastFrame() || ''
        expect(frame).toContain('Reasoning')
        expect(frame).toContain('claude-3-7-sonnet')
        expect(frame).toContain('Auto')
        expect(frame).toContain('Off')
        expect(frame).toContain('Low')
        expect(frame).toContain('Medium')
        expect(frame).toContain('High')
        expect(frame).toContain('(Current)')
    })

    it('selects option and calls handleReasoningSelect on Enter', async () => {
        const handleSelect = mock(() => {})
        const { stdin } = render(
            <ReasoningMenu
                activeModel="gemini-3.8-flash"
                settingsThinkingLevel="auto"
                handleReasoningSelect={handleSelect}
            />
        )

        // Press Enter on the initially selected 'Auto'
        stdin.write('\r')
        await new Promise((resolve) => setTimeout(resolve, 20))
        expect(handleSelect).toHaveBeenCalledWith('auto')
    })

    it('navigates with arrow keys and selects', async () => {
        let selectedValue: string | null = null
        const handleSelect = (val: any) => {
            selectedValue = val
        }
        const { stdin } = render(
            <ReasoningMenu
                activeModel="gemini-3.8-flash"
                settingsThinkingLevel="auto"
                handleReasoningSelect={handleSelect}
            />
        )

        // Down arrow to 'Off'
        stdin.write('\u001B[B')
        await new Promise((resolve) => setTimeout(resolve, 20))

        stdin.write('\r')
        await new Promise((resolve) => setTimeout(resolve, 20))
        expect(selectedValue).toBe('off')
    })

    it('cancels and calls setAuthMode on Escape', async () => {
        let currentAuthMode = 'reasoning_select'
        const { stdin } = render(
            <ReasoningMenu
                activeModel="claude-3-7-sonnet"
                settingsThinkingLevel="high"
                setAuthMode={(mode) => {
                    currentAuthMode = mode
                }}
                previousAuthMode="settings_main"
            />
        )

        stdin.write('\u001B')
        await new Promise((resolve) => setTimeout(resolve, 20))
        expect(currentAuthMode).toBe('settings_main')
    })
})
