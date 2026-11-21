import { describe, expect, it } from 'bun:test'

import { buildSettingsFromConfig } from '../../src/settings-menu'

import type { DecemberConfig } from '../../src/config'

const config = (fields: Partial<DecemberConfig> = {}): DecemberConfig => ({
    providers: {},
    ...fields,
})

const valueOf = (rows: ReturnType<typeof buildSettingsFromConfig>, id: string) =>
    rows.find((row) => row.id === id)?.value

describe('buildSettingsFromConfig', () => {
    it('shows the browser window as on when browserVisible is not set, like the runner', () => {
        expect(valueOf(buildSettingsFromConfig(config({})), 'browser_visible')).toBe('on')
        expect(
            valueOf(buildSettingsFromConfig(config({ browserVisible: true })), 'browser_visible')
        ).toBe('on')
        expect(
            valueOf(buildSettingsFromConfig(config({ browserVisible: false })), 'browser_visible')
        ).toBe('off')
    })

    it('has no follow-up row, even when an old config still sets followUpMode', () => {
        const rows = buildSettingsFromConfig(config({ followUpMode: 'one-at-a-time' }))
        expect(rows.map((row) => row.id)).not.toContain('follow_up_mode')
    })

    it('shows the runtime defaults for keys that are not set', () => {
        const rows = buildSettingsFromConfig(config({}))
        expect(valueOf(rows, 'provider')).toBe('gemini')
        expect(valueOf(rows, 'tool_permission')).toBe('always-proceed')
        expect(valueOf(rows, 'pathguard')).toBe('on')
        expect(valueOf(rows, 'non_workspace')).toBe('off')
        expect(valueOf(rows, 'thinking_level')).toBe('fast')
        expect(valueOf(rows, 'steering_mode')).toBe('all')
    })

    it('prefers the session provider over the config provider', () => {
        const rows = buildSettingsFromConfig(config({ activeProvider: 'openai' }), 'anthropic')
        expect(valueOf(rows, 'provider')).toBe('anthropic')
    })
})
