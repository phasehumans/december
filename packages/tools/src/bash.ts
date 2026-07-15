import { Tool, truncateOutput, ToolExecuteContext } from '@december/shared'
import { Type, Static } from '@sinclair/typebox'

const bashSchema = Type.Object({
    command: Type.String({ description: 'The bash command to run.' }),
    timeout: Type.Optional(
        Type.Number({ description: 'Timeout in seconds (optional, no default timeout)' })
    ),
})

export type BashInput = Static<typeof bashSchema>

export const BashTool: Tool<BashInput> = {
    name: 'bash',
    description:
        'Execute a shell command. Use this tool to run commands on the terminal (e.g., building, testing, or running scripts). Long-running commands (like dev servers) will automatically detach after 3 seconds and run in the background.',
    inputSchema: bashSchema,
    execute: async ({ command, timeout }, context: ToolExecuteContext) => {
        const cwd = context.operations.env.cwd()

        const { exitCode, output, taskId } = await context.operations.bash.exec(command, cwd, {
            timeout,
            onData: (chunk: string | Buffer) => {
                context.onStream(chunk.toString())
            },
        })

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
