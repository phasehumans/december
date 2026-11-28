import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { afterEach, beforeEach, describe, expect, test } from 'bun:test'

import {
    findBlockingResult,
    hookMatches,
    isSafeHookMatcher,
    isToolHookEvent,
    loadUserHooks,
    parseUserHooksData,
    parseUserHooksFile,
    runUserHooks,
    validateUserHooksFile,
    type HookCommandRunner,
} from '../../src/user-hooks'
import { appendHookContext, attachUserHooks } from '../../src/user-hooks-agent'

let dir: string

beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'december-hooks-'))
})

afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true })
})

function writeHooks(name: string, data: unknown): string {
    const file = path.join(dir, name)
    fs.writeFileSync(file, typeof data === 'string' ? data : JSON.stringify(data))
    return file
}

describe('user hooks config', () => {
    test('parses the Claude Code shape', () => {
        const file = writeHooks('hooks.json', {
            hooks: {
                PreToolUse: [
                    {
                        matcher: 'bash|edit_file',
                        hooks: [{ type: 'command', command: 'echo hi', timeout: 5 }],
                    },
                ],
                Stop: [{ hooks: [{ type: 'command', command: 'true' }] }],
            },
        })
        const { hooks, problems } = parseUserHooksFile(file, 'project')
        expect(problems).toEqual([])
        expect(hooks).toHaveLength(2)
        expect(hooks[0]).toMatchObject({
            event: 'PreToolUse',
            matcher: 'bash|edit_file',
            command: 'echo hi',
            timeoutSeconds: 5,
            source: 'project',
        })
        expect(hooks[1]!.timeoutSeconds).toBe(60)
    })

    test('reports unknown events, bad matchers, and missing commands', () => {
        const file = writeHooks('hooks.json', {
            hooks: {
                BeforeEverything: [],
                PreToolUse: [{ matcher: '(', hooks: [{ command: 'x' }] }],
                Stop: [{ hooks: [{ type: 'command' }] }],
            },
        })
        const problems = validateUserHooksFile(file)
        expect(problems.some((p) => p.includes('unknown event "BeforeEverything"'))).toBe(true)
        expect(problems.some((p) => p.includes('not a valid regex'))).toBe(true)
        expect(problems.some((p) => p.includes('has no "command"'))).toBe(true)
    })

    test('a missing file has no hooks and no problems', () => {
        expect(validateUserHooksFile(path.join(dir, 'nope.json'))).toEqual([])
    })

    test('project hooks load only when included (trusted workspace)', () => {
        const globalPath = writeHooks('global.json', {
            hooks: { Stop: [{ hooks: [{ command: 'echo global' }] }] },
        })
        const projectPath = writeHooks('project.json', {
            hooks: { Stop: [{ hooks: [{ command: 'echo project' }] }] },
        })
        expect(loadUserHooks({ globalPath, projectPath, includeProject: false })).toHaveLength(1)
        expect(loadUserHooks({ globalPath, projectPath, includeProject: true })).toHaveLength(2)
    })

    test('matchers are anchored regexes on the tool name', () => {
        const hook = {
            event: 'PreToolUse' as const,
            matcher: 'bash|edit_.*',
            command: 'x',
            timeoutSeconds: 1,
            source: 'global' as const,
            sourcePath: '',
        }
        expect(hookMatches(hook, 'PreToolUse', 'bash')).toBe(true)
        expect(hookMatches(hook, 'PreToolUse', 'edit_file')).toBe(true)
        expect(hookMatches(hook, 'PreToolUse', 'my_bash_tool')).toBe(false)
        expect(hookMatches({ ...hook, matcher: '' }, 'PreToolUse', 'anything')).toBe(true)
        expect(hookMatches(hook, 'PostToolUse', 'bash')).toBe(false)
    })
})

describe.skipIf(process.platform === 'win32')('running hooks', () => {
    test('sends the event as JSON on stdin and exit code 2 blocks', async () => {
        const out = path.join(dir, 'payload.json')
        const file = writeHooks('hooks.json', {
            hooks: {
                PreToolUse: [
                    {
                        matcher: 'bash',
                        hooks: [{ command: `cat > "${out}"; echo "no pushes" >&2; exit 2` }],
                    },
                ],
            },
        })
        const hooks = parseUserHooksFile(file, 'global').hooks
        const results = await runUserHooks(
            hooks,
            'PreToolUse',
            { tool_name: 'bash', tool_input: { command: 'git push' } },
            { cwd: dir, toolName: 'bash' }
        )
        const blocking = findBlockingResult(results)
        expect(blocking?.stderr).toBe('no pushes')
        const payload = JSON.parse(fs.readFileSync(out, 'utf-8'))
        expect(payload).toMatchObject({
            hook_event_name: 'PreToolUse',
            tool_name: 'bash',
            tool_input: { command: 'git push' },
            cwd: dir,
        })
    })

    test('Notification hooks get the reason and message (#617)', async () => {
        const out = path.join(dir, 'notification.json')
        const file = writeHooks('hooks.json', {
            hooks: { Notification: [{ hooks: [{ command: `cat > "${out}"` }] }] },
        })
        const { hooks, problems } = parseUserHooksFile(file, 'global')
        expect(problems).toEqual([])
        expect(hookMatches(hooks[0]!, 'Notification')).toBe(true)
        await runUserHooks(
            hooks,
            'Notification',
            { reason: 'tool_permission', message: 'December needs your approval to run a tool' },
            { cwd: dir }
        )
        expect(JSON.parse(fs.readFileSync(out, 'utf-8'))).toEqual({
            hook_event_name: 'Notification',
            cwd: dir,
            reason: 'tool_permission',
            message: 'December needs your approval to run a tool',
        })
    })

    test('a hook that runs too long is stopped', async () => {
        const file = writeHooks('hooks.json', {
            hooks: { Stop: [{ hooks: [{ command: 'sleep 5', timeout: 0.2 }] }] },
        })
        const [result] = await runUserHooks(
            parseUserHooksFile(file, 'global').hooks,
            'Stop',
            {},
            {
                cwd: dir,
            }
        )
        expect(result!.timedOut).toBe(true)
        expect(findBlockingResult([result!])).toBeUndefined()
    })
})

describe('hooks shared with cloud sessions', () => {
    test('parseUserHooksData reads parsed json like a file', () => {
        const { hooks, problems } = parseUserHooksData(
            { hooks: { Stop: [{ hooks: [{ command: 'npm test' }] }], Nope: [] } },
            'global',
            'account'
        )
        expect(hooks).toEqual([
            {
                event: 'Stop',
                matcher: '',
                command: 'npm test',
                timeoutSeconds: 60,
                source: 'global',
                sourcePath: 'account',
            },
        ])
        expect(problems[0]).toContain('unknown event "Nope"')
        expect(parseUserHooksData(null, 'global', 'x').problems).toEqual([
            'missing a "hooks" object',
        ])
    })

    test('runUserHooks uses a given runner instead of spawning here', async () => {
        const seen: Array<{ command: string; payload: Record<string, unknown>; cwd: string }> = []
        const runCommand: HookCommandRunner = async (hook, payload, cwd) => {
            seen.push({ command: hook.command, payload, cwd })
            return { hook, exitCode: 2, stdout: '', stderr: 'blocked in sandbox', timedOut: false }
        }
        const hooks = parseUserHooksData(
            { hooks: { PreToolUse: [{ matcher: 'bash', hooks: [{ command: 'check' }] }] } },
            'global',
            'account'
        ).hooks
        const results = await runUserHooks(
            hooks,
            'PreToolUse',
            { tool_name: 'bash' },
            {
                cwd: '/workspace',
                toolName: 'bash',
                runCommand,
            }
        )
        expect(seen).toEqual([
            {
                command: 'check',
                payload: { hook_event_name: 'PreToolUse', cwd: '/workspace', tool_name: 'bash' },
                cwd: '/workspace',
            },
        ])
        expect(findBlockingResult(results)?.stderr).toBe('blocked in sandbox')
    })

    test('attachUserHooks blocks a tool through the runner and keeps earlier hooks', async () => {
        const hooks = parseUserHooksData(
            { hooks: { PreToolUse: [{ hooks: [{ command: 'x' }] }] } },
            'global',
            'account'
        ).hooks
        const agent: any = { hooks: { beforeToolCall: async () => undefined } }
        attachUserHooks(agent, {
            listHooks: () => hooks,
            cwd: '/w',
            runCommand: async (hook) => ({
                hook,
                exitCode: 2,
                stdout: '',
                stderr: 'no',
                timedOut: false,
            }),
        })
        expect(await agent.hooks.beforeToolCall({ name: 'bash', input: {} })).toEqual({
            block: true,
            reason: 'no',
        })
        expect(appendHookContext('p', 'ctx')).toBe('p\n\n<hook_context>\nctx\n</hook_context>')
        expect(appendHookContext('p')).toBe('p')
    })

    test('isSafeHookMatcher and isToolHookEvent', () => {
        expect(isSafeHookMatcher('bash|edit_file')).toBe(true)
        expect(isSafeHookMatcher('(a+)+')).toBe(false)
        expect(isSafeHookMatcher('[')).toBe(false)
        expect(isToolHookEvent('PostToolUse')).toBe(true)
        expect(isToolHookEvent('Stop')).toBe(false)
    })
})
