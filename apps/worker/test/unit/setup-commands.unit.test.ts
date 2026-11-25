import { describe, expect, it } from 'bun:test'

import {
    buildSetupScript,
    runSetupCommands,
    setupFailureNote,
    setupRepoFullName,
    setupResultEvent,
    setupStartEvent,
    withSetupFailure,
} from '../../src/setup-commands'

// #637 section 4: the setup commands of a repository run after the clone in a new sandbox
describe('setup commands', () => {
    describe('buildSetupScript', () => {
        const run = async (commands: string) => {
            const proc = Bun.spawn(['bash', '-c', buildSetupScript(commands)], {
                stdout: 'pipe',
                stderr: 'pipe',
            })
            const stdout = await new Response(proc.stdout).text()
            return { exitCode: await proc.exited, stdout }
        }

        it('runs every line in order', async () => {
            const result = await run('echo one\necho two')
            expect(result).toEqual({ exitCode: 0, stdout: 'one\ntwo\n' })
        })

        it('stops at the first command that fails and gives its exit code', async () => {
            const result = await run('echo before\nexit 3\necho after')
            expect(result).toEqual({ exitCode: 3, stdout: 'before\n' })
        })

        it('keeps quotes, dollar signs and here-documents as the user wrote them', async () => {
            const result = await run(
                `NAME="it's"\necho "$NAME" 'single $HOME'\ncat <<EOF\nfrom a heredoc\nEOF`
            )
            expect(result).toEqual({ exitCode: 0, stdout: "it's single $HOME\nfrom a heredoc\n" })
        })

        it('does not put the text of the commands into the shell line', () => {
            expect(buildSetupScript('echo "; rm -rf /"')).not.toContain('rm -rf')
        })
    })

    describe('setupRepoFullName', () => {
        it('is the lower case owner/name of the session repository', () => {
            expect(setupRepoFullName({ githubRepoOwner: 'Acme', githubRepoName: 'Web' })).toBe(
                'acme/web'
            )
        })

        it('is null for a session with no repository', () => {
            expect(setupRepoFullName({ githubRepoOwner: null, githubRepoName: null })).toBeNull()
            expect(setupRepoFullName({ githubRepoOwner: 'acme', githubRepoName: null })).toBeNull()
        })
    })

    describe('the events the chat shows', () => {
        it('starts as a bash tool call with the commands', () => {
            expect(setupStartEvent({ toolCallId: 'setup-1', commands: 'bun install' })).toEqual({
                type: 'ToolCallStart',
                toolCall: { id: 'setup-1', name: 'bash', input: { command: 'bun install' } },
            })
        })

        it('ends with the output when setup worked', () => {
            expect(
                setupResultEvent({
                    toolCallId: 'setup-1',
                    result: { exitCode: 0, output: 'installed 12 packages\n', timedOut: false },
                })
            ).toEqual({
                type: 'ToolCallResult',
                result: {
                    toolCallId: 'setup-1',
                    output: 'installed 12 packages\n',
                    exitCode: 0,
                },
            })
        })

        it('ends as an error when setup failed', () => {
            expect(
                setupResultEvent({
                    toolCallId: 'setup-1',
                    result: { exitCode: 127, output: 'bun: not found\n', timedOut: false },
                })
            ).toEqual({
                type: 'ToolCallResult',
                result: {
                    toolCallId: 'setup-1',
                    output: 'bun: not found\n',
                    error: 'Setup failed with exit code 127.\nbun: not found\n',
                    exitCode: 127,
                },
            })
        })
    })

    describe('setupFailureNote', () => {
        it('is empty when setup worked', () => {
            expect(
                setupFailureNote({
                    commands: 'bun install',
                    result: { exitCode: 0, output: 'ok', timedOut: false },
                })
            ).toBeNull()
        })

        it('tells the agent the commands, the exit code and the output', () => {
            expect(
                setupFailureNote({
                    commands: 'bun install\nbun run build',
                    result: { exitCode: 2, output: 'error: build failed\n', timedOut: false },
                })
            ).toBe(
                [
                    'The setup commands of this repository failed with exit code 2. The workspace may not be ready: dependencies can be missing.',
                    'Setup commands:',
                    'bun install\nbun run build',
                    'Output:',
                    'error: build failed',
                ].join('\n')
            )
        })

        it('says so when setup did not finish in time', () => {
            const note = setupFailureNote({
                commands: 'sleep 9999',
                result: { exitCode: 1, output: '', timedOut: true },
            })
            expect(note).toBe(
                [
                    'The setup commands of this repository did not finish in 10 minutes and were stopped. The workspace may not be ready: dependencies can be missing.',
                    'Setup commands:',
                    'sleep 9999',
                    'Output:',
                    '(no output)',
                ].join('\n')
            )
        })

        it('keeps only the end of a long output', () => {
            const note = setupFailureNote({
                commands: 'make',
                result: { exitCode: 1, output: `${'a'.repeat(5000)}THE END`, timedOut: false },
            })
            expect(note).toContain('THE END')
            expect(note?.length).toBeLessThan(2400)
        })
    })

    describe('withSetupFailure', () => {
        it('puts the note before the prompt of the user', () => {
            expect(withSetupFailure('fix the login page', 'Setup failed.')).toBe(
                '<setup-failed>\nSetup failed.\n</setup-failed>\n\nfix the login page'
            )
        })

        it('leaves the prompt alone when setup worked', () => {
            expect(withSetupFailure('fix the login page', null)).toBe('fix the login page')
        })
    })

    describe('runSetupCommands', () => {
        const run = async (
            execute: (
                script: string,
                onData: (chunk: string) => void
            ) => Promise<{
                exitCode: number
            }>,
            stopped: () => boolean = () => false
        ) => {
            const events: any[] = []
            const setup = runSetupCommands({
                toolCallId: 'setup-1',
                commands: 'bun install',
                execute,
                stopped,
            })
            for (;;) {
                const step = await setup.next()
                if (step.done) return { events, outcome: step.value }
                events.push(step.value)
            }
        }

        it('setup that ran to the end is done, and the chat shows its output', async () => {
            const { events, outcome } = await run(async (script, onData) => {
                expect(script).toBe(buildSetupScript('bun install'))
                onData('installed 12 packages\n')
                return { exitCode: 0 }
            })

            expect(outcome).toEqual({ completed: true, note: null })
            expect(events.map((event) => event.type)).toEqual(['ToolCallStart', 'ToolCallResult'])
            expect(events[1].result).toEqual({
                toolCallId: 'setup-1',
                output: 'installed 12 packages\n',
                exitCode: 0,
            })
        })

        it('a stop during setup leaves setup to do: it runs again on the next run', async () => {
            let stopped = false
            const { events, outcome } = await run(
                async () => {
                    stopped = true
                    return { exitCode: 137 }
                },
                () => stopped
            )

            expect(outcome).toEqual({ completed: false, note: null })
            expect(events[1]).toEqual({
                type: 'ToolCallResult',
                result: { toolCallId: 'setup-1', result: '', error: 'Stopped', stopped: true },
            })
        })

        it('setup that failed is done: the agent is told, and it does not run again', async () => {
            const { outcome } = await run(async (_script, onData) => {
                onData('bun: not found\n')
                throw Object.assign(new Error('exit status 127'), { exitCode: 127 })
            })

            expect(outcome.completed).toBe(true)
            expect(outcome.note).toContain('failed with exit code 127')
            expect(outcome.note).toContain('bun: not found')
        })

        it('setup that ran into the time limit is done, and the agent is told it was stopped', async () => {
            const { events, outcome } = await run(async () => {
                throw Object.assign(new Error('the command timed out'), { name: 'TimeoutError' })
            })

            expect(outcome.completed).toBe(true)
            expect(outcome.note).toContain('did not finish in 10 minutes and were stopped')
            expect(events[1].result.error).toContain('Setup did not finish in 10 minutes.')
        })
    })
})
