import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { afterEach, beforeEach, describe, expect, it } from 'bun:test'

import { MAX_STOP_HOOK_CONTINUES, setupUserHooks } from '../src/utils/user-hooks-setup'

let root: string
let workspace: string
let configDir: string
const previousConfigDir = process.env.DECEMBER_CONFIG_DIR

function writeJson(file: string, data: unknown) {
    fs.mkdirSync(path.dirname(file), { recursive: true })
    fs.writeFileSync(file, JSON.stringify(data))
}

function command(cmd: string) {
    return [{ hooks: [{ type: 'command', command: cmd }] }]
}

beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'december-hooks-setup-'))
    workspace = path.join(root, 'project')
    configDir = path.join(root, 'config')
    fs.mkdirSync(workspace, { recursive: true })
    process.env.DECEMBER_CONFIG_DIR = configDir
    writeJson(path.join(configDir, 'config.json'), { providers: {} })
})

afterEach(() => {
    if (previousConfigDir === undefined) delete process.env.DECEMBER_CONFIG_DIR
    else process.env.DECEMBER_CONFIG_DIR = previousConfigDir
    fs.rmSync(root, { recursive: true, force: true })
})

describe.skipIf(process.platform === 'win32')('setupUserHooks', () => {
    it('PreToolUse exit code 2 blocks the tool call with stderr as the reason', async () => {
        writeJson(path.join(configDir, 'hooks.json'), {
            hooks: {
                PreToolUse: [
                    { matcher: 'bash', hooks: [{ command: 'echo "no shell today" >&2; exit 2' }] },
                ],
            },
        })
        const agent: any = {}
        await setupUserHooks(agent, { workspaceDir: workspace })
        const blocked = await agent.hooks.beforeToolCall({ id: '1', name: 'bash', input: {} })
        expect(blocked).toEqual({ block: true, reason: 'no shell today' })
        const allowed = await agent.hooks.beforeToolCall({ id: '2', name: 'read_file', input: {} })
        expect(allowed).toBeUndefined()
    })

    it('keeps existing agent hooks working', async () => {
        writeJson(path.join(configDir, 'hooks.json'), { hooks: {} })
        const calls: string[] = []
        const agent: any = {
            hooks: {
                beforeToolCall: async () => {
                    calls.push('existing')
                    return { block: true, reason: 'existing rule' }
                },
            },
        }
        await setupUserHooks(agent, { workspaceDir: workspace })
        const res = await agent.hooks.beforeToolCall({ id: '1', name: 'bash', input: {} })
        expect(calls).toEqual(['existing'])
        expect(res).toEqual({ block: true, reason: 'existing rule' })
    })

    it('Stop exit code 2 keeps the turn going, at most a few times in a row', async () => {
        writeJson(path.join(configDir, 'hooks.json'), {
            hooks: { Stop: command('echo "run the tests first" >&2; exit 2') },
        })
        const agent: any = {}
        const controller = await setupUserHooks(agent, { workspaceDir: workspace })
        for (let i = 0; i < MAX_STOP_HOOK_CONTINUES; i++) {
            const res = await agent.hooks.beforeStop()
            expect(res).toEqual({ continue: true, message: '[Stop hook] run the tests first' })
        }
        expect(await agent.hooks.beforeStop()).toBeUndefined()

        // a new prompt resets the count
        await controller.runPromptSubmit('next')
        expect((await agent.hooks.beforeStop())?.continue).toBe(true)
    })

    it('UserPromptSubmit can block a prompt or add context to it', async () => {
        writeJson(path.join(configDir, 'hooks.json'), {
            hooks: {
                UserPromptSubmit: command(
                    'input=$(cat); case "$input" in *secret*) echo "no secrets" >&2; exit 2;; esac; echo "branch: main"'
                ),
                SessionStart: command('echo "session context"'),
            },
        })
        const controller = await setupUserHooks({} as any, { workspaceDir: workspace })
        await controller.runSessionStart('startup')
        expect(await controller.runPromptSubmit('show me the secret')).toEqual({
            block: 'no secrets',
        })
        expect(await controller.runPromptSubmit('hello')).toEqual({
            context: 'session context\n\nbranch: main',
        })
        expect(await controller.runPromptSubmit('again')).toEqual({ context: 'branch: main' })
    })

    it('project hooks do not run in an untrusted workspace', async () => {
        writeJson(path.join(workspace, '.december', 'hooks.json'), {
            hooks: { PreToolUse: command('exit 2') },
        })
        const agent: any = {}
        const controller = await setupUserHooks(agent, { workspaceDir: workspace })
        expect(controller.projectHooksSkipped()).toBe(true)
        expect(controller.listHooks()).toEqual([])
        expect(
            await agent.hooks.beforeToolCall({ id: '1', name: 'bash', input: {} })
        ).toBeUndefined()
    })

    it('project hooks run once the workspace is trusted', async () => {
        writeJson(path.join(configDir, 'config.json'), {
            providers: {},
            trustedWorkspaces: [fs.realpathSync(workspace)],
        })
        writeJson(path.join(workspace, '.december', 'hooks.json'), {
            hooks: { PreToolUse: command('echo blocked >&2; exit 2') },
        })
        const agent: any = {}
        const controller = await setupUserHooks(agent, { workspaceDir: workspace })
        expect(controller.projectHooksSkipped()).toBe(false)
        expect(
            (await agent.hooks.beforeToolCall({ id: '1', name: 'bash', input: {} }))?.block
        ).toBe(true)
    })
})
