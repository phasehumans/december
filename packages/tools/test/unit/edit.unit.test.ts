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
