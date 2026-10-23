import { GlobalRegistrator } from '@happy-dom/global-registrator'
import { expect, test, describe, afterEach, beforeEach, mock } from 'bun:test'
import React from 'react'

import { useAppStore } from '../src/app/store'
import { TestVerificationPanel } from '../src/features/preview/components/TestVerificationPanel'
import { sessionAPI } from '../src/features/sessions/api/session'

if (!globalThis.document) {
    GlobalRegistrator.register()
}

const { render, screen, fireEvent, cleanup, waitFor } = await import('@testing-library/react')

describe('Test-Driven Verification Dashboard (Ticket #589 - Seam 4)', () => {
    beforeEach(() => {
        useAppStore.setState({ testReport: null })
    })

    afterEach(() => {
        cleanup()
    })

    test('renders test summary metrics and pass/fail badges', () => {
        useAppStore.setState({
            testReport: {
                command: 'pytest -v',
                status: 'failed',
                summary: {
                    total: 3,
                    passed: 2,
                    failed: 1,
                    skipped: 0,
                    durationMs: 140,
                },
                tests: [
                    {
                        id: 'test-1',
                        name: 'tests/test_math.py::test_add',
                        status: 'passed',
                        durationMs: 12,
                    },
                    {
                        id: 'test-2',
                        name: 'tests/test_math.py::test_subtract',
                        status: 'passed',
                        durationMs: 18,
                    },
                    {
                        id: 'test-3',
                        name: 'tests/test_math.py::test_divide_by_zero',
                        status: 'failed',
                        failureMessage: 'ZeroDivisionError: division by zero',
                        stackTrace: 'tests/test_math.py:14: ZeroDivisionError',
                    },
                ],
                rawOutput: '=== 1 failed, 2 passed in 0.14s ===',
                executedAt: new Date().toISOString(),
            },
        })

        render(<TestVerificationPanel sessionId="sess-test-1" />)

        expect(screen.getByText('Test Verification')).not.toBeNull()
        expect(screen.getByText('pytest -v')).not.toBeNull()
        expect(screen.getAllByText(/FAILED/i).length).toBeGreaterThan(0)

        // Counts
        expect(screen.getByText('3')).not.toBeNull() // Total
        expect(screen.getByText('2')).not.toBeNull() // Passed
        expect(screen.getByText('1')).not.toBeNull() // Failed

        // Test names
        expect(screen.getByText('tests/test_math.py::test_add')).not.toBeNull()
        expect(screen.getByText('tests/test_math.py::test_divide_by_zero')).not.toBeNull()
    })

    test('expands failing test to reveal assertion failure and stack trace', () => {
        useAppStore.setState({
            testReport: {
                command: 'bun test',
                status: 'failed',
                summary: { total: 1, passed: 0, failed: 1, skipped: 0 },
                tests: [
                    {
                        id: 't-1',
                        name: 'auth > rejects invalid token',
                        status: 'failed',
                        failureMessage: 'AssertionError: expected 401 to be 403',
                        stackTrace: 'at /workspace/test/auth.test.ts:32:18',
                    },
                ],
                rawOutput: 'FAIL auth.test.ts',
                executedAt: new Date().toISOString(),
            },
        })

        render(<TestVerificationPanel sessionId="sess-test-2" />)

        expect(screen.getByText('AssertionError: expected 401 to be 403')).not.toBeNull()
        expect(screen.getByText(/auth\.test\.ts:32:18/)).not.toBeNull()
    })

    test('filters tests by status when clicking filter pills', () => {
        useAppStore.setState({
            testReport: {
                command: 'cargo test',
                status: 'failed',
                summary: { total: 2, passed: 1, failed: 1, skipped: 0 },
                tests: [
                    { id: 'c-1', name: 'tests::test_pass', status: 'passed' },
                    {
                        id: 'c-2',
                        name: 'tests::test_fail',
                        status: 'failed',
                        failureMessage: 'panic',
                    },
                ],
                rawOutput: 'test result: FAILED',
                executedAt: new Date().toISOString(),
            },
        })

        render(<TestVerificationPanel sessionId="sess-test-3" />)

        expect(screen.getByText('tests::test_pass')).not.toBeNull()
        expect(screen.getByText('tests::test_fail')).not.toBeNull()

        // Click Failed filter
        const failedFilterBtn = screen.getByRole('button', { name: /Failed \(1\)/i })
        fireEvent.click(failedFilterBtn)

        expect(screen.queryByText('tests::test_pass')).toBeNull()
        expect(screen.getByText('tests::test_fail')).not.toBeNull()
    })

    test('fetches tests on mount when store is null', async () => {
        sessionAPI.getSessionTests = mock(async () => ({
            command: 'npm test',
            status: 'passed' as const,
            summary: { total: 1, passed: 1, failed: 0, skipped: 0 },
            tests: [{ id: 'n-1', name: 'app renders', status: 'passed' as const }],
            rawOutput: '1 passed',
            executedAt: new Date().toISOString(),
        }))

        render(<TestVerificationPanel sessionId="sess-fetch" />)

        await waitFor(() => {
            expect(sessionAPI.getSessionTests).toHaveBeenCalledWith('sess-fetch')
            expect(screen.getByText('app renders')).not.toBeNull()
        })
    })
})
