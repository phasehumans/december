import { Tool, truncateOutput, ToolExecuteContext } from '@december/agent'

export interface BashInput {
    command: string
}

export const BashTool: Tool<BashInput> = {
    name: 'bash',
    description:
        'Executes a bash command. If the command runs longer than 3 seconds (e.g. dev servers), it will automatically detach, run in the background, and return control to the agent.',
    inputSchema: {
        type: 'object',
        properties: {
            command: { type: 'string', description: 'The bash command to run.' },
        },
        required: ['command'],
    },
    execute: async ({ command }, context: ToolExecuteContext) => {
        const { exitCode, output } = await context.operations.bash.exec(command, (chunk) => {
            context.onStream(chunk)
        })

        let msg = ''
        if (exitCode === null) {
            msg = `[Auto-Backgrounded] Command is still running in the background.\n`
        } else if (exitCode !== 0) {
            msg = `Command failed with exit code ${exitCode}:\n`
        }

        const formattedOutput = truncateOutput(output).text
        if (formattedOutput) {
            msg += formattedOutput
        }

        return msg.trim() || 'Command executed successfully with no output.'
    },
}
