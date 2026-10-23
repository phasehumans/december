/* eslint-disable no-control-regex */

export interface TestCaseResult {
    id: string
    name: string
    suite?: string
    status: 'passed' | 'failed' | 'skipped'
    durationMs?: number
    failureMessage?: string
    stackTrace?: string
}

export interface TestSuiteSummary {
    total: number
    passed: number
    failed: number
    skipped: number
    durationMs?: number
}

export interface SessionTestReport {
    command: string
    status: 'passed' | 'failed' | 'error'
    summary: TestSuiteSummary
    tests: TestCaseResult[]
    rawOutput: string
    executedAt: string
}

const stripAnsi = (str: string): string => {
    return str.replace(
        /[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g,
        ''
    )
}

export const isTestExecutionCommand = (command: string): boolean => {
    if (!command || typeof command !== 'string') return false
    const trimmed = command.trim()
    const patterns = [
        /^(bun|npm|pnpm|yarn)\s+((--bun\s+)?run\s+)?test(\s+.*)?$/,
        /^(npx|bunx|yarn|pnpm exec)\s+(vitest|jest|mocha|playwright)(\s+.*)?$/,
        /^(vitest|jest|mocha|playwright)(\s+.*)?$/,
        /^(python3?|py)\s+-m\s+(pytest|unittest)(\s+.*)?$/,
        /^pytest(\s+.*)?$/,
        /^cargo\s+test(\s+.*)?$/,
        /^go\s+test(\s+.*)?$/,
    ]
    return patterns.some((p) => p.test(trimmed))
}

const parseVitestOrJest = (cleanOutput: string): TestCaseResult[] => {
    const results: TestCaseResult[] = []
    const lines = cleanOutput.split('\n')

    // Parse failure blocks (e.g. FAIL test/auth.test.ts > rejects invalid token)
    const failureDetails = new Map<string, { message: string; stack: string }>()
    let currentFailureTest: string | null = null
    let currentFailureMessage: string[] = []
    let currentStackTrace: string[] = []

    for (const line of lines) {
        const failHeaderMatch = line.match(/^\s*(?:FAIL|✕|✗)\s+(.+?)(?:\s+\(\d+ms\))?$/)
        if (failHeaderMatch) {
            if (currentFailureTest) {
                failureDetails.set(currentFailureTest, {
                    message: currentFailureMessage.join('\n').trim(),
                    stack: currentStackTrace.join('\n').trim(),
                })
            }
            currentFailureTest = failHeaderMatch[1].trim()
            currentFailureMessage = []
            currentStackTrace = []
            continue
        }

        if (currentFailureTest) {
            if (line.match(/^\s+at\s+/)) {
                currentStackTrace.push(line.trim())
            } else if (line.match(/^\s*(?:Test Files|Tests|Duration|Ran)/)) {
                failureDetails.set(currentFailureTest, {
                    message: currentFailureMessage.join('\n').trim(),
                    stack: currentStackTrace.join('\n').trim(),
                })
                currentFailureTest = null
            } else if (line.trim().length > 0) {
                currentFailureMessage.push(line.trim())
            }
        }
    }

    if (currentFailureTest) {
        failureDetails.set(currentFailureTest, {
            message: currentFailureMessage.join('\n').trim(),
            stack: currentStackTrace.join('\n').trim(),
        })
    }

    // Parse test lines
    for (const line of lines) {
        // e.g. ✓ test/auth.test.ts > authenticates valid user (12ms) or [0.24ms]
        const passMatch = line.match(
            /^\s*[✓✔]\s+(?:(.+?)\s+>\s+)?(.+?)(?:\s+[[(]?(\d+(?:\.\d+)?)\s*ms[\])])?$/
        )
        if (passMatch) {
            const suite = passMatch[1]?.trim()
            const name = passMatch[2]?.trim()
            const duration = passMatch[3] ? parseFloat(passMatch[3]) : undefined
            results.push({
                id: `test-${results.length + 1}`,
                name: suite ? `${suite} > ${name}` : name,
                suite,
                status: 'passed',
                durationMs: duration,
            })
            continue
        }

        const failMatch = line.match(
            /^\s*[✗✕✖]\s+(?:(.+?)\s+>\s+)?(.+?)(?:\s+[[(]?(\d+(?:\.\d+)?)\s*ms[\])])?$/
        )
        if (failMatch) {
            const suite = failMatch[1]?.trim()
            const name = failMatch[2]?.trim()
            const fullName = suite ? `${suite} > ${name}` : name
            const duration = failMatch[3] ? parseFloat(failMatch[3]) : undefined

            // Lookup failure details
            let failureMessage: string | undefined
            let stackTrace: string | undefined
            for (const [key, details] of failureDetails.entries()) {
                if (key.includes(name) || fullName.includes(key)) {
                    failureMessage = details.message
                    stackTrace = details.stack
                    break
                }
            }

            results.push({
                id: `test-${results.length + 1}`,
                name: fullName,
                suite,
                status: 'failed',
                durationMs: duration,
                failureMessage,
                stackTrace,
            })
        }
    }

    return results
}

const parsePytest = (cleanOutput: string): TestCaseResult[] => {
    const results: TestCaseResult[] = []
    const lines = cleanOutput.split('\n')

    // Find test cases: tests/test_math.py::test_add PASSED
    const testPattern = /^(\S+::\S+)\s+(PASSED|FAILED|SKIPPED)(?:\s+\[\s*\d+%\])?$/
    for (const line of lines) {
        const match = line.trim().match(testPattern)
        if (match) {
            const fullName = match[1]
            const statusStr = match[2]
            const parts = fullName.split('::')
            const suite = parts[0]
            const status: 'passed' | 'failed' | 'skipped' =
                statusStr === 'PASSED' ? 'passed' : statusStr === 'FAILED' ? 'failed' : 'skipped'

            results.push({
                id: `test-${results.length + 1}`,
                name: fullName,
                suite,
                status,
            })
        }
    }

    // Parse failure messages under FAILURES
    const failureSectionIdx = cleanOutput.indexOf('=== FAILURES ===')
    if (failureSectionIdx !== -1) {
        const failureText = cleanOutput.slice(failureSectionIdx)
        for (const test of results.filter((t) => t.status === 'failed')) {
            const shortName = test.name.split('::').pop() || test.name
            const headerRegex = new RegExp(`_{2,}\\s*${shortName}\\s*_{2,}`)
            const match = failureText.match(headerRegex)
            if (match && match.index !== undefined) {
                const sub = failureText.slice(match.index)
                const nextHeaderMatch = sub.slice(match[0].length).match(/_{5,}|={5,}/)
                const block =
                    nextHeaderMatch && nextHeaderMatch.index !== undefined
                        ? sub.slice(0, nextHeaderMatch.index + match[0].length)
                        : sub

                const blockLines = block.split('\n')
                const errorLines = blockLines.filter(
                    (l) => l.startsWith('E   ') || l.startsWith('E  ')
                )

                if (errorLines.length > 0) {
                    test.failureMessage = errorLines.map((l) => l.replace(/^E\s+/, '')).join('\n')
                } else {
                    // Fallback to short test summary line if present
                    const summaryLine = cleanOutput
                        .split('\n')
                        .find((l) => l.includes(`FAILED ${test.name}`))
                    if (summaryLine) {
                        test.failureMessage = summaryLine.split(' - ').slice(1).join(' - ')
                    }
                }

                const traceLine = blockLines.find((l) => l.match(/\.py:\d+:/))
                if (traceLine) {
                    test.stackTrace = traceLine.trim()
                }
            } else {
                // Fallback to short test summary
                const summaryLine = cleanOutput
                    .split('\n')
                    .find((l) => l.includes(`FAILED ${test.name}`))
                if (summaryLine) {
                    test.failureMessage = summaryLine.split(' - ').slice(1).join(' - ')
                }
            }
        }
    }

    return results
}

const parseCargo = (cleanOutput: string): TestCaseResult[] => {
    const results: TestCaseResult[] = []
    const lines = cleanOutput.split('\n')

    // test tests::test_parse_header ... ok
    const cargoPattern = /^test\s+(.+?)\s+\.\.\.\s+(ok|FAILED|ignored)$/
    for (const line of lines) {
        const match = line.trim().match(cargoPattern)
        if (match) {
            const name = match[1].trim()
            const outcome = match[2]
            results.push({
                id: `test-${results.length + 1}`,
                name,
                status: outcome === 'ok' ? 'passed' : outcome === 'FAILED' ? 'failed' : 'skipped',
            })
        }
    }

    // Look for failure details: ---- tests::test_invalid_syntax stdout ----
    for (const test of results.filter((t) => t.status === 'failed')) {
        const marker = `---- ${test.name} stdout ----`
        const idx = cleanOutput.indexOf(marker)
        if (idx !== -1) {
            const block = cleanOutput.slice(idx)
            const panicMatch = block.match(/thread '.+?' panicked at '(.+?)',\s*(\S+:\d+:\d+)/s)
            if (panicMatch) {
                test.failureMessage = panicMatch[1].trim()
                test.stackTrace = panicMatch[2].trim()
            }
        }
    }

    return results
}

export const parseTestOutput = (
    command: string,
    rawOutput: string,
    exitCode?: number
): SessionTestReport => {
    const cleanOutput = stripAnsi(rawOutput || '')

    let tests: TestCaseResult[]

    if (
        command.includes('pytest') ||
        cleanOutput.includes('=== FAILURES ===') ||
        cleanOutput.includes('short test summary info')
    ) {
        tests = parsePytest(cleanOutput)
    } else if (command.includes('cargo') || cleanOutput.includes('test result:')) {
        tests = parseCargo(cleanOutput)
    } else {
        tests = parseVitestOrJest(cleanOutput)
    }

    // Calculate summary
    const passed = tests.filter((t) => t.status === 'passed').length
    const failed = tests.filter((t) => t.status === 'failed').length
    const skipped = tests.filter((t) => t.status === 'skipped').length
    const total = tests.length

    let status: 'passed' | 'failed' | 'error' = 'passed'
    if (failed > 0 || (exitCode !== undefined && exitCode !== 0 && total > 0)) {
        status = 'failed'
    } else if (exitCode !== undefined && exitCode !== 0 && total === 0) {
        status = 'error'
    }

    return {
        command,
        status,
        summary: {
            total,
            passed,
            failed,
            skipped,
        },
        tests,
        rawOutput,
        executedAt: new Date().toISOString(),
    }
}
