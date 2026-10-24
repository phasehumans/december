import { describe, it, expect } from 'bun:test'
import { render } from 'ink-testing-library'
import React from 'react'

import { MenuFooter } from '../../src/components/menus/menu-footer'

describe('MenuFooter Component (Unit)', () => {
    it('renders standardized navigation cues and separators', () => {
        const items = [
            { key: '↑/↓', label: 'navigate' },
            { key: 'enter', label: 'select' },
            { key: 'esc', label: 'close' },
        ]
        const { lastFrame } = render(<MenuFooter items={items} />)
        const output = lastFrame() || ''

        expect(output).toContain('↑/↓')
        expect(output).toContain('navigate')
        expect(output).toContain('·')
        expect(output).toContain('enter')
        expect(output).toContain('select')
        expect(output).toContain('esc')
        expect(output).toContain('close')
    })
})
