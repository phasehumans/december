import { Tool, ToolExecuteContext } from '@december/shared'

import { Type, Static } from '@sinclair/typebox'

const editSchema = Type.Object({
    path: Type.String(),
    targetContent: Type.String(),
    replacementContent: Type.String(),
})

export type EditFileInput = Static<typeof editSchema>

export const EditFileTool: Tool<EditFileInput> = {
    name: 'edit_file',
    description:
        'Edits an existing file by searching for a specific block of text (targetContent) and replacing it exactly with replacementContent. targetContent must match exactly.',
    inputSchema: editSchema,
    execute: async ({ path, targetContent, replacementContent }, context: ToolExecuteContext) => {
        try {
            const content = await context.operations.fs.readFile(path)
            if (!content.includes(targetContent)) {
                return `Error: targetContent not found in file. Ensure exact whitespace and line breaks match.`
            }
            const updated = content.replace(targetContent, replacementContent)
            await context.operations.fs.writeFile(path, updated)
            return `Successfully edited file: ${path}`
        } catch (error: any) {
            return `Failed to edit file: ${error.message}`
        }
    },
}
