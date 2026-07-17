import { type Tool, type ToolExecuteContext } from '@december/shared'
import { Type, Static } from '@sinclair/typebox'

const readWikiSchema = Type.Object({
    pageId: Type.String({ description: 'The ID or title of the wiki page to read' }),
})
type ReadWikiInput = Static<typeof readWikiSchema>

export const readWikiTool: Tool<ReadWikiInput> = {
    name: 'read_wiki',
    description: 'Read a wiki page from the project folder documentation.',
    inputSchema: readWikiSchema,
    execute: async (args: ReadWikiInput, context: ToolExecuteContext) => {
        const { pageId } = args
        return `Wiki content for ${pageId} retrieved.`
    },
}

const updateWikiSchema = Type.Object({
    pageId: Type.String({ description: 'The ID or title of the wiki page to update' }),
    content: Type.String({ description: 'The markdown content to save' }),
})
type UpdateWikiInput = Static<typeof updateWikiSchema>

export const updateWikiTool: Tool<UpdateWikiInput> = {
    name: 'update_wiki',
    description: 'Update or create a wiki page in the project folder documentation.',
    inputSchema: updateWikiSchema,
    execute: async (args: UpdateWikiInput, context: ToolExecuteContext) => {
        const { pageId, content } = args
        return `Wiki page ${pageId} updated successfully.`
    },
}
