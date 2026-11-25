import { describe, expect, test } from 'bun:test'

import { ApiError } from '../src/shared/api/client'
import { apiErrorMessage } from '../src/shared/lib/apiErrorMessage'
import { formatCredit, formatTokenCount, formatUsd } from '../src/shared/lib/format'

// review D10: one helper for each format, in place of the copies in the components
describe('shared formats', () => {
    test('formatUsd always shows the cents', () => {
        expect(formatUsd(0)).toBe('$0.00')
        expect(formatUsd(1250)).toBe('$12.50')
        expect(formatUsd(500)).toBe('$5.00')
    })

    test('formatCredit shows cents only when the amount has them', () => {
        expect(formatCredit(500)).toBe('$5')
        expect(formatCredit(250)).toBe('$2.50')
    })

    test('formatTokenCount is short', () => {
        expect(formatTokenCount(512)).toBe('512')
        expect(formatTokenCount(84_000)).toBe('84k')
        expect(formatTokenCount(1_230_000)).toBe('1.2M')
    })

    test('formatTokenCount with precise keeps more of the number, for the Usage page', () => {
        expect(formatTokenCount(5_321, { precise: true })).toBe('5,321')
        expect(formatTokenCount(84_000, { precise: true })).toBe('84k')
        expect(formatTokenCount(1_234_567, { precise: true })).toBe('1.23M')
    })
})

describe('apiErrorMessage', () => {
    test('the message of the server, or the fallback', () => {
        expect(apiErrorMessage(new ApiError('this email is already invited', 409), 'Failed.')).toBe(
            'This email is already invited'
        )
        expect(apiErrorMessage(new ApiError('Validation failed', 400), 'Failed.')).toBe('Failed.')
        expect(apiErrorMessage(new Error('socket hang up'), 'Failed.')).toBe('Failed.')
    })

    test('the first field error, as a sentence', () => {
        const error = new ApiError('Validation failed', 400, { email: ['enter a valid email'] })
        expect(apiErrorMessage(error, 'Failed.')).toBe('Enter a valid email')
    })
})
