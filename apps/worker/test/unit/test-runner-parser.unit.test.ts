import { describe, expect, it } from 'bun:test'

import {
    isTestExecutionCommand,
    parseTestOutput,
    type SessionTestReport,
} from '../../src/test-runner-parser'

describe('Worker Test Runner Parser (Ticket #589 - Seam 1)', () => {
    describe('isTestExecutionCommand', () => {
        it('identifies canonical test commands across package managers and languages', () => {
            const testCommands = [
                'npm test',
                'npm run test',
                'npm test -- --watch=false',
                'pnpm test',
                'yarn test',
                'bun test',
                'bun test test/unit/example.test.ts',
                'bunx vitest run',
                'npx jest --colors',
                'pytest',
                'pytest -v tests/test_api.py',
                'python -m pytest',
                'python -m unittest discover -s tests',
                'cargo test',
                'cargo test -- --nocapture',
                'go test ./...',
                'go test -v ./pkg/...',
            ]

            for (const cmd of testCommands) {
                expect(isTestExecutionCommand(cmd)).toBe(true)
            }
        })

        it('rejects non-test commands', () => {
            const nonTestCommands = [
                'git status',
                'git checkout test-branch',
                'npm run build',
                'pnpm dev',
                'cargo build --release',
                'python main.py',
                'echo "just a test string"',
                'cat tests.txt',
            ]

            for (const cmd of nonTestCommands) {
                expect(isTestExecutionCommand(cmd)).toBe(false)
            }
        })
    })

    describe('parseTestOutput - Vitest / Jest', () => {
        it('parses passing and failing vitest/jest test suites with stack traces', () => {
            const command = 'bunx vitest run'
            const rawOutput = `
 ✓ test/auth.test.ts > authenticates valid user (12ms)
 ✗ test/auth.test.ts > rejects invalid token (45ms)
 
 FAIL  test/auth.test.ts > rejects invalid token
 AssertionError: expected 401 to be 403
    at /workspace/test/auth.test.ts:32:18
    at processTicksAndRejections (node:internal/process/task_queues:95:5)

 Test Files  1 failed | 1 passed (2)
      Tests  1 failed | 1 passed (2)
   Duration  180ms
`
            const report: SessionTestReport = parseTestOutput(command, rawOutput, 1)

            expect(report.command).toBe(command)
            expect(report.status).toBe('failed')
            expect(report.summary.total).toBe(2)
            expect(report.summary.passed).toBe(1)
            expect(report.summary.failed).toBe(1)

            expect(report.tests.length).toBe(2)
            expect(report.tests[0].name).toContain('authenticates valid user')
            expect(report.tests[0].status).toBe('passed')

            const failedTest = report.tests.find((t) => t.status === 'failed')
            expect(failedTest).toBeDefined()
            expect(failedTest?.name).toContain('rejects invalid token')
            expect(failedTest?.failureMessage).toContain('AssertionError: expected 401 to be 403')
            expect(failedTest?.stackTrace).toContain('/workspace/test/auth.test.ts:32:18')
        })
    })

    describe('parseTestOutput - Pytest', () => {
        it('parses pytest outputs with failure tracebacks and pass/fail summary', () => {
            const command = 'pytest -v'
            const rawOutput = `
tests/test_math.py::test_add PASSED                                      [ 33%]
tests/test_math.py::test_subtract PASSED                                 [ 66%]
tests/test_math.py::test_divide_by_zero FAILED                           [100%]

=================================== FAILURES ===================================
_____________________________ test_divide_by_zero ______________________________

    def test_divide_by_zero():
>       assert divide(10, 0) == 0
E       ZeroDivisionError: division by zero

tests/test_math.py:14: ZeroDivisionError
=========================== short test summary info ============================
FAILED tests/test_math.py::test_divide_by_zero - ZeroDivisionError: division by zero
========================= 1 failed, 2 passed in 0.14s ==========================
`
            const report: SessionTestReport = parseTestOutput(command, rawOutput, 1)

            expect(report.status).toBe('failed')
            expect(report.summary.total).toBe(3)
            expect(report.summary.passed).toBe(2)
            expect(report.summary.failed).toBe(1)
            expect(report.tests.length).toBe(3)

            const failing = report.tests.find(
                (t) => t.name === 'tests/test_math.py::test_divide_by_zero'
            )
            expect(failing).toBeDefined()
            expect(failing?.status).toBe('failed')
            expect(failing?.failureMessage).toContain('ZeroDivisionError: division by zero')
            expect(failing?.stackTrace).toContain('tests/test_math.py:14: ZeroDivisionError')
        })
    })

    describe('parseTestOutput - Cargo test', () => {
        it('parses cargo test stdout with ok and FAILED results', () => {
            const command = 'cargo test'
            const rawOutput = `
running 3 tests
test tests::test_parse_header ... ok
test tests::test_parse_body ... ok
test tests::test_invalid_syntax ... FAILED

failures:

---- tests::test_invalid_syntax stdout ----
thread 'tests::test_invalid_syntax' panicked at 'assertion failed: (left == right)
  left: Err(SyntaxError),
 right: Ok(())', src/lib.rs:42:9

failures:
    tests::test_invalid_syntax

test result: FAILED. 2 passed; 1 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.05s
`
            const report: SessionTestReport = parseTestOutput(command, rawOutput, 101)

            expect(report.status).toBe('failed')
            expect(report.summary.total).toBe(3)
            expect(report.summary.passed).toBe(2)
            expect(report.summary.failed).toBe(1)
            expect(report.tests.length).toBe(3)

            const failedTest = report.tests.find((t) => t.status === 'failed')
            expect(failedTest?.name).toBe('tests::test_invalid_syntax')
            expect(failedTest?.failureMessage).toContain('assertion failed: (left == right)')
            expect(failedTest?.stackTrace).toContain('src/lib.rs:42:9')
        })
    })

    describe('parseTestOutput - Bun test', () => {
        it('parses bun test output with checkmarks and failure details', () => {
            const command = 'bun test'
            const rawOutput = `
bun test v1.3.14 (0d9b296a)

test/unit/calculator.test.ts:
✓ calculator > adds numbers [0.24ms]
✗ calculator > handles float rounding [1.15ms]

1 fail
1 pass
2 expect() calls
Ran 2 tests across 1 files. [45.00ms]
`
            const report: SessionTestReport = parseTestOutput(command, rawOutput, 1)

            expect(report.status).toBe('failed')
            expect(report.summary.total).toBe(2)
            expect(report.summary.passed).toBe(1)
            expect(report.summary.failed).toBe(1)
            expect(report.tests.length).toBe(2)
            expect(report.tests[0].name).toBe('calculator > adds numbers')
            expect(report.tests[0].status).toBe('passed')
            expect(report.tests[1].name).toBe('calculator > handles float rounding')
            expect(report.tests[1].status).toBe('failed')
        })
    })
})
