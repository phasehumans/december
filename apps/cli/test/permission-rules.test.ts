import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { afterEach, beforeEach, describe, expect, it } from 'bun:test'

import {
    addPermissionRule,
    cleanupLegacyAllowRules,
    findAllowRule,
    findDenyRule,
    getPermissionTarget,
    readPermissionRules,
    removePermissionRule,
} from '../src/utils/permission-rules'

let root: string
let workspace: string
let configDir: string
const previousConfigDir = process.env.DECEMBER_CONFIG_DIR

beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'december-perm-'))
    workspace = path.join(root, 'project')
    configDir = path.join(root, 'config')
    fs.mkdirSync(workspace, { recursive: true })
    fs.mkdirSync(configDir, { recursive: true })
    process.env.DECEMBER_CONFIG_DIR = configDir
})

afterEach(() => {
    if (previousConfigDir === undefined) delete process.env.DECEMBER_CONFIG_DIR
    else process.env.DECEMBER_CONFIG_DIR = previousConfigDir
    fs.rmSync(root, { recursive: true, force: true })
})

const bash = (command: string) => ({ name: 'bash', input: { command } })

describe('permission rules', () => {
    it('builds the match target from the tool call', () => {
        expect(getPermissionTarget(bash(' bun test '))).toBe('bun test')
        expect(getPermissionTarget({ name: 'run_command', input: { CommandLine: 'ls' } })).toBe(
            'ls'
        )
        expect(getPermissionTarget({ name: 'edit_file', input: { path: 'src/a.ts' } })).toBe(
            'edit_file: src/a.ts'
        )
        expect(getPermissionTarget({ name: 'web_fetch', input: { url: 'x' } })).toBe('web_fetch')
    })

    it('adds and removes rules per scope without touching other settings', () => {
        const projectFile = path.join(workspace, '.december', 'settings.json')
        fs.mkdirSync(path.dirname(projectFile), { recursive: true })
        fs.writeFileSync(projectFile, JSON.stringify({ thinkingLevel: 'deep' }))

        addPermissionRule('allow', 'project', 'bun test*', workspace)
        addPermissionRule('allow', 'project', 'bun test*', workspace)
        addPermissionRule('deny', 'global', 'git push*', workspace)

        expect(readPermissionRules(workspace)).toEqual({
            allow: { global: [], project: ['bun test*'] },
            deny: { global: ['git push*'], project: [] },
        })
        expect(JSON.parse(fs.readFileSync(projectFile, 'utf-8')).thinkingLevel).toBe('deep')

        removePermissionRule('allow', 'project', 'bun test*', workspace)
        const after = JSON.parse(fs.readFileSync(projectFile, 'utf-8'))
        expect(after.approvedTools).toBeUndefined()
        expect(after.thinkingLevel).toBe('deep')
    })

    it('refuses to rewrite a settings file that is not valid JSON', () => {
        const projectFile = path.join(workspace, '.december', 'settings.json')
        fs.mkdirSync(path.dirname(projectFile), { recursive: true })
        fs.writeFileSync(projectFile, '{ broken')
        expect(() => addPermissionRule('allow', 'project', 'ls', workspace)).toThrow(
            'not valid JSON'
        )
        expect(fs.readFileSync(projectFile, 'utf-8')).toBe('{ broken')
    })

    it('matches exact rules, prefixes, and tool names', () => {
        addPermissionRule('allow', 'project', 'bun test*', workspace)
        addPermissionRule('allow', 'global', 'web_fetch', workspace)
        expect(findAllowRule(bash('bun test packages/tui'), workspace)).toBe('bun test*')
        expect(findAllowRule(bash('bun install'), workspace)).toBeUndefined()
        expect(findAllowRule({ name: 'web_fetch', input: {} }, workspace)).toBe('web_fetch')
    })

    it('never approves every shell command from a bare "bash" allow rule', () => {
        addPermissionRule('allow', 'global', 'bash', workspace)
        expect(findAllowRule(bash('rm -rf build'), workspace)).toBeUndefined()
    })

    it('a bare "bash" deny rule blocks every shell command', () => {
        addPermissionRule('deny', 'project', 'bash', workspace)
        expect(findDenyRule(bash('ls'), workspace)).toBe('bash')
        expect(findDenyRule({ name: 'read_file', input: { path: 'a' } }, workspace)).toBeUndefined()
    })

    it('cleans up bare tool names saved by the old "always" button', () => {
        fs.writeFileSync(
            path.join(configDir, 'config.json'),
            JSON.stringify({
                providers: {},
                approvedTools: ['bun test', 'bash', 'edit_file: a.ts', 'edit_file', 'web_fetch'],
            })
        )
        const removed = cleanupLegacyAllowRules(workspace)
        expect(removed.sort()).toEqual(['bash', 'edit_file'])
        expect(readPermissionRules(workspace).allow.global).toEqual([
            'bun test',
            'edit_file: a.ts',
            'web_fetch',
        ])
        const config = JSON.parse(fs.readFileSync(path.join(configDir, 'config.json'), 'utf-8'))
        expect(config.providers).toEqual({})
    })
})
