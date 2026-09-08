import { describe, it, expect, mock } from 'bun:test'
import { render } from 'ink-testing-library'
import React from 'react'

import { SwitchSelectMenu } from '../../src/components/menus/switch-select-menu'
import { KeyboardLayerProvider } from '../../src/providers/keyboard-layer'

describe('SwitchSelectMenu Component (Unit)', () => {
    it('renders list of switch items with models and active state', () => {
        const handleSelect = mock(() => {})
        const items = [
            {
                label: 'Claude (Subscription)',
                value: 'subscription:claude',
                model: 'claude-3-7-sonnet',
                isActive: true,
            },
            {
                label: 'OpenAI',
                value: 'provider:openai',
                model: 'gpt-4o',
                isActive: false,
            },
            {
                label: 'December (Cloud Wallet)',
                value: 'decemberToken',
                model: 'auto',
                isActive: false,
            },
        ]

        const { lastFrame } = render(
            <KeyboardLayerProvider>
                <SwitchSelectMenu handleSwitchSelect={handleSelect} switchItems={items} />
            </KeyboardLayerProvider>
        )

        const frame = lastFrame() || ''
        expect(frame).toContain('Select active provider:')
        expect(frame).toContain('Claude (Subscription)')
        expect(frame).toContain('(Active)')
        expect(frame).toContain('OpenAI')
        expect(frame).not.toContain('(API Key)')
        expect(frame).toContain('December (Cloud Wallet)')
        expect(frame).toContain('Switch')
        expect(frame).toContain('Cancel')
    })

    it('navigates with arrows and selects provider', async () => {
        let selectedValue: string | null = null
        const handleSelect = (val: string) => {
            selectedValue = val
        }

        const items = [
            { label: 'Claude (Subscription)', value: 'subscription:claude' },
            { label: 'OpenAI', value: 'provider:openai' },
        ]

        const { stdin, lastFrame } = render(
            <KeyboardLayerProvider>
                <SwitchSelectMenu handleSwitchSelect={handleSelect} switchItems={items} />
            </KeyboardLayerProvider>
        )

        expect(lastFrame()).toContain('❭ Claude (Subscription)')

        // Down arrow to OpenAI
        stdin.write('\u001B[B')
        await new Promise((resolve) => setTimeout(resolve, 20))

        expect(lastFrame()).toContain('❭ OpenAI')

        // Press Enter
        stdin.write('\r')
        await new Promise((resolve) => setTimeout(resolve, 20))

        expect(selectedValue).toBe('provider:openai')
    })
})
