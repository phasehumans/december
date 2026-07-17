import { Tool, ToolExecuteContext } from '@december/shared'
import { Type, Static } from '@sinclair/typebox'

const subagentSchema = Type.Object({
    prompt: Type.String({ description: 'Detailed instructions for the subagent.' }),
})

export type SubagentInput = Static<typeof subagentSchema>

export const SubagentTool: Tool<SubagentInput> = {
    name: 'invoke_subagent',
    description:
        'Spawns a read-only research subagent to perform massive parallel research or gather information without cluttering your main context limit. Returns the final answer from the subagent.',
    inputSchema: subagentSchema,
    execute: async ({ prompt }, context: ToolExecuteContext) => {
        try {
            const result = await context.spawnSubagent(prompt)
            return result
        } catch (error: any) {
            return `Failed to invoke subagent: ${error.message}`
        }
    },
}
