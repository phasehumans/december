import { supportsModelThinking } from '@december/providers'
import { describe, it, expect, beforeEach } from 'bun:test'

import { useSettingsHandlers } from '../../src/hooks/use-settings-handlers'
import { useCliStore } from '../../src/store'

describe('/reasoning command and handlers (Unit)', () => {
    beforeEach(() => {
        useCliStore.setState({
            settingsThinkingLevel: 'auto',
            authMode: 'reasoning_select',
            agent: {
                thinkingLevel: 'auto',
                modelOptions: {
                    model: 'claude-3-7-sonnet',
                    thinkingLevel: 'auto',
                },
            } as any,
        })
    })

    it('updates thinking level across store, agent, and closes authMode on handleReasoningSelect', async () => {
        const { handleReasoningSelect } = useSettingsHandlers()

        await handleReasoningSelect('high')

        const state = useCliStore.getState()
        expect(state.settingsThinkingLevel).toBe('high')
        expect(state.authMode).toBe('none')
        expect(state.agent?.thinkingLevel).toBe('high')
        expect(state.agent?.modelOptions?.thinkingLevel).toBe('high')
    })

    it('correctly identifies models that support reasoning vs non-reasoning', () => {
        expect(supportsModelThinking('claude-3-7-sonnet-20250219')).toBe(true)
        expect(supportsModelThinking('gemini-3.8-flash')).toBe(true)
        expect(supportsModelThinking('o3-mini')).toBe(true)
        expect(supportsModelThinking('december-auto')).toBe(true)

        expect(supportsModelThinking('gpt-4o')).toBe(false)
        expect(supportsModelThinking('claude-3-5-sonnet')).toBe(false)
        expect(supportsModelThinking('mistral-large-latest')).toBe(false)
    })
})
