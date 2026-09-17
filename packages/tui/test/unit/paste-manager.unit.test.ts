import { describe, expect, it } from 'vitest'

import { storePaste, expandPastes, isPasteToken, clearPastes } from '../../src/utils/paste-manager'

describe('PasteManager', () => {
    it('creates folded token for multiline text', () => {
        clearPastes()
        const text = 'line 1\nline 2\nline 3\nline 4'
        const token = storePaste(text)
        expect(token).toBe('[Pasted 4 lines]')
        expect(isPasteToken(token)).toBe(true)
    })

    it('expands folded token back to original content', () => {
        clearPastes()
        const text = 'error line 1\nerror line 2\nerror line 3'
        const token = storePaste(text)
        const prompt = `Please fix this: ${token} now`
        const expanded = expandPastes(prompt)
        expect(expanded).toBe(`Please fix this: ${text} now`)
    })

    it('handles multiple distinct paste tokens', () => {
        clearPastes()
        const text1 = 'code block 1\nline 2\nline 3'
        const text2 = 'code block 2\nline 2\nline 3\nline 4'
        const token1 = storePaste(text1)
        const token2 = storePaste(text2)

        const prompt = `Compare ${token1} with ${token2}`
        const expanded = expandPastes(prompt)
        expect(expanded).toBe(`Compare ${text1} with ${text2}`)
    })
})
