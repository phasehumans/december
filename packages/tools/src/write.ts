import { Tool, ToolExecuteContext } from '@december/shared'
import { Type, Static } from '@sinclair/typebox'

import { withFileMutationQueue } from './file-mutation-queue'

const writeSchema = Type.Object({
    filePath: Type.Optional(
        Type.String({ description: 'The relative or absolute path to the file.' })
    ),
    path: Type.Optional(Type.String({ description: 'Alias for filePath.' })),
    content: Type.String({ description: 'The complete file contents to write.' }),
})

export type WriteFileInput = Static<typeof writeSchema>

export const writeToolSystemPromptContribution = {
    name: 'write_file',
    snippet: 'Creates brand new files with full initial contents',
    guidelines: [
        'Use write_file EXCLUSIVELY for creating brand new files',
        'NEVER use write_file to overwrite or rewrite existing files. Always use edit_file for existing files to prevent token truncation and preserve untouched regions.',
    ],
} as const

export const WriteFileTool: Tool<WriteFileInput> = {
    name: 'write_file',
    description:
        'Creates a new file or completely overwrites an existing file with the provided content. Note: For modifying existing files, always use edit_file instead to prevent token limit truncation and preserve untouched lines.',
    inputSchema: writeSchema,
    execute: async ({ filePath, path, content }, context: ToolExecuteContext) => {
        const targetPath = filePath || path || ''
        if (!targetPath) {
            return 'Error: Path to file is required.'
        }
        return withFileMutationQueue(targetPath, async () => {
            try {
                await context.operations.fs.writeFile(targetPath, content)

                let lspNotice = ''
                if (context.operations.diagnostics?.getDiagnostics) {
                    try {
                        const diags =
                            await context.operations.diagnostics.getDiagnostics(targetPath)
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
                        // Intentionally swallowed: diagnostic feedback failure must not abort successful write
                    }
                }

                return `Successfully wrote to ${targetPath}${lspNotice}`
            } catch (e: any) {
                return `Failed to write file: ${e.message}`
            }
        })
    },
}

export const WriteTool: Tool<WriteFileInput> = {
    ...WriteFileTool,
    name: 'write',
}
