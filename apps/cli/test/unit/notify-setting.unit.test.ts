import { describe, expect, it } from 'bun:test'

import { buildSettingsFromConfig } from '../../src/settings-menu'

import type { DecemberConfig } from '../../src/config'

const notifyRow = (cfg: Partial<DecemberConfig>) =>
    buildSettingsFromConfig({ providers: {}, ...cfg }).find((row) => row.id === 'notify')

describe('notify setting (#617)', () => {
    it('is the last /settings row and is off when not set', () => {
        const rows = buildSettingsFromConfig({ providers: {} })
        expect(rows.at(-1)).toEqual({ id: 'notify', title: 'Notify me', value: 'off' })
    })

    it('shows the saved mode', () => {
        expect(notifyRow({ notify: 'bell' })?.value).toBe('bell')
        expect(notifyRow({ notify: 'desktop' })?.value).toBe('desktop')
    })

    it('shows off for an unknown value', () => {
        expect(notifyRow({ notify: 'loud' as any })?.value).toBe('off')
    })
})
