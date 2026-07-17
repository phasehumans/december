import { Tool, truncateOutput, ToolExecuteContext } from '@december/shared'
import { Type, Static } from '@sinclair/typebox'

const readSchema = Type.Object({
    path: Type.String({ description: 'The file path to read.' }),
    startLine: Type.Optional(Type.Number({ description: 'Optional start line' })),
    endLine: Type.Optional(Type.Number({ description: 'Optional end line' })),
    noTruncate: Type.Optional(Type.Boolean({ description: 'Avoid truncating the output' })),
})

export type ReadFileInput = Static<typeof readSchema>

export const ReadFileTool: Tool<ReadFileInput> = {
    name: 'read_file',
    description:
        'Reads the contents of a file. Automatically truncates massive files to protect context limits. Use noTruncate: true if you absolutely need the full file for AST rewriting, or use startLine/endLine for pagination.',
    inputSchema: readSchema,
    execute: async ({ path, startLine, endLine, noTruncate }, context: ToolExecuteContext) => {
        try {
            const content = await context.operations.fs.readFile(path)
            const lines = content.split('\n')

            const start = startLine ? Math.max(0, startLine - 1) : 0
            const end = endLine ? Math.min(lines.length, endLine) : lines.length

            const slice = lines.slice(start, end).join('\n')

            if (noTruncate) {
                return slice
            }

            const result = truncateOutput(slice)
            return result.text
        } catch (error: any) {
            return `Failed to read file: ${error.message}`
        }
    },
}
