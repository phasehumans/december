import { Tool, truncateOutput, ToolExecuteContext } from '@december/shared'

export interface BashInput {
    command: string
}

export const BashTool: Tool<BashInput> = {
    name: 'bash',
    description:
        'Execute a shell command. Use this tool to run commands on the terminal (e.g., building, testing, or running scripts). Long-running commands (like dev servers) will automatically detach after 3 seconds and run in the background.',
    inputSchema: {
        type: 'object',
        properties: {
            command: { type: 'string', description: 'The bash command to run.' },
        },
        required: ['command'],
    },
    execute: async ({ command }, context: ToolExecuteContext) => {
        const { exitCode, output, taskId } = await context.operations.bash.exec(
            command,
            (chunk) => {
                context.onStream(chunk)
            }
        )

        let msg = ''
        if (exitCode === null) {
            msg = `[Auto-Backgrounded] Task ID: ${taskId}. Command is still running in the background. Use manage_task tool to check status or kill it.\n`
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
