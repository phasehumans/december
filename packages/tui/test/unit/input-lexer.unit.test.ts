import { describe, expect, it } from 'bun:test'

import { splitInputSequences } from '../../src/renderer/input-lexer'

describe('Input Lexer (splitInputSequences)', () => {
    it('returns empty array for empty input', () => {
        expect(splitInputSequences('')).toEqual([])
    })

    it('returns single normal character or text chunk unchanged', () => {
        expect(splitInputSequences('a')).toEqual(['a'])
        expect(splitInputSequences('hello world')).toEqual(['hello world'])
    })

    it('splits multiple concatenated SGR mouse wheel events', () => {
        const chunk = '\x1b[<64;50;20M\x1b[<64;50;20M\x1b[<64;50;20M'
        expect(splitInputSequences(chunk)).toEqual([
            '\x1b[<64;50;20M',
            '\x1b[<64;50;20M',
            '\x1b[<64;50;20M',
        ])
    })

    it('splits alternating SGR mouse wheel up and down events', () => {
        const chunk = '\x1b[<64;10;5M\x1b[<65;10;5M'
        expect(splitInputSequences(chunk)).toEqual(['\x1b[<64;10;5M', '\x1b[<65;10;5M'])
    })

    it('splits multiple cursor arrow escape sequences', () => {
        const chunk = '\x1b[A\x1b[A\x1b[A'
        expect(splitInputSequences(chunk)).toEqual(['\x1b[A', '\x1b[A', '\x1b[A'])
    })

    it('handles mixed control characters and escape sequences', () => {
        const chunk = '\x03\x1b[B\r'
        expect(splitInputSequences(chunk)).toEqual(['\x03', '\x1b[B', '\r'])
    })

    it('handles lone Escape key', () => {
        expect(splitInputSequences('\x1b')).toEqual(['\x1b'])
    })

    it('handles SS3 sequences (e.g. \\x1bOA)', () => {
        const chunk = '\x1bOA\x1bOB'
        expect(splitInputSequences(chunk)).toEqual(['\x1bOA', '\x1bOB'])
    })

    it('handles modified arrow keys (e.g. \\x1b[1;2A, \\x1b[1;5B)', () => {
        const chunk = '\x1b[1;2A\x1b[1;5B'
        expect(splitInputSequences(chunk)).toEqual(['\x1b[1;2A', '\x1b[1;5B'])
    })
})
