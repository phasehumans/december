import { describe, expect, test, mock } from 'bun:test'

import { EditFileTool } from '../../src/edit'
import { createMockContext } from '../mock-context'

describe('EditFileTool (Unit)', () => {
    test('should replace exact substring successfully', async () => {
        const context = createMockContext()
        context.operations.fs.readFile = mock(async () => 'const a = 1\nconst b = 2')

        const result = await EditFileTool.execute(
            {
                path: '/test.ts',
                targetContent: 'const a = 1',
                replacementContent: 'const a = 10',
            },
            context
        )

        expect(context.operations.fs.writeFile).toHaveBeenCalledWith(
            '/test.ts',
            'const a = 10\nconst b = 2'
        )
        expect(result).toContain('Successfully edited file')
    })

    test('should fall back to line-by-line whitespace trimmed matching', async () => {
        const context = createMockContext()
        context.operations.fs.readFile = mock(async () => 'function foo() {   \n  return 1;\n}')

        const result = await EditFileTool.execute(
            {
                path: '/test.ts',
                targetContent: 'function foo() {\n  return 1;\n}',
                replacementContent: 'function foo() {\n  return 42;\n}',
            },
            context
        )

        expect(context.operations.fs.writeFile).toHaveBeenCalledWith(
            '/test.ts',
            'function foo() {\n  return 42;\n}'
        )
        expect(result).toContain('matched with normalized whitespace')
    })

    test('should fail if targetContent is not found', async () => {
        const context = createMockContext()
        context.operations.fs.readFile = mock(async () => 'hello world')

        const result = await EditFileTool.execute(
            {
                path: '/test.ts',
                targetContent: 'missing target',
                replacementContent: 'replacement',
            },
            context
        )

        expect(result).toContain('Error: targetContent not found')
    })

    test('should handle read or write errors gracefully', async () => {
        const context = createMockContext()
        context.operations.fs.readFile = mock(async () => {
            throw new Error('Access denied')
        })

        const result = await EditFileTool.execute(
            {
                path: '/forbidden.ts',
                targetContent: 'a',
                replacementContent: 'b',
            },
            context
        )

        expect(result).toBe('Failed to edit file: Access denied')
    })
})

test('should apply multiple disjoint edits in a single turn', async () => {
    const context = createMockContext()
    context.operations.fs.readFile = mock(
        async () => 'import a from "a"\n\nfunction foo() { return 1 }\n\nexport default foo'
    )

    const result = await EditFileTool.execute(
        {
            path: '/test.ts',
            edits: [
                {
                    targetContent: 'import a from "a"',
                    replacementContent: 'import { a, b } from "a"',
                },
                { targetContent: 'return 1', replacementContent: 'return 42' },
            ],
        },
        context
    )

    expect(context.operations.fs.writeFile).toHaveBeenCalledWith(
        '/test.ts',
        'import { a, b } from "a"\n\nfunction foo() { return 42 }\n\nexport default foo'
    )
    expect(result).toContain('2 disjoint replacements applied')
})

test('should reject overlapping edits with a clear error', async () => {
    const context = createMockContext()
    context.operations.fs.readFile = mock(async () => 'const message = "hello world"')

    const result = await EditFileTool.execute(
        {
            path: '/test.ts',
            edits: [
                { targetContent: 'message = "hello', replacementContent: 'msg = "hi' },
                { targetContent: 'hello world"', replacementContent: 'hi universe"' },
            ],
        },
        context
    )

    expect(result).toContain('Error: Overlapping edits detected')
    expect(context.operations.fs.writeFile).not.toHaveBeenCalled()
})

test('should match and replace text containing unicode smart quotes and dashes', async () => {
    const context = createMockContext()
    // File on disk has smart quotes and en-dash
    context.operations.fs.readFile = mock(
        async () => 'const title = \u201CHello\u201D \u2013 world'
    )

    const result = await EditFileTool.execute(
        {
            path: '/test.ts',
            // Model emitted standard ASCII quotes and standard hyphen
            targetContent: 'const title = "Hello" - world',
            replacementContent: 'const title = "Hello" - updated',
        },
        context
    )

    expect(result).toContain('Successfully edited file')
    expect(context.operations.fs.writeFile).toHaveBeenCalledWith(
        '/test.ts',
        'const title = "Hello" - updated'
    )
})

test('should preserve CRLF line endings when modifying Windows files', async () => {
    const context = createMockContext()
    context.operations.fs.readFile = mock(async () => 'line1\r\nline2\r\nline3')

    await EditFileTool.execute(
        {
            path: '/win.ts',
            targetContent: 'line2',
            replacementContent: 'line2_edited',
        },
        context
    )

    expect(context.operations.fs.writeFile).toHaveBeenCalledWith(
        '/win.ts',
        'line1\r\nline2_edited\r\nline3'
    )
})

test('should match via block anchors and Levenshtein similarity for multi-line chunks', async () => {
    const context = createMockContext()
    // Target file has slightly different indentation or inner lines
    context.operations.fs.readFile = mock(
        async () => 'function compute() {\n    const initial = 100\n    return initial * 2\n}'
    )

    const result = await EditFileTool.execute(
        {
            path: '/calc.ts',
            targetContent: 'function compute() {\n  const initial = 100;\n  return initial * 2\n}',
            replacementContent: 'function compute() {\n    return 42\n}',
        },
        context
    )

    expect(result).toContain('Successfully edited file')
    expect(context.operations.fs.writeFile).toHaveBeenCalledWith(
        '/calc.ts',
        'function compute() {\n    return 42\n}'
    )
})

test('should reject disproportionate match when edit chunk matches ambiguous outer braces across hundreds of lines', async () => {
    const context = createMockContext()
    const fileLines = [
        'function outerWrapper() {',
        ...Array.from({ length: 200 }, (_, i) => `    const tempVar${i} = ${i};`),
        '}',
    ]
    context.operations.fs.readFile = mock(async () => fileLines.join('\n'))

    const result = await EditFileTool.execute(
        {
            path: '/large.ts',
            targetContent: 'function outerWrapper() {\n    const tempVar0 = 0;\n}',
            replacementContent: 'function outerWrapper() {\n    return 0;\n}',
        },
        context
    )

    expect(result).toContain('Disproportionate match detected')
    expect(result).toContain('/large.ts')
    expect(context.operations.fs.writeFile).not.toHaveBeenCalled()
})

test('should support edits array with oldText and newText aliases', async () => {
    const context = createMockContext()
    context.operations.fs.readFile = mock(
        async () => 'interface Config {\n    debug: boolean\n}\n\nconst port = 3000\n'
    )

    const result = await EditFileTool.execute(
        {
            path: '/config.ts',
            edits: [
                {
                    oldText: 'debug: boolean',
                    newText: 'debug: boolean\n    verbose: boolean',
                },
                {
                    oldText: 'const port = 3000',
                    newText: 'const port = 8080',
                },
            ],
        },
        context
    )

    expect(result).toContain(
        'Successfully edited file: /config.ts (2 disjoint replacements applied)'
    )
    expect(context.operations.fs.writeFile).toHaveBeenCalledWith(
        '/config.ts',
        'interface Config {\n    debug: boolean\n    verbose: boolean\n}\n\nconst port = 8080\n'
    )
})

test('should include instant LSP diagnostics feedback when diagnostics are detected', async () => {
    const context = createMockContext()
    context.operations.fs.readFile = mock(async () => 'let x: number = 10')
    context.operations.diagnostics = {
        getDiagnostics: mock(async (filePath: string) => [
            {
                filePath,
                line: 1,
                column: 5,
                message: "Type 'string' is not assignable to type 'number'.",
                severity: 'error',
                source: 'typescript',
            },
        ]),
    }

    const result = await EditFileTool.execute(
        {
            path: '/code.ts',
            targetContent: 'let x: number = 10',
            replacementContent: 'let x: number = "hello"',
        },
        context
    )

    expect(result).toContain('Successfully edited file')
    expect(result).toContain('LSP errors detected in this file, please fix:')
    expect(result).toContain(
        "/code.ts:1:5 - [error] Type 'string' is not assignable to type 'number'. (typescript)"
    )
})

test('should serialize concurrent writes to the same file while allowing different files to run in parallel', async () => {
    const context = createMockContext()
    const fileStates: Record<string, string> = {
        '/fileA.ts': 'Initial A',
        '/fileB.ts': 'Initial B',
    }

    context.operations.fs.readFile = mock(async (p: string) => fileStates[p] ?? '')
    context.operations.fs.writeFile = mock(async (p: string, content: string) => {
        fileStates[p] = content
    })

    // Concurrent edits to different files
    await Promise.all([
        EditFileTool.execute(
            { path: '/fileA.ts', targetContent: 'Initial A', replacementContent: 'Updated A' },
            context
        ),
        EditFileTool.execute(
            { path: '/fileB.ts', targetContent: 'Initial B', replacementContent: 'Updated B' },
            context
        ),
    ])

    expect(fileStates['/fileA.ts']).toBe('Updated A')
    expect(fileStates['/fileB.ts']).toBe('Updated B')
})
