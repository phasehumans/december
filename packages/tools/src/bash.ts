import { Tool, truncateOutput, ToolExecuteContext } from '@december/shared'
import { Type, Static } from '@sinclair/typebox'

const bashSchema = Type.Object({
    command: Type.Optional(Type.String({ description: 'The bash command to run.' })),
    cmd: Type.Optional(Type.String({ description: 'Alias for command.' })),
    timeout: Type.Optional(
        Type.Number({ description: 'Timeout in seconds (optional, no default timeout)' })
    ),
})

export type BashInput = Static<typeof bashSchema>

export const BashTool: Tool<BashInput> = {
    name: 'bash',
    description:
        'Execute a shell command. Use this tool to run commands on the terminal (e.g., building, testing, or running scripts). Long-running commands (like dev servers) will automatically detach and run in the background.',
    inputSchema: bashSchema,
    prepareArguments: (args: any) => {
        if (!args || typeof args !== 'object') return args
        if (args.cmd && !args.command) {
            return { ...args, command: args.cmd }
        }
        return args
    },
    execute: async (input: BashInput, context: ToolExecuteContext) => {
        const command = input.command || (input as any)?.cmd
        if (!command || typeof command !== 'string' || !command.trim()) {
            return 'Error: The "command" argument is required and must be a non-empty string.'
        }
        const cwd = context.operations.env.cwd()

        const { exitCode, output, taskId } = await context.operations.bash.exec(command, cwd, {
            timeout: input.timeout,
            waitMsBeforeAsync: 20_000,
            onData: (chunk: string | Buffer) => {
                context.onStream(chunk.toString())
            },
        } as any)

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
