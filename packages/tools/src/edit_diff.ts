import { Tool, ToolExecuteContext } from '@december/agent'
import { applyPatch } from 'diff'

export interface EditDiffInput {
    path: string
    diff: string
}

export const EditDiffTool: Tool<EditDiffInput> = {
    name: 'edit_diff',
    description:
        'Edits an existing file by applying a unified diff patch. Use standard unified diff format. This is the preferred way to refactor files.',
    inputSchema: {
        type: 'object',
        properties: {
            path: { type: 'string' },
            diff: { type: 'string', description: 'The unified diff patch string.' },
        },
        required: ['path', 'diff'],
    },
    execute: async ({ path, diff }, context: ToolExecuteContext) => {
        try {
            const content = await context.operations.fs.readFile(path)

            let formattedDiff = diff
            if (!formattedDiff.startsWith('--- ')) {
                formattedDiff = `--- a/${path}\n+++ b/${path}\n` + formattedDiff
            }

            const updated = applyPatch(content, formattedDiff)
            if (updated === false) {
                return `Error: Failed to apply unified diff patch. Ensure the context lines match the existing file exactly.`
            }

            await context.operations.fs.writeFile(path, updated)
            return `Successfully patched file: ${path}`
        } catch (error: any) {
            return `Failed to patch file: ${error.message}`
        }
    },
}
