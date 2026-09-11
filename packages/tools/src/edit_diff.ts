import { Tool, ToolExecuteContext } from '@december/shared'
import { Type, Static } from '@sinclair/typebox'
import { applyPatch } from 'diff'

import { withFileMutationQueue } from './file-mutation-queue'
import { applyFuzzyPatchTS } from './fuzzy_patch'

const diffSchema = Type.Object({
    path: Type.String(),
    diff: Type.String({ description: 'The unified diff patch string.' }),
})

export type EditDiffInput = Static<typeof diffSchema>

export const editDiffToolSystemPromptContribution = {
    name: 'edit_diff',
    snippet: 'Applies unified diff patches to modify existing files',
    guidelines: [
        'Use edit_diff when you have a full unified diff hunk with accurate context lines',
        'If diff application fails, fall back to edit_file with precise search and replace',
    ],
} as const

export const EditDiffTool: Tool<EditDiffInput> = {
    name: 'edit_diff',
    description:
        'Edits an existing file by applying a unified diff patch. Use standard unified diff format. This is the preferred way to refactor files.',
    inputSchema: diffSchema,
    execute: async ({ path, diff }, context: ToolExecuteContext) => {
        return withFileMutationQueue(path, async () => {
            try {
                const content = await context.operations.fs.readFile(path)

                let formattedDiff = diff.replace(/\r\n/g, '\n')
                if (!formattedDiff.startsWith('--- ')) {
                    formattedDiff = `--- a/${path}\n+++ b/${path}\n` + formattedDiff
                }

                const normalizedContent = content.replace(/\r\n/g, '\n')

                // Try pure TypeScript fuzzy patcher first
                let updated: string | boolean | null = applyFuzzyPatchTS(
                    normalizedContent,
                    formattedDiff
                )

                // Fall back to npm diff applyPatch if fuzzy patch fails
                if (updated === null) {
                    updated = applyPatch(normalizedContent, formattedDiff)
                }

                if (updated === false || updated === null) {
                    return `Error: Failed to apply unified diff patch to '${path}'. Ensure context lines match the existing file exactly, or use edit_file instead.`
                }

                await context.operations.fs.writeFile(path, updated)

                let lspNotice = ''
                if (context.operations.diagnostics?.getDiagnostics) {
                    try {
                        const diags = await context.operations.diagnostics.getDiagnostics(path)
                        if (typeof diags === 'string' && diags.trim()) {
                            lspNotice = `\n\nLSP errors detected in this file, please fix:\n${diags.trim()}`
                        } else if (Array.isArray(diags) && diags.length > 0) {
                            const formatted = diags
                                .map((d) => {
                                    const loc = d.line
                                        ? `:${d.line}${d.column ? `:${d.column}` : ''}`
                                        : ''
                                    return `${d.filePath}${loc} - [${d.severity ?? 'error'}] ${d.message}${d.source ? ` (${d.source})` : ''}`
                                })
                                .join('\n')
                            lspNotice = `\n\nLSP errors detected in this file, please fix:\n${formatted}`
                        }
                    } catch {
                        // Intentionally swallowed: diagnostic feedback failure must not abort patch
                    }
                }

                return `Successfully patched file: ${path}${lspNotice}`
            } catch (error: any) {
                return `Failed to patch file: ${error.message}`
            }
        })
    },
}
