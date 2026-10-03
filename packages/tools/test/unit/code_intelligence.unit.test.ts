import { describe, expect, test, mock } from 'bun:test'

import { CodeIntelligenceTool } from '../../src/code_intelligence'
import { createMockContext } from '../mock-context'

describe('CodeIntelligenceTool (Unit)', () => {
    test('has valid tool metadata and schema', () => {
        expect(CodeIntelligenceTool.name).toBe('code_intelligence')
        expect(typeof CodeIntelligenceTool.description).toBe('string')
        expect(CodeIntelligenceTool.description.length).toBeGreaterThan(0)
        expect(CodeIntelligenceTool.inputSchema).toBeDefined()
        expect(typeof CodeIntelligenceTool.execute).toBe('function')
    })

    test('returns error when diagnostics operations are not supported in environment', async () => {
        const context = createMockContext()
        // diagnostics operation is undefined on mock context
        const result = await CodeIntelligenceTool.execute({ action: 'diagnostics' }, context)
        expect(result).toBe(
            'Error: Diagnostics operations are not supported in the current environment.'
        )
    })

    test('returns error when getDiagnostics method is missing', async () => {
        const context = createMockContext()
        context.operations.diagnostics = {} as any

        const result = await CodeIntelligenceTool.execute({ action: 'diagnostics' }, context)
        expect(result).toBe(
            'Error: Diagnostics operations are not supported in the current environment.'
        )
    })

    test('returns error when unsupported action is provided', async () => {
        const context = createMockContext()
        context.operations.diagnostics = {
            getDiagnostics: mock(async () => []),
        }

        const result = await CodeIntelligenceTool.execute({ action: 'unknown' as any }, context)
        expect(result).toContain('Unsupported action: "unknown"')
    })

    test('returns clean confirmation when no diagnostics are found (empty array) without path', async () => {
        const context = createMockContext()
        context.operations.diagnostics = {
            getDiagnostics: mock(async () => []),
        }

        const result = await CodeIntelligenceTool.execute({ action: 'diagnostics' }, context)

        expect(context.operations.diagnostics.getDiagnostics).toHaveBeenCalledWith('')
        expect(result).toBe('No diagnostic errors found.')
    })

    test('returns clean confirmation when no diagnostics are found (empty array) with path', async () => {
        const context = createMockContext()
        context.operations.diagnostics = {
            getDiagnostics: mock(async () => []),
        }

        const result = await CodeIntelligenceTool.execute(
            { action: 'diagnostics', path: '/src/index.ts' },
            context
        )

        expect(context.operations.diagnostics.getDiagnostics).toHaveBeenCalledWith('/src/index.ts')
        expect(result).toBe('No diagnostic errors found for /src/index.ts.')
    })

    test('returns clean confirmation when getDiagnostics returns empty or whitespace string', async () => {
        const context = createMockContext()
        context.operations.diagnostics = {
            getDiagnostics: mock(async () => '   \n  '),
        }

        const result = await CodeIntelligenceTool.execute(
            { action: 'diagnostics', path: 'src/app.ts' },
            context
        )

        expect(result).toBe('No diagnostic errors found for src/app.ts.')
    })

    test('returns formatted diagnostic errors for DiagnosticItem array', async () => {
        const context = createMockContext()
        context.operations.diagnostics = {
            getDiagnostics: mock(async () => [
                {
                    filePath: '/src/main.ts',
                    line: 12,
                    column: 4,
                    message: "Cannot find name 'foo'.",
                    severity: 'error' as const,
                    source: 'typescript',
                },
                {
                    filePath: '/src/main.ts',
                    line: 25,
                    message: "'bar' is declared but never read.",
                    severity: 'warning' as const,
                },
                {
                    filePath: '/src/utils.ts',
                    message: 'Unexpected token.',
                },
            ]),
        }

        const result = await CodeIntelligenceTool.execute({ action: 'diagnostics' }, context)

        expect(result).toContain('Diagnostic errors found:')
        expect(result).toContain("/src/main.ts:12:4 - [error] Cannot find name 'foo'. (typescript)")
        expect(result).toContain("/src/main.ts:25 - [warning] 'bar' is declared but never read.")
        expect(result).toContain('/src/utils.ts - [error] Unexpected token.')
    })

    test('returns formatted diagnostic errors with path in header when path is specified', async () => {
        const context = createMockContext()
        context.operations.diagnostics = {
            getDiagnostics: mock(async () => [
                {
                    filePath: '/src/file.ts',
                    line: 1,
                    column: 1,
                    message: 'Type error.',
                    severity: 'error' as const,
                },
            ]),
        }

        const result = await CodeIntelligenceTool.execute(
            { action: 'diagnostics', path: '/src/file.ts' },
            context
        )

        expect(result).toContain('Diagnostic errors found for /src/file.ts:')
        expect(result).toContain('/src/file.ts:1:1 - [error] Type error.')
    })

    test('returns formatted diagnostics when getDiagnostics returns non-empty string', async () => {
        const context = createMockContext()
        context.operations.diagnostics = {
            getDiagnostics: mock(async () => 'Error: TS2304: Cannot find name "abc" at line 5.'),
        }

        const result = await CodeIntelligenceTool.execute(
            { action: 'diagnostics', path: 'src/file.ts' },
            context
        )

        expect(result).toContain('Diagnostic errors found for src/file.ts:')
        expect(result).toContain('Error: TS2304: Cannot find name "abc" at line 5.')
    })

    test('gracefully handles thrown errors from getDiagnostics', async () => {
        const context = createMockContext()
        context.operations.diagnostics = {
            getDiagnostics: mock(async () => {
                throw new Error('LSP connection lost')
            }),
        }

        const result = await CodeIntelligenceTool.execute(
            { action: 'diagnostics', path: 'src/file.ts' },
            context
        )

        expect(result).toBe('Error retrieving diagnostics: LSP connection lost')
    })

    describe('definition action', () => {
        test('requires path parameter', async () => {
            const context = createMockContext()
            const result = await CodeIntelligenceTool.execute({ action: 'definition' }, context)
            expect(result).toBe('Error: "path" parameter is required for "definition" action.')
        })

        test('returns error when LSP operations are unsupported', async () => {
            const context = createMockContext()
            const result = await CodeIntelligenceTool.execute(
                { action: 'definition', path: '/src/index.ts', line: 1, column: 5 },
                context
            )
            expect(result).toBe(
                'Error: LSP operations are not supported in the current environment.'
            )
        })

        test('requires line and column or symbol', async () => {
            const context = createMockContext()
            context.operations.lsp = { getDefinition: mock(async () => []) } as any
            const result = await CodeIntelligenceTool.execute(
                { action: 'definition', path: '/src/index.ts' },
                context
            )
            expect(result).toBe(
                'Error: "line" and "column" (or "symbol") are required for "definition" action.'
            )
        })

        test('resolves symbol definition with explicit line and column', async () => {
            const context = createMockContext()
            context.operations.lsp = {
                getDefinition: mock(async () => [
                    { filePath: '/src/math.ts', line: 10, column: 15 },
                ]),
            } as any

            const result = await CodeIntelligenceTool.execute(
                { action: 'definition', path: '/src/main.ts', line: 3, column: 12 },
                context
            )

            expect(context.operations.lsp.getDefinition).toHaveBeenCalledWith('/src/main.ts', 3, 12)
            expect(result).toBe('Definition found at /src/math.ts:10:15')
        })

        test('resolves symbol line and column automatically by finding symbol in file', async () => {
            const context = createMockContext()
            context.operations.fs.readFile = mock(
                async () => 'import { helper } from "./helper"\n\nconst val = helper()'
            )
            context.operations.lsp = {
                getDefinition: mock(async () => ({
                    filePath: '/src/helper.ts',
                    line: 1,
                    column: 17,
                })),
            } as any

            const result = await CodeIntelligenceTool.execute(
                { action: 'definition', path: '/src/main.ts', symbol: 'helper' },
                context
            )

            expect(context.operations.fs.readFile).toHaveBeenCalledWith('/src/main.ts')
            // Line 3, col 13 in 1-indexed format (prefers usage call site over import)
            expect(context.operations.lsp.getDefinition).toHaveBeenCalledWith('/src/main.ts', 3, 13)
            expect(result).toBe('Definition found at /src/helper.ts:1:17')
        })

        test('returns error if symbol is not found in file content', async () => {
            const context = createMockContext()
            context.operations.fs.readFile = mock(async () => 'const x = 1')
            context.operations.lsp = { getDefinition: mock(async () => []) } as any

            const result = await CodeIntelligenceTool.execute(
                { action: 'definition', path: '/src/main.ts', symbol: 'nonExistent' },
                context
            )

            expect(result).toBe('Symbol "nonExistent" not found in /src/main.ts.')
        })

        test('returns message when no definition is found', async () => {
            const context = createMockContext()
            context.operations.lsp = { getDefinition: mock(async () => []) } as any

            const result = await CodeIntelligenceTool.execute(
                { action: 'definition', path: '/src/main.ts', line: 5, column: 2 },
                context
            )

            expect(result).toBe('No definition found for symbol at /src/main.ts:5:2.')
        })

        test('formats multiple definitions when found', async () => {
            const context = createMockContext()
            context.operations.lsp = {
                getDefinition: mock(async () => [
                    { filePath: '/src/a.ts', line: 5, column: 1 },
                    { filePath: '/src/b.ts', line: 8, column: 3 },
                ]),
            } as any

            const result = await CodeIntelligenceTool.execute(
                { action: 'definition', path: '/src/main.ts', line: 2, column: 4 },
                context
            )

            expect(result).toContain('Definition(s) found:')
            expect(result).toContain('- /src/a.ts:5:1')
            expect(result).toContain('- /src/b.ts:8:3')
        })
    })

    describe('references action', () => {
        test('requires path parameter', async () => {
            const context = createMockContext()
            const result = await CodeIntelligenceTool.execute({ action: 'references' }, context)
            expect(result).toBe('Error: "path" parameter is required for "references" action.')
        })

        test('returns error when LSP operations are unsupported', async () => {
            const context = createMockContext()
            const result = await CodeIntelligenceTool.execute(
                { action: 'references', path: '/src/index.ts', line: 1, column: 5 },
                context
            )
            expect(result).toBe(
                'Error: LSP operations are not supported in the current environment.'
            )
        })

        test('resolves references and formats call sites', async () => {
            const context = createMockContext()
            context.operations.lsp = {
                getReferences: mock(async () => [
                    { filePath: '/src/math.ts', line: 1, column: 17 },
                    { filePath: '/src/main.ts', line: 3, column: 15 },
                ]),
            } as any

            const result = await CodeIntelligenceTool.execute(
                { action: 'references', path: '/src/math.ts', line: 1, column: 17 },
                context
            )

            expect(result).toContain('Found 2 reference(s) for symbol at /src/math.ts:1:17:')
            expect(result).toContain('- /src/math.ts:1:17')
            expect(result).toContain('- /src/main.ts:3:15')
        })

        test('returns message when no references are found', async () => {
            const context = createMockContext()
            context.operations.lsp = { getReferences: mock(async () => []) } as any

            const result = await CodeIntelligenceTool.execute(
                { action: 'references', path: '/src/math.ts', line: 1, column: 17 },
                context
            )

            expect(result).toBe('No references found for symbol at /src/math.ts:1:17.')
        })
    })

    describe('outline action', () => {
        test('requires path parameter', async () => {
            const context = createMockContext()
            const result = await CodeIntelligenceTool.execute({ action: 'outline' }, context)
            expect(result).toBe('Error: "path" parameter is required for "outline" action.')
        })

        test('returns error when LSP operations are unsupported', async () => {
            const context = createMockContext()
            const result = await CodeIntelligenceTool.execute(
                { action: 'outline', path: '/src/index.ts' },
                context
            )
            expect(result).toBe(
                'Error: LSP operations are not supported in the current environment.'
            )
        })

        test('formats document outline symbols', async () => {
            const context = createMockContext()
            context.operations.lsp = {
                getOutline: mock(async () => [
                    { name: 'addNumbers', kind: 'function', line: 1, column: 1 },
                    {
                        name: 'Calculator',
                        kind: 'class',
                        line: 10,
                        column: 1,
                    },
                    {
                        name: 'compute',
                        kind: 'method',
                        line: 12,
                        column: 5,
                        containerName: 'Calculator',
                    },
                ]),
            } as any

            const result = await CodeIntelligenceTool.execute(
                { action: 'outline', path: '/src/math.ts' },
                context
            )

            expect(result).toContain('Document outline for /src/math.ts:')
            expect(result).toContain('- [function] addNumbers (/src/math.ts:1:1)')
            expect(result).toContain('- [class] Calculator (/src/math.ts:10:1)')
            expect(result).toContain('- [method] compute (/src/math.ts:12:5) (in Calculator)')
        })

        test('returns message when no symbols found in outline', async () => {
            const context = createMockContext()
            context.operations.lsp = { getOutline: mock(async () => []) } as any

            const result = await CodeIntelligenceTool.execute(
                { action: 'outline', path: '/src/empty.ts' },
                context
            )

            expect(result).toBe('No document symbols found for /src/empty.ts.')
        })
    })
})
