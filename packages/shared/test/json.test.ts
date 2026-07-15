import { describe, expect, it } from 'bun:test'
import { safeParseJson } from '../src/utils/json'

describe('safeParseJson Utility', () => {
    it('parses valid JSON', () => {
        expect(safeParseJson('{"a": 1}')).toEqual({ a: 1 })
    })

    it('returns empty object for empty string', () => {
        expect(safeParseJson('')).toEqual({})
        expect(safeParseJson('   ')).toEqual({})
    })

    it('strips markdown json blocks', () => {
        const input = '```json\n{"a": 1}\n```'
        expect(safeParseJson(input)).toEqual({ a: 1 })
    })

    it('fixes missing closing brace', () => {
        expect(safeParseJson('{"a": 1')).toEqual({ a: 1 })
    })

    it('fixes trailing comma', () => {
        expect(safeParseJson('{"a": 1,}')).toEqual({ a: 1 })
        expect(safeParseJson('{"a": 1, }')).toEqual({ a: 1 })
    })
})
