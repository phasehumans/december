import { Sandbox } from 'e2b'

export interface SandboxCommandOptions {
    sandboxId?: string | null
    sessionId?: string
    command: string
    cwd?: string
    timeoutMs?: number
    envs?: Record<string, string>
}

export interface SandboxCommandResult {
    exitCode: number
    stdout: string
    stderr: string
}

let mockSandboxRunner: ((options: SandboxCommandOptions) => Promise<SandboxCommandResult>) | null =
    null

export const setMockSandboxRunner = (
    runner: ((options: SandboxCommandOptions) => Promise<SandboxCommandResult>) | null
) => {
    mockSandboxRunner = runner
}

export const executeSandboxCommand = async (
    options: SandboxCommandOptions
): Promise<SandboxCommandResult> => {
    if (mockSandboxRunner) {
        return mockSandboxRunner(options)
    }

    const { sandboxId, command, cwd = '/workspace', timeoutMs = 120000, envs } = options

    const apiKey = process.env.E2B_API_KEY
    if (!apiKey || !sandboxId || sandboxId.startsWith('mock-') || process.env.NODE_ENV === 'test') {
        return {
            exitCode: 0,
            stdout: `mock-stdout for: ${command}`,
            stderr: '',
        }
    }

    const sandbox = await Sandbox.connect(sandboxId, { apiKey })
    let stdout = ''
    let stderr = ''

    const result = await sandbox.commands.run(command, {
        cwd,
        timeoutMs,
        envs,
        onStdout: (chunk: any) => {
            stdout += typeof chunk === 'string' ? chunk : chunk?.line || String(chunk)
        },
        onStderr: (chunk: any) => {
            stderr += typeof chunk === 'string' ? chunk : chunk?.line || String(chunk)
        },
    })

    return {
        exitCode: result.exitCode ?? 0,
        stdout,
        stderr,
    }
}
