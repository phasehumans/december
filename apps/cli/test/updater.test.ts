import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { afterAll, beforeAll, describe, expect, test } from 'bun:test'

import {
    derivePrefixFromPackageRoot,
    detectInstall,
    detectInstallMethod,
    getUpdateCommand,
    performCliUpdate,
} from '../src/utils/updater'

import type { DecemberBinaryInfo } from '../src/utils/bin-discovery'

const NO_SCRIPT = '/nonexistent/dec-upd-test/bin/december'

type ExecCall = { cmd: string }
type ExecReply = { error?: Error | null; stdout?: string; stderr?: string }

/**
 * exec mock that answers per command prefix and records every call.
 */
const makeExec = (replies: Record<string, ExecReply>, calls: ExecCall[] = []) => {
    const fn: any = (cmd: string, _opts: any, callback: any) => {
        calls.push({ cmd })
        const key = Object.keys(replies).find((k) => cmd.startsWith(k))
        const reply = key ? replies[key]! : {}
        callback(reply.error ?? null, reply.stdout ?? '', reply.stderr ?? '')
    }
    return { fn, calls }
}

const binary = (overrides: Partial<DecemberBinaryInfo>): DecemberBinaryInfo => ({
    path: '/usr/local/bin/december',
    realPath: '/usr/local/bin/december',
    manager: 'npm',
    version: '1.0.0',
    isSymlink: false,
    isActive: true,
    isShadowed: false,
    ...overrides,
})

const writePackage = (root: string, version: string) => {
    fs.mkdirSync(path.join(root, 'dist'), { recursive: true })
    fs.writeFileSync(
        path.join(root, 'package.json'),
        JSON.stringify({ name: '@trydecember/cli', version })
    )
    fs.writeFileSync(path.join(root, 'dist', 'december.js'), '#!/usr/bin/env node\n')
    return path.join(root, 'dist', 'december.js')
}

let tmp: string
let npmPrefix: string
let npmScript: string
let npmPackageRoot: string

beforeAll(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'dec-upd-test-'))
    npmPrefix = path.join(tmp, 'nvm', 'v22')
    npmPackageRoot = path.join(npmPrefix, 'lib', 'node_modules', '@trydecember', 'cli')
    npmScript = writePackage(npmPackageRoot, '0.4.18')
})

afterAll(() => {
    fs.rmSync(tmp, { recursive: true, force: true })
})

describe('detectInstall', () => {
    test('respects a valid config installMethod', () => {
        for (const m of ['npm', 'bun', 'pnpm', 'yarn', 'npx', 'curl', 'source'] as const) {
            expect(detectInstallMethod({ configInstallMethod: m, argv1: NO_SCRIPT })).toBe(m)
        }
    })

    test('detects local source repository execution', () => {
        expect(
            detectInstallMethod({ argv1: '/home/user/code/december/apps/cli/src/index.ts' })
        ).toBe('source')
    })

    test('detects npx and bunx ephemeral execution', () => {
        expect(
            detectInstallMethod({
                argv1: '/home/user/.npm/_npx/123/node_modules/@trydecember/cli/dist/december.js',
            })
        ).toBe('npx')
        expect(
            detectInstallMethod({
                argv1: '/tmp/bunx-1000-@trydecember/cli@latest/node_modules/@trydecember/cli/dist/december.js',
            })
        ).toBe('npx')
    })

    test('detects the retired standalone binary', () => {
        expect(
            detectInstallMethod({
                execPath: '/home/user/.december/bin/december',
                argv1: '/home/user/.december/bin/december',
            })
        ).toBe('curl')
    })

    test('finds the package root and npm prefix of a POSIX npm global install', () => {
        const info = detectInstall({ argv1: npmScript, execPath: '/usr/bin/node' })
        expect(info.method).toBe('npm')
        expect(info.packageRoot).toBe(npmPackageRoot)
        expect(info.prefix).toBe(npmPrefix)
    })

    test('detects bun and pnpm global installs of the npm package', () => {
        const bunRoot = path.join(
            tmp,
            '.bun',
            'install',
            'global',
            'node_modules',
            '@trydecember',
            'cli'
        )
        const pnpmRoot = path.join(
            tmp,
            'pnpm',
            'global',
            '5',
            'node_modules',
            '@trydecember',
            'cli'
        )
        const bun = detectInstall({
            argv1: writePackage(bunRoot, '0.4.18'),
            execPath: '/usr/bin/bun',
        })
        const pnpm = detectInstall({
            argv1: writePackage(pnpmRoot, '0.4.18'),
            execPath: '/usr/bin/node',
        })
        expect(bun.method).toBe('bun')
        expect(bun.prefix).toBeUndefined()
        expect(pnpm.method).toBe('pnpm')
    })

    test('derives the npm prefix for POSIX and Windows layouts', () => {
        expect(derivePrefixFromPackageRoot('/opt/node/lib/node_modules/@trydecember/cli')).toBe(
            '/opt/node'
        )
        expect(
            derivePrefixFromPackageRoot(
                '/c/Users/me/AppData/Roaming/npm/node_modules/@trydecember/cli'
            )
        ).toBe('/c/Users/me/AppData/Roaming/npm')
        expect(derivePrefixFromPackageRoot('/somewhere/else/cli')).toBeUndefined()
    })
})

describe('getUpdateCommand', () => {
    test('defaults to the latest dist-tag', () => {
        expect(getUpdateCommand('npm').command).toBe('npm install -g @trydecember/cli@latest')
        expect(getUpdateCommand('bun').command).toBe('bun add -g @trydecember/cli@latest')
        expect(getUpdateCommand('pnpm').command).toBe('pnpm add -g @trydecember/cli@latest')
        expect(getUpdateCommand('yarn').command).toBe('yarn global add @trydecember/cli@latest')
        expect(getUpdateCommand('npx').command).toBe('npx @trydecember/cli@latest')
    })

    test('pins an exact version and an npm prefix', () => {
        expect(getUpdateCommand('npm', { version: '0.4.19', prefix: '/p q' }).command).toBe(
            'npm install -g @trydecember/cli@0.4.19 --prefix "/p q"'
        )
    })

    test('migrates the retired standalone binary to npm', () => {
        const info = getUpdateCommand('curl', { version: '0.4.19' })
        expect(info.command).toBe('npm install -g @trydecember/cli@0.4.19')
        expect(info.description).toContain('retired')
    })

    test('returns rebuild instructions for source checkouts', () => {
        expect(getUpdateCommand('source').command).toBe(
            'git pull && bun install && bun --cwd apps/cli run build'
        )
    })
})

describe('performCliUpdate', () => {
    test('source and npx return without running anything', async () => {
        const { fn, calls } = makeExec({})
        const source = await performCliUpdate({ configInstallMethod: 'source', execFn: fn })
        const npx = await performCliUpdate({ configInstallMethod: 'npx', execFn: fn })
        expect(source.method).toBe('source')
        expect(npx.method).toBe('npx')
        expect(calls.length).toBe(0)
    })

    test('stops before installing when the registry cannot be reached', async () => {
        const { fn, calls } = makeExec({})
        const result = await performCliUpdate({
            configInstallMethod: 'npm',
            argv1: NO_SCRIPT,
            force: true,
            fetchLatestFn: async () => null,
            execFn: fn,
        })
        expect(result.success).toBe(false)
        expect(result.offline).toBe(true)
        expect(calls.length).toBe(0)
    })

    test('returns the up-to-date fast path without installing', async () => {
        const { fn, calls } = makeExec({})
        const result = await performCliUpdate({
            configInstallMethod: 'npm',
            argv1: NO_SCRIPT,
            currentVersion: '0.4.19',
            fetchLatestFn: async () => '0.4.19',
            execFn: fn,
        })
        expect(result.alreadyUpToDate).toBe(true)
        expect(calls.length).toBe(0)
    })

    test('checkOnly reports an available update without installing', async () => {
        const { fn, calls } = makeExec({})
        const result = await performCliUpdate({
            configInstallMethod: 'npm',
            argv1: NO_SCRIPT,
            currentVersion: '0.4.18',
            checkOnly: true,
            fetchLatestFn: async () => '0.4.19',
            execFn: fn,
        })
        expect(result.success).toBe(true)
        expect(result.alreadyUpToDate).toBe(false)
        expect(result.targetVersion).toBe('0.4.19')
        expect(calls.length).toBe(0)
    })

    test('treats a pre-release as older than its release', async () => {
        const { fn, calls } = makeExec({})
        await performCliUpdate({
            configInstallMethod: 'bun',
            argv1: NO_SCRIPT,
            currentVersion: '0.5.0-beta.1',
            fetchLatestFn: async () => '0.5.0',
            execFn: fn,
            skipVerification: true,
        })
        expect(calls.map((c) => c.cmd)).toEqual(['bun add -g @trydecember/cli@0.5.0'])
    })

    test('installs the exact version into the running prefix and verifies it', async () => {
        const { fn, calls } = makeExec({ 'npm prefix -g': { stdout: `${npmPrefix}\n` } })
        let successCalled = false
        const result = await performCliUpdate({
            configInstallMethod: 'npm',
            argv1: npmScript,
            currentVersion: '0.4.18',
            fetchLatestFn: async () => '0.4.19',
            execFn: fn,
            readInstalledVersionFn: async () => '0.4.19',
            resolvePathBinaryFn: async () =>
                binary({
                    path: path.join(npmPrefix, 'bin', 'december'),
                    realPath: npmScript,
                    version: '0.4.19',
                }),
            onSuccess: () => {
                successCalled = true
            },
        })
        expect(calls.map((c) => c.cmd)).toEqual([
            'npm prefix -g',
            'npm install -g @trydecember/cli@0.4.19',
        ])
        expect(result.success).toBe(true)
        expect(result.verified).toBe(true)
        expect(result.installedVersion).toBe('0.4.19')
        expect(result.installPath).toBe(npmPackageRoot)
        expect(successCalled).toBe(true)
    })

    test('adds --prefix when the npm on PATH belongs to another prefix', async () => {
        const { fn, calls } = makeExec({ 'npm prefix -g': { stdout: '/usr/local\n' } })
        await performCliUpdate({
            configInstallMethod: 'npm',
            argv1: npmScript,
            currentVersion: '0.4.18',
            fetchLatestFn: async () => '0.4.19',
            execFn: fn,
            skipVerification: true,
        })
        expect(calls[1]?.cmd).toBe(`npm install -g @trydecember/cli@0.4.19 --prefix "${npmPrefix}"`)
    })

    test('fails verification when the package on disk was not updated', async () => {
        const { fn } = makeExec({ 'npm prefix -g': { stdout: npmPrefix } })
        const result = await performCliUpdate({
            configInstallMethod: 'npm',
            argv1: npmScript,
            currentVersion: '0.4.18',
            fetchLatestFn: async () => '0.4.19',
            execFn: fn,
            readInstalledVersionFn: async () => '0.4.18',
            resolvePathBinaryFn: async () => null,
        })
        expect(result.success).toBe(false)
        expect(result.error).toContain('still has v0.4.18')
    })

    test('reports a shadowing install on PATH without touching it', async () => {
        const { fn } = makeExec({ 'npm prefix -g': { stdout: npmPrefix } })
        const result = await performCliUpdate({
            configInstallMethod: 'npm',
            argv1: npmScript,
            currentVersion: '0.4.18',
            fetchLatestFn: async () => '0.4.19',
            execFn: fn,
            readInstalledVersionFn: async () => '0.4.19',
            resolvePathBinaryFn: async () =>
                binary({
                    path: '/home/user/.bun/bin/december',
                    realPath:
                        '/home/user/.bun/install/global/node_modules/@trydecember/cli/dist/december.js',
                    manager: 'bun',
                    version: '0.4.10',
                }),
        })
        expect(result.success).toBe(false)
        expect(result.shadowingBinary?.path).toBe('/home/user/.bun/bin/december')
        expect(result.legacyBinaryPath).toBeUndefined()
        expect(result.error).toContain('runs v0.4.10')
    })

    test('points legacy binary users at the old binary after migrating to npm', async () => {
        const { fn } = makeExec({})
        const result = await performCliUpdate({
            configInstallMethod: 'curl',
            argv1: NO_SCRIPT,
            currentVersion: '0.3.0',
            fetchLatestFn: async () => '0.4.19',
            execFn: fn,
            resolvePathBinaryFn: async () =>
                binary({
                    path: '/home/user/.december/bin/december',
                    realPath: '/home/user/.december/bin/december',
                    manager: 'curl',
                    version: '0.3.0',
                }),
        })
        expect(result.success).toBe(false)
        expect(result.legacyBinaryPath).toBe('/home/user/.december/bin/december')
    })

    test('suggests sudo for a system npm prefix', async () => {
        const eacces = new Error('EACCES: permission denied')
        const { fn } = makeExec({
            'npm prefix -g': { stdout: '/usr/local' },
            'npm install': { error: eacces, stderr: 'EACCES: permission denied' },
        })
        const result = await performCliUpdate({
            configInstallMethod: 'npm',
            argv1: NO_SCRIPT,
            homeDir: '/home/user',
            currentVersion: '0.4.18',
            fetchLatestFn: async () => '0.4.19',
            execFn: fn,
        })
        expect(result.isPermissionError).toBe(true)
        expect(result.sudoCmd).toBe('sudo npm install -g @trydecember/cli@0.4.19')
        expect(result.permissionHint).toBeUndefined()
    })

    test('never suggests sudo for a prefix inside the home folder', async () => {
        const eacces = new Error('EACCES: permission denied')
        const { fn } = makeExec({
            'npm prefix -g': { stdout: '/home/user/.nvm/versions/node/v22' },
            'npm install': { error: eacces, stderr: 'EACCES: permission denied' },
        })
        const result = await performCliUpdate({
            configInstallMethod: 'npm',
            argv1: NO_SCRIPT,
            homeDir: '/home/user',
            currentVersion: '0.4.18',
            fetchLatestFn: async () => '0.4.19',
            execFn: fn,
        })
        expect(result.sudoCmd).toBeUndefined()
        expect(result.permissionHint).toContain('chown')
    })

    test('never suggests sudo for bun', async () => {
        const { fn } = makeExec({
            'bun add': { error: new Error('EACCES'), stderr: 'EACCES: permission denied' },
        })
        const result = await performCliUpdate({
            configInstallMethod: 'bun',
            argv1: NO_SCRIPT,
            currentVersion: '0.4.18',
            fetchLatestFn: async () => '0.4.19',
            execFn: fn,
        })
        expect(result.sudoCmd).toBeUndefined()
        expect(result.permissionHint).toContain('do not use sudo')
    })

    test('reports a missing package manager clearly', async () => {
        const { fn } = makeExec({
            'bun add': { error: new Error('exit 127'), stderr: 'sh: 1: bun: not found' },
        })
        const result = await performCliUpdate({
            configInstallMethod: 'bun',
            argv1: NO_SCRIPT,
            currentVersion: '0.4.18',
            fetchLatestFn: async () => '0.4.19',
            execFn: fn,
        })
        expect(result.toolMissing).toBe(true)
        expect(result.error).toContain('bun was not found')
    })

    test('does not mistake a registry 404 for a missing package manager', async () => {
        const { fn } = makeExec({
            'npm prefix -g': { stdout: '/usr/local' },
            'npm install': {
                error: new Error('exit 1'),
                stderr: 'npm error 404 Not Found - GET https://registry.npmjs.org/@trydecember%2fcli',
            },
        })
        const result = await performCliUpdate({
            configInstallMethod: 'npm',
            argv1: NO_SCRIPT,
            currentVersion: '0.4.18',
            fetchLatestFn: async () => '0.4.19',
            execFn: fn,
        })
        expect(result.toolMissing).toBeUndefined()
        expect(result.error).toContain('404')
    })
})
