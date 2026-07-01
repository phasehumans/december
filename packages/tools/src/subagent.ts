import { Tool, ToolExecuteContext } from '@december/agent'

export interface SubagentInput {
    prompt: string
}

export const SubagentTool: Tool<SubagentInput> = {
    name: 'invoke_subagent',
    description:
        'Spawns a read-only research subagent to perform massive parallel research or gather information without cluttering your main context limit. Returns the final answer from the subagent.',
    inputSchema: {
        type: 'object',
        properties: {
            prompt: { type: 'string', description: 'Detailed instructions for the subagent.' },
        },
        required: ['prompt'],
    },
    execute: async ({ prompt }, context: ToolExecuteContext) => {
        try {
            const result = await context.spawnSubagent(prompt)
            return result
        } catch (error: any) {
            return `Failed to invoke subagent: ${error.message}`
        }
    },
}
