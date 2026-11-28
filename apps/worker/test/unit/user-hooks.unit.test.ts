import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { attachUserHooks, MAX_STOP_HOOK_CONTINUES } from '@december/shared'
import { describe, expect, it } from 'bun:test'

import { applySecretsToSandbox } from '../../src/sandbox-secrets'
import { createSandboxHookRunner, questionText, toUserHooks } from '../../src/user-hooks'

const row = (extra: Record<string, unknown> = {}) => ({
    event: 'PreToolUse',
    matcher: 'bash',
    command: 'echo ok',
    timeoutSeconds: 30,
    enabled: true,
    ...extra,
})

describe('toUserHooks', () => {
    it('keeps the saved order and gives the shared hook type', () => {
        expect(
            toUserHooks([row(), row({ event: 'Stop', matcher: '', command: 'npm test' })])
        ).toEqual([
            {
                event: 'PreToolUse',
                matcher: 'bash',
                command: 'echo ok',
                timeoutSeconds: 30,
                source: 'global',
                sourcePath: 'account',
            },
            {
                event: 'Stop',
                matcher: '',
                command: 'npm test',
                timeoutSeconds: 30,
                source: 'global',
                sourcePath: 'account',
            },
        ])
    })

    it('leaves out hooks that are off, unknown, empty or have an unsafe matcher, and caps the time', () => {
        const hooks = toUserHooks([
            row({ enabled: false }),
            row({ event: 'OnBoot' }),
            row({ command: '   ' }),
            row({ matcher: '(a+)+' }),
            row({ timeoutSeconds: 9999 }),
            row({ timeoutSeconds: 0 }),
        ])
        expect(hooks.map((hook) => hook.timeoutSeconds)).toEqual([600, 60])
    })
})

describe('questionText', () => {
    it('reads the question of an ask_question call', () => {
        expect(questionText({ question: 'Which branch?' })).toBe('Which branch?')
        expect(questionText('{"question":"Deploy now?"}')).toBe('Deploy now?')
        expect(questionText('plain text')).toBe('plain text')
        expect(questionText(null)).toBe('December asks a question.')
    })
})

/**
 * A sandbox whose commands run here with sh, like the e2b sandbox: a command that exits
 * with a code that is not 0 throws an error that holds the result, and a time limit throws
 * a TimeoutError.
 */
const localSandbox = (root: string) => {
    const runs: Array<{ command: string; options: any }> = []
    const sandbox = {
        files: {
            write: async (file: string, data: string) => {
                fs.writeFileSync(path.join(root, path.basename(file)), data)
            },
            remove: async () => {},
        },
        commands: {
            run: async (command: string, options: any) => {
                runs.push({ command, options })
                // the payload file lives in /tmp of the sandbox; here it is in the test folder
                const local = command.replace(
                    /\/tmp\/(december-hook-[\w-]+\.json)/g,
                    path.join(root, '$1')
                )
                const result = spawnSync('sh', ['-c', local], {
                    cwd: options.cwd,
                    env: { ...process.env, ...options.envs },
                    timeout: options.timeoutMs,
                    encoding: 'utf8',
                })
                if (result.error && (result.error as any).code === 'ETIMEDOUT') {
                    throw Object.assign(new Error('command timed out'), { name: 'TimeoutError' })
                }
                const done = {
                    exitCode: result.status ?? 1,
                    stdout: result.stdout,
                    stderr: result.stderr,
                }
                if (done.exitCode !== 0) throw Object.assign(new Error('exit'), done)
                return done
            },
        },
    }
    return { sandbox, runs }
}

const hook = (command: string, extra: Record<string, unknown> = {}) =>
    toUserHooks([row({ command, ...extra })])[0]!

describe('createSandboxHookRunner', () => {
    it('runs the command in the sandbox with the event as json on stdin', async () => {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hook-run-'))
        const { sandbox, runs } = localSandbox(dir)
        try {
            const run = createSandboxHookRunner(() => sandbox)
            const result = await run(
                hook('cat; echo " $DECEMBER_HOOK_EVENT $DECEMBER_PROJECT_DIR"'),
                { hook_event_name: 'PreToolUse', tool_name: 'bash' },
                dir
            )
            expect(result.exitCode).toBe(0)
            expect(result.stdout).toBe(
                `{"hook_event_name":"PreToolUse","tool_name":"bash"} PreToolUse ${dir}`
            )
            expect(runs[0]?.options).toMatchObject({ cwd: dir, timeoutMs: 30_000 })
            // the payload file is removed after the command
            expect(fs.readdirSync(dir)).toEqual([])
        } finally {
            fs.rmSync(dir, { recursive: true, force: true })
        }
    })

    it('gives the exit code and stderr of a command that fails', async () => {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hook-run-'))
        const { sandbox } = localSandbox(dir)
        try {
            const result = await createSandboxHookRunner(() => sandbox)(
                hook('echo nope >&2; exit 2'),
                {},
                dir
            )
            expect(result).toMatchObject({ exitCode: 2, stderr: 'nope', timedOut: false })
        } finally {
            fs.rmSync(dir, { recursive: true, force: true })
        }
    })

    it('reports a time out', async () => {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hook-run-'))
        const { sandbox } = localSandbox(dir)
        try {
            const short = { ...hook('sleep 3'), timeoutSeconds: 0.2 }
            const result = await createSandboxHookRunner(() => sandbox)(short, {}, dir)
            expect(result).toMatchObject({ timedOut: true, exitCode: null })
        } finally {
            fs.rmSync(dir, { recursive: true, force: true })
        }
    })

    it('passes the secrets of the run, and keeps the command out of the shell parsing', async () => {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hook-run-'))
        const { sandbox, runs } = localSandbox(dir)
        try {
            // the secrets are attached to this sandbox object; its write and run do nothing here
            const { write } = sandbox.files
            const { run } = sandbox.commands
            sandbox.files.write = async () => {}
            sandbox.commands.run = async () => ({}) as any
            await applySecretsToSandbox({ sandbox, secrets: [{ key: 'API_TOKEN', value: 'tok' }] })
            sandbox.files.write = write
            sandbox.commands.run = run
            runs.length = 0

            const result = await createSandboxHookRunner(() => sandbox)(
                hook('echo "it\'s $API_TOKEN"'),
                {},
                dir
            )
            expect(result.stdout).toBe("it's tok")
            expect(runs[0]?.options.envs.API_TOKEN).toBe('tok')
            expect(runs[0]?.command.startsWith(`sh -c 'echo "it'\\''s $API_TOKEN"'`)).toBe(true)
        } finally {
            fs.rmSync(dir, { recursive: true, force: true })
        }
    })

    it('fails softly with no sandbox, and when a command cannot start', async () => {
        expect(await createSandboxHookRunner(() => null)(hook('echo'), {}, '/')).toMatchObject({
            exitCode: null,
            error: 'the sandbox is not ready',
        })
        const broken = {
            files: { write: async () => {} },
            commands: {
                run: async () => {
                    throw new Error('sandbox gone')
                },
            },
        }
        expect(await createSandboxHookRunner(() => broken)(hook('echo'), {}, '/')).toMatchObject({
            error: 'the hook could not run in the sandbox',
        })
        const noWrite = {
            files: {
                write: async () => {
                    throw new Error('disk full')
                },
            },
            commands: { run: async () => ({}) },
        }
        expect(await createSandboxHookRunner(() => noWrite)(hook('echo'), {}, '/')).toMatchObject({
            error: 'the event could not be written to the sandbox',
        })
    })
})

describe('account hooks on the agent (shared rules, sandbox runner)', () => {
    const setup = (rows: Array<Record<string, unknown>>) => {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hook-agent-'))
        const { sandbox, runs } = localSandbox(dir)
        const agent: any = {}
        const hooks = toUserHooks(rows.map((r) => row(r)))
        const controller = attachUserHooks(agent, {
            listHooks: () => hooks,
            cwd: dir,
            runCommand: createSandboxHookRunner(() => sandbox),
        })
        return {
            dir,
            agent,
            controller,
            runs,
            done: () => fs.rmSync(dir, { recursive: true, force: true }),
        }
    }

    it('PreToolUse exit 2 blocks the matching tool with stderr as the reason', async () => {
        const { agent, done } = setup([{ command: 'echo "no shell" >&2; exit 2' }])
        try {
            expect(await agent.hooks.beforeToolCall({ name: 'bash', input: {} })).toEqual({
                block: true,
                reason: 'no shell',
            })
            expect(
                await agent.hooks.beforeToolCall({ name: 'read_file', input: {} })
            ).toBeUndefined()
        } finally {
            done()
        }
    })

    it('PostToolUse exit 2 sends stderr back with the result', async () => {
        const { agent, done } = setup([
            { event: 'PostToolUse', matcher: '', command: 'echo "lint failed" >&2; exit 2' },
        ])
        try {
            const after = await agent.hooks.afterToolCall(
                { name: 'edit_file', input: {} },
                { result: 'saved' }
            )
            expect(after.result).toBe('saved\n\n[PostToolUse hook feedback]\nlint failed')
        } finally {
            done()
        }
    })

    it('Stop exit 2 keeps the agent going a few times at most', async () => {
        const { agent, done } = setup([
            { event: 'Stop', matcher: '', command: 'echo "tests fail" >&2; exit 2' },
        ])
        try {
            for (let i = 0; i < MAX_STOP_HOOK_CONTINUES; i++) {
                expect(await agent.hooks.beforeStop()).toEqual({
                    continue: true,
                    message: '[Stop hook] tests fail',
                })
            }
            expect(await agent.hooks.beforeStop()).toBeUndefined()
        } finally {
            done()
        }
    })

    it('UserPromptSubmit blocks or adds context; SessionStart output joins the next prompt', async () => {
        const { controller, done } = setup([
            { event: 'SessionStart', matcher: '', command: 'echo "branch main"' },
            {
                event: 'UserPromptSubmit',
                matcher: '',
                command: 'grep -q secret && { echo "no secrets" >&2; exit 2; } || echo "ok to go"',
            },
        ])
        try {
            await controller.runSessionStart('startup')
            expect(await controller.runPromptSubmit('fix the bug')).toEqual({
                context: 'branch main\n\nok to go',
            })
            expect(await controller.runPromptSubmit('print the secret')).toEqual({
                block: 'no secrets',
            })
        } finally {
            done()
        }
    })

    it('Notification hooks get the reason and the message', async () => {
        const { controller, runs, done } = setup([
            { event: 'Notification', matcher: '', command: 'cat > /dev/null' },
        ])
        try {
            await controller.runNotification('turn_finished', 'December finished the turn.')
            expect(runs).toHaveLength(1)
        } finally {
            done()
        }
    })
})
