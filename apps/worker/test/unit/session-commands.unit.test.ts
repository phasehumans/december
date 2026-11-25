import { describe, it, expect, mock } from 'bun:test'

import {
    buildDenyRulesHook,
    buildTurnPrompt,
    createTurnCheckpoint,
} from '../../src/session-commands'

describe('cloud session commands in the worker (#632)', () => {
    it('/learn becomes the learn prompt, with what the machine has', async () => {
        const sandbox = {
            commands: { run: mock(async () => ({ stdout: 'RULES\nrelease-runbook\n' })) },
        }
        const prompt = await buildTurnPrompt({
            prompt: '/learn always run bun test before a commit',
            planFirst: true,
            sandbox,
        })
        expect(prompt).toContain('The user ran /learn')
        expect(prompt).toContain('always run bun test before a commit')
        expect(prompt).toContain('This file exists')
        expect(prompt).toContain('release-runbook')
        // /learn is not wrapped in plan first
        expect(prompt).not.toContain('<plan-first>')
    })

    it('plan first wraps a normal prompt, and a plain prompt goes as typed', async () => {
        expect(await buildTurnPrompt({ prompt: 'fix it', planFirst: true })).toContain(
            '<plan-first>'
        )
        expect(await buildTurnPrompt({ prompt: 'fix it', planFirst: false })).toBe('fix it')
        expect(await buildTurnPrompt({ prompt: '/learnings', planFirst: false })).toBe('/learnings')
    })

    it('takes a checkpoint keyed by the user message, and never fails the turn', async () => {
        const commands: string[] = []
        const sandbox = {
            commands: {
                run: mock(async (cmd: string) => {
                    commands.push(cmd)
                    return { stdout: 'CHECKPOINT\n' }
                }),
            },
        }
        expect(await createTurnCheckpoint({ sandbox, sequence: 7 })).toBe(true)
        expect(commands[0]).toContain('refs/december/turns/7')

        const broken = { commands: { run: mock(async () => Promise.reject(new Error('gone'))) } }
        expect(await createTurnCheckpoint({ sandbox: broken, sequence: 7 })).toBe(false)
        expect(await createTurnCheckpoint({ sandbox, sequence: undefined })).toBe(false)
    })

    it('blocks a tool call that matches a deny rule', async () => {
        expect(buildDenyRulesHook([])).toBeUndefined()
        const hook = buildDenyRulesHook(['git push*', 'web_fetch'])!
        const push = await hook({
            id: '1',
            name: 'bash',
            input: JSON.stringify({ command: 'git push origin main' }),
        } as any)
        expect(push).toMatchObject({ block: true })
        expect(await hook({ id: '2', name: 'web_fetch', input: {} } as any)).toMatchObject({
            block: true,
        })
        expect(
            await hook({ id: '3', name: 'bash', input: { command: 'git status' } } as any)
        ).toBeUndefined()
    })
})
