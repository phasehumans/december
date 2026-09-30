import { describe, expect, it, mock } from 'bun:test'
import React from 'react'

import { ShortcutsMenu, SHORTCUTS } from '../../src/components/menus/shortcuts-menu'
import { renderWithProviders } from '../test-providers'

describe('ShortcutsMenu Component (Unit)', () => {
    it('renders all shortcuts', () => {
        const handleClose = mock()
        const { lastFrame } = renderWithProviders(<ShortcutsMenu onClose={handleClose} />)
        const frame = lastFrame()

        expect(SHORTCUTS.length).toBe(21)
        expect(frame).toContain('Open slash commands')
        expect(frame).toContain('! <cmd>')
        expect(frame).toContain('↑ / ↓')
        expect(frame).toContain('pageup / pagedown')
        expect(frame).toContain('shift + ↑ / ↓')
        expect(frame).toContain('home / end')
        expect(frame).toContain('ctrl+p')
        expect(frame).toContain('ctrl+n')
        expect(frame).toContain('ctrl+c')
        expect(frame).toContain('↓ 6 more')
    })
})
