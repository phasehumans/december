import { expect, test, describe } from 'bun:test'
import { parseErrorMessage } from '../src/utils/error-parser'

describe('error-parser', () => {
    test('extracts simple error string', () => {
        expect(parseErrorMessage('Simple error')).toBe('Simple error')
    })

    test('extracts error from standard Error object', () => {
        expect(parseErrorMessage(new Error('Standard error'))).toBe('Standard error')
    })

    test('extracts message from JSON string', () => {
        expect(parseErrorMessage('{"message": "JSON error"}')).toBe('JSON error')
        expect(parseErrorMessage('{"error": "JSON error"}')).toBe('JSON error')
        expect(parseErrorMessage('{"error": {"message": "Nested JSON error"}}')).toBe(
            'Nested JSON error'
        )
    })

    test('extracts message from complex JSON string', () => {
        const complexStr = 'Some text before {"error": {"message": "Extracted error"}} text after'
        expect(parseErrorMessage(complexStr)).toBe('Extracted error')
    })

    test('extracts from double nested JSON string', () => {
        expect(
            parseErrorMessage('{"error": "{\\"message\\": \\"Double nested JSON error\\"}"}')
        ).toBe('Double nested JSON error')
    })

    test('extracts from regex when JSON is malformed', () => {
        const malformed = 'Oops! {"message": "Malformed JSON error"' // missing closing brace
        expect(parseErrorMessage(malformed)).toBe('Malformed JSON error')
    })

    test('falls back to util.inspect for complex objects without message', () => {
        const obj = { foo: 'bar', baz: 42 }
        const parsed = parseErrorMessage(obj)
        expect(parsed).toContain("foo: 'bar'")
        expect(parsed).toContain('baz: 42')
    })

    test('cleans up [Error] prefixes', () => {
        expect(parseErrorMessage('[ModuleError]: Real error message')).toBe('Real error message')
    })

    test('handles null or undefined gracefully', () => {
        expect(parseErrorMessage(null)).toBe('null')
        expect(parseErrorMessage(undefined)).toBe('undefined')
    })
})
