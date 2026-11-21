import { Tool, truncateOutput, ToolExecuteContext } from '@december/shared'
import { Type, Static } from '@sinclair/typebox'

const bashSchema = Type.Object({
    command: Type.Optional(Type.String({ description: 'The bash command to run.' })),
    cmd: Type.Optional(Type.String({ description: 'Alias for command.' })),
    timeout: Type.Optional(
        Type.Number({ description: 'Timeout in seconds (optional, no default timeout)' })
    ),
    run_in_background: Type.Optional(
        Type.Boolean({
            description:
                'Start the command as a background task and return at once with its task id. Use for dev servers, watchers, and long builds. You are told when it finishes.',
        })
    ),
})

export type BashInput = Static<typeof bashSchema>

export const BashTool: Tool<BashInput> = {
    name: 'bash',
    description:
        'Execute a shell command. Use this tool to run commands on the terminal (e.g., building, testing, or running scripts). Set run_in_background for dev servers, watchers, and other long-running commands. A foreground command that runs too long also moves to the background on its own. Use manage_task to read background output or stop a task.',
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

        const runInBackground = input.run_in_background === true
        const { exitCode, output, taskId } = await context.operations.bash.exec(command, cwd, {
            timeout: input.timeout,
            waitMsBeforeAsync: 20_000,
            runInBackground,
            onData: (chunk: string | Buffer) => {
                context.onStream(chunk.toString())
            },
        } as any)

        let msg = ''
        if (exitCode === null && runInBackground) {
            return `Started in background as ${taskId}. You will be told when it finishes. Use manage_task with action "output" to read new output, or "kill" to stop it.`
        } else if (exitCode === null) {
            msg = `[Auto-Backgrounded] Task ID: ${taskId}. Command is still running in the background. You will be told when it finishes. Use manage_task with action "output" to read new output, or "kill" to stop it.\n`
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
