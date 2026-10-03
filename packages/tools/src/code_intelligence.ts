import {
    Tool,
    ToolExecuteContext,
    DiagnosticItem,
    LocationItem,
    OutlineItem,
} from '@december/shared'
import { Type, Static } from '@sinclair/typebox'

const codeIntelligenceSchema = Type.Object({
    action: Type.Union(
        [
            Type.Literal('diagnostics'),
            Type.Literal('definition'),
            Type.Literal('references'),
            Type.Literal('outline'),
        ],
        {
            description:
                'The code intelligence action to perform: "diagnostics", "definition", "references", or "outline".',
        }
    ),
    path: Type.Optional(
        Type.String({
            description:
                'Relative or absolute file path or directory to query. Required for "definition", "references", and "outline".',
        })
    ),
    line: Type.Optional(
        Type.Integer({
            description: '1-indexed line number of the symbol for definition or references lookup.',
        })
    ),
    column: Type.Optional(
        Type.Integer({
            description:
                '1-indexed column number of the symbol for definition or references lookup.',
        })
    ),
    symbol: Type.Optional(
        Type.String({
            description:
                'Optional symbol name to search for in the file if line and column are not specified.',
        })
    ),
})

export type CodeIntelligenceInput = Static<typeof codeIntelligenceSchema>

export function formatDiagnostics(
    diags: DiagnosticItem[] | string | null | undefined,
    path?: string
): string {
    const target = path ? ` for ${path}` : ''

    if (!diags) {
        return `No diagnostic errors found${target}.`
    }

    if (typeof diags === 'string') {
        const trimmed = diags.trim()
        if (!trimmed) {
            return `No diagnostic errors found${target}.`
        }
        return `Diagnostic errors found${target}:\n${trimmed}`
    }

    if (Array.isArray(diags)) {
        if (diags.length === 0) {
            return `No diagnostic errors found${target}.`
        }

        const formatted = diags
            .map((d) => {
                const loc = d.line ? `:${d.line}${d.column ? `:${d.column}` : ''}` : ''
                return `${d.filePath}${loc} - [${d.severity ?? 'error'}] ${d.message}${d.source ? ` (${d.source})` : ''}`
            })
            .join('\n')

        return `Diagnostic errors found${target}:\n${formatted}`
    }

    return `No diagnostic errors found${target}.`
}

export const CodeIntelligenceTool: Tool<CodeIntelligenceInput> = {
    name: 'code_intelligence',
    description:
        'Query on-demand code intelligence, symbol definitions, call site references, document outline, and compiler diagnostics across the workspace or for a specific file.',
    inputSchema: codeIntelligenceSchema,
    execute: async ({ action, path, line, column, symbol }, context: ToolExecuteContext) => {
        if (
            action !== 'diagnostics' &&
            action !== 'definition' &&
            action !== 'references' &&
            action !== 'outline'
        ) {
            return `Unsupported action: "${action}". Supported actions: "diagnostics", "definition", "references", "outline".`
        }

        if (action === 'diagnostics') {
            const diagFn =
                context.operations.diagnostics?.getDiagnostics ||
                context.operations.lsp?.getDiagnostics

            if (!diagFn) {
                return 'Error: Diagnostics operations are not supported in the current environment.'
            }

            try {
                const diags = await diagFn(path ?? '')
                return formatDiagnostics(diags, path)
            } catch (err: unknown) {
                const message = err instanceof Error ? err.message : String(err)
                return `Error retrieving diagnostics: ${message}`
            }
        }

        if (action === 'outline') {
            if (!path) {
                return 'Error: "path" parameter is required for "outline" action.'
            }

            if (!context.operations.lsp?.getOutline) {
                return 'Error: LSP operations are not supported in the current environment.'
            }

            try {
                const symbols: OutlineItem[] = await context.operations.lsp.getOutline(path)
                if (!symbols || symbols.length === 0) {
                    return `No document symbols found for ${path}.`
                }

                const lines = symbols.map(
                    (s) =>
                        `- [${s.kind}] ${s.name} (${path}:${s.line}:${s.column})${s.containerName ? ` (in ${s.containerName})` : ''}`
                )
                return `Document outline for ${path}:\n${lines.join('\n')}`
            } catch (err: unknown) {
                const message = err instanceof Error ? err.message : String(err)
                return `Error retrieving outline: ${message}`
            }
        }

        // Both 'definition' and 'references' require a path and symbol position
        if (!path) {
            return `Error: "path" parameter is required for "${action}" action.`
        }

        let targetLine = line
        let targetColumn = column

        if ((targetLine === undefined || targetColumn === undefined) && symbol) {
            try {
                const content = await context.operations.fs.readFile(path)
                const fileLines = content.split('\n')
                for (let i = 0; i < fileLines.length; i++) {
                    const idx = fileLines[i]!.indexOf(symbol)
                    if (idx !== -1) {
                        targetLine = i + 1
                        targetColumn = idx + 1
                        break
                    }
                }
                if (targetLine === undefined || targetColumn === undefined) {
                    return `Symbol "${symbol}" not found in ${path}.`
                }
            } catch (err: unknown) {
                const message = err instanceof Error ? err.message : String(err)
                return `Error reading file ${path}: ${message}`
            }
        }

        if (targetLine === undefined || targetColumn === undefined) {
            return `Error: "line" and "column" (or "symbol") are required for "${action}" action.`
        }

        if (action === 'definition') {
            if (!context.operations.lsp?.getDefinition) {
                return 'Error: LSP operations are not supported in the current environment.'
            }

            try {
                const raw = await context.operations.lsp.getDefinition(
                    path,
                    targetLine,
                    targetColumn
                )
                const locs: LocationItem[] = Array.isArray(raw) ? raw : raw ? [raw] : []

                if (locs.length === 0) {
                    return `No definition found for symbol at ${path}:${targetLine}:${targetColumn}.`
                }

                if (locs.length === 1) {
                    const loc = locs[0]!
                    return `Definition found at ${loc.filePath}:${loc.line}:${loc.column}`
                }

                const list = locs.map((l) => `- ${l.filePath}:${l.line}:${l.column}`).join('\n')
                return `Definition(s) found:\n${list}`
            } catch (err: unknown) {
                const message = err instanceof Error ? err.message : String(err)
                return `Error retrieving definition: ${message}`
            }
        }

        if (action === 'references') {
            if (!context.operations.lsp?.getReferences) {
                return 'Error: LSP operations are not supported in the current environment.'
            }

            try {
                const refs: LocationItem[] = await context.operations.lsp.getReferences(
                    path,
                    targetLine,
                    targetColumn
                )

                if (!refs || refs.length === 0) {
                    return `No references found for symbol at ${path}:${targetLine}:${targetColumn}.`
                }

                const list = refs.map((r) => `- ${r.filePath}:${r.line}:${r.column}`).join('\n')
                return `Found ${refs.length} reference(s) for symbol at ${path}:${targetLine}:${targetColumn}:\n${list}`
            } catch (err: unknown) {
                const message = err instanceof Error ? err.message : String(err)
                return `Error retrieving references: ${message}`
            }
        }

        return `Unsupported action: "${action}".`
    },
}
