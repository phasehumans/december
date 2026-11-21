import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { afterEach, beforeEach, describe, expect, test } from 'bun:test'

import {
    findBlockingResult,
    hookMatches,
    loadUserHooks,
    parseUserHooksFile,
    runUserHooks,
    validateUserHooksFile,
} from '../../src/user-hooks'

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
