import { joinRepoFullName } from '@december/shared'

import { isTimeoutError, stoppedToolResult } from './run-stop'
/**
 * Setup commands of a repository (#637 section 4).
 *
 * The user saves them in the sandbox settings (RepositorySetting.setupCommands). They run
 * in the workspace after the clone of a new sandbox, not on a resume. The chat shows them
 * as a command, and a failed setup does not stop the session: the agent is told.
 *
 * Nothing here talks to the sandbox or the database.
 */

/** setup is stopped after this long */
export const SETUP_TIMEOUT_MS = 10 * 60 * 1000

// the end of the output that the agent and the chat get
const OUTPUT_TAIL_CHARS = 2000

export interface SetupResult {
    exitCode: number
    output: string
    /** the commands did not finish in SETUP_TIMEOUT_MS */
    timedOut: boolean
}

/**
 * The shell line that runs the commands as one bash script. The script stops at the first
 * command that fails. The text travels as base64, so nothing in it can change the line.
 */
export const buildSetupScript = (commands: string): string => {
    const encoded = Buffer.from(commands, 'utf8').toString('base64')
    return [
        'f=$(mktemp)',
        `echo ${encoded} | base64 -d > "$f"`,
        'bash -e "$f"',
        'code=$?',
        'rm -f "$f"',
        'exit $code',
    ].join('\n')
}

/** the key of the RepositorySetting row of a session: lower case owner/name */
export const setupRepoFullName = (session: {
    githubRepoOwner: string | null
    githubRepoName: string | null
}): string | null =>
    joinRepoFullName(session.githubRepoOwner, session.githubRepoName)?.toLowerCase() ?? null

const tail = (output: string): string =>
    output.length > OUTPUT_TAIL_CHARS ? output.slice(-OUTPUT_TAIL_CHARS) : output

const failureLine = (result: SetupResult): string =>
    result.timedOut
        ? 'did not finish in 10 minutes and were stopped'
        : `failed with exit code ${result.exitCode}`

/** setup starts: the chat shows it as a command, like a command of the agent */
export const setupStartEvent = (data: { toolCallId: string; commands: string }) => ({
    type: 'ToolCallStart',
    toolCall: { id: data.toolCallId, name: 'bash', input: { command: data.commands } },
})

/** setup ended: the command in the chat gets its output, and an error when it failed */
export const setupResultEvent = (data: { toolCallId: string; result: SetupResult }) => {
    const { toolCallId, result } = data
    const output = tail(result.output)
    const failed = result.timedOut || result.exitCode !== 0
    return {
        type: 'ToolCallResult',
        result: {
            toolCallId,
            output,
            ...(failed
                ? {
                      error: result.timedOut
                          ? `Setup did not finish in 10 minutes.\n${output}`
                          : `Setup failed with exit code ${result.exitCode}.\n${output}`,
                  }
                : {}),
            exitCode: result.exitCode,
        },
    }
}

/** what the agent is told when setup failed, and why. null when setup worked */
export const setupFailureNote = (data: {
    commands: string
    result: SetupResult
}): string | null => {
    const { commands, result } = data
    if (!result.timedOut && result.exitCode === 0) return null
    return [
        `The setup commands of this repository ${failureLine(result)}. The workspace may not be ready: dependencies can be missing.`,
        'Setup commands:',
        commands,
        'Output:',
        tail(result.output).trim() || '(no output)',
    ].join('\n')
}

/** the prompt of the turn, with the setup failure before it */
export const withSetupFailure = (prompt: string, note: string | null): string =>
    note ? `<setup-failed>\n${note}\n</setup-failed>\n\n${prompt}` : prompt

export interface RunSetupCommands {
    toolCallId: string
    commands: string
    /**
     * Runs the script in the workspace, with the time limit and the stop of the run. Gives
     * the exit code. It fails for an exit code that is not 0 and for the time limit.
     */
    execute: (script: string, onData: (chunk: string) => void) => Promise<{ exitCode: number }>
    /** true when the run was stopped */
    stopped: () => boolean
}

export interface SetupOutcome {
    /**
     * Setup ran to the end (it worked, failed or ran into the time limit): it does not run
     * again. False after a stop: setup is still to do, and the next run starts it again.
     */
    completed: boolean
    /** what the agent is told when setup failed. null when it worked or was stopped */
    note: string | null
}

/**
 * Runs the setup commands of a repository. The events are for the chat: setup shows as a
 * command of the agent.
 */
export async function* runSetupCommands(
    data: RunSetupCommands
): AsyncGenerator<Record<string, unknown>, SetupOutcome, undefined> {
    const { toolCallId, commands, execute, stopped } = data
    yield setupStartEvent({ toolCallId, commands })

    let output = ''
    let exitCode: number
    let timedOut = false
    try {
        const ran = await execute(buildSetupScript(commands), (chunk) => {
            output += chunk
        })
        exitCode = ran.exitCode
    } catch (error: any) {
        // E2B throws for an exit code that is not 0 and for the time limit
        timedOut = isTimeoutError(error)
        exitCode = typeof error?.exitCode === 'number' ? error.exitCode : 1
        if (!output) output = error?.stderr || error?.message || ''
    }

    if (stopped()) {
        // the stop of the run killed setup: the command closes as stopped, like a tool call
        yield stoppedToolResult(toolCallId)
        return { completed: false, note: null }
    }

    const result = { exitCode, output, timedOut }
    yield setupResultEvent({ toolCallId, result })
    return { completed: true, note: setupFailureNote({ commands, result }) }
}
