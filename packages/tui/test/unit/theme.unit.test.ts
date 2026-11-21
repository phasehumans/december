import { describe, it, expect } from 'bun:test'

import { THEME, COLORS } from '../../src/theme'

describe('THEME Contract (Unit)', () => {
    it('exports required semantic color tokens', () => {
        expect(THEME.colors.brand).toBe('#89B4F8')
        expect(THEME.colors.text).toBe('#E4E4E7')
        expect(THEME.colors.muted).toBe('#A1A1AA')
        expect(THEME.colors.dim).toBe('#71717A')
        expect(THEME.colors.border).toBe('#3F3F46')
        expect(THEME.colors.surface).toBe('#262629')
        expect(THEME.colors.highlight).toBe('#FFFFFF')
        expect(THEME.colors.success).toBe('#6EE7B7')
        expect(THEME.colors.error).toBe('#F87171')
        expect(THEME.colors.warning).toBe('#FDD663')
    })

    it('exports standardized horizontal padding token', () => {
        expect(THEME.padding.paddingX).toBe(2)
        expect(THEME.padding.paddingLeft).toBe(2)
        expect(THEME.padding.paddingRight).toBe(4)
    })

    it('exports unified glyph definitions', () => {
        expect(THEME.glyphs.prompt).toBe('❭')
        expect(THEME.glyphs.selector).toBe('❭')
        expect(THEME.glyphs.bullet).toBe('•')
        expect(THEME.glyphs.status).toBe('●')
        expect(THEME.glyphs.step).toBe('●')
        expect(THEME.glyphs.result).toBe('└')
    })

    it('provides backwards-compatible COLORS object mapped to semantic colors', () => {
        expect(COLORS.brand).toBe('#89B4F8')
        expect(COLORS.success).toBe('#6EE7B7')
        expect(COLORS.error).toBe('#F87171')
        expect(COLORS.border).toBe('#3F3F46')
    })
})
