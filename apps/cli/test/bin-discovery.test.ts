import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import { describe, expect, test } from 'bun:test'

import {
    compareVersions,
    inferManagerFromPath,
    forwardStaleBinary,
} from '../src/utils/bin-discovery'

describe('CLI Binary Discovery & Multi-Package-Manager Diagnostics (Unit)', () => {
    describe('inferManagerFromPath', () => {
        test('identifies bun manager from path', () => {
            expect(
                inferManagerFromPath('/home/user/.bun/bin/december', '/home/user/.bun/bin/december')
            ).toBe('bun')
        })

        test('identifies pnpm manager from path', () => {
            expect(
                inferManagerFromPath(
                    '/home/user/.local/share/pnpm/december',
                    '/home/user/.local/share/pnpm/global/5/node_modules/@trydecember/cli/dist/december.js'
                )
            ).toBe('pnpm')
        })

        test('identifies npm manager from path', () => {
            expect(
                inferManagerFromPath(
                    '/home/user/.nvm/versions/node/v22.22.3/bin/december',
                    '/home/user/.nvm/versions/node/v22.22.3/lib/node_modules/@trydecember/cli/dist/december.js'
                )
            ).toBe('npm')
        })

        test('identifies local source development repo', () => {
            expect(
                inferManagerFromPath(
                    '/home/user/code/december/apps/cli/src/index.ts',
                    '/home/user/code/december/apps/cli/src/index.ts'
                )
            ).toBe('source')
        })
    })

    describe('compareVersions', () => {
        test('correctly orders semantic versions', () => {
            expect(compareVersions('0.3.20', '0.3.19')).toBe(1)
            expect(compareVersions('0.3.19', '0.3.20')).toBe(-1)
            expect(compareVersions('0.3.20', '0.3.20')).toBe(0)
            expect(compareVersions('v0.4.0', '0.3.99')).toBe(1)
            expect(compareVersions('1.0.0', '0.9.9')).toBe(1)
        })
    })

    describe('forwardStaleBinary', () => {
        test('creates symlink pointing stale binary path to target binary', async () => {
            const tmpDir = path.join(os.tmpdir(), `december-test-forward-${Date.now()}`)
            await fs.mkdir(tmpDir, { recursive: true })

            const targetBin = path.join(tmpDir, 'target-december')
            const staleBin = path.join(tmpDir, 'stale-december')

            await fs.writeFile(targetBin, '#!/usr/bin/env node\nconsole.log("target")', {
                mode: 0o755,
            })
            await fs.writeFile(staleBin, '#!/usr/bin/env node\nconsole.log("stale")', {
                mode: 0o755,
            })

            const res = await forwardStaleBinary(staleBin, targetBin)
            expect(res.success).toBe(true)

            const realPath = await fs.realpath(staleBin)
            expect(realPath).toBe(targetBin)

            await fs.rm(tmpDir, { recursive: true, force: true })
        })
    })

    describe('isEligibleBinaryPath', () => {
        test('filters out source files and non-binary file names', async () => {
            const { isEligibleBinaryPath } = await import('../src/utils/bin-discovery')
            expect(isEligibleBinaryPath('/home/user/december/apps/cli/src/index.ts')).toBe(false)
            expect(isEligibleBinaryPath('/home/user/december/src/main.tsx')).toBe(false)
            expect(isEligibleBinaryPath('/home/user/december/types.d.ts')).toBe(false)
            expect(isEligibleBinaryPath('/home/user/december/dist/december.js.map')).toBe(false)
            expect(isEligibleBinaryPath('/home/user/.bun/bin/december')).toBe(true)
            expect(isEligibleBinaryPath('/usr/local/bin/december')).toBe(true)
            expect(isEligibleBinaryPath('C:\\npm\\december.cmd')).toBe(true)
        })
    })

    describe('resolveAndCleanStaleBinaries', () => {
        test('skips source development files and cleans stale binaries', async () => {
            const { resolveAndCleanStaleBinaries } = await import('../src/utils/bin-discovery')
            const tmpDir = path.join(os.tmpdir(), `december-test-clean-${Date.now()}`)
            await fs.mkdir(tmpDir, { recursive: true })

            const bin1Dir = path.join(tmpDir, 'bin1')
            const bin2Dir = path.join(tmpDir, 'bin2')
            await fs.mkdir(bin1Dir, { recursive: true })
            await fs.mkdir(bin2Dir, { recursive: true })

            const primaryBin = path.join(bin1Dir, 'december')
            const staleBin = path.join(bin2Dir, 'december')
            const sourceFile = path.join(tmpDir, 'src-index.ts')

            await fs.writeFile(primaryBin, '#!/usr/bin/env node\nconsole.log("primary")', {
                mode: 0o755,
            })
            await fs.writeFile(staleBin, '#!/usr/bin/env node\nconsole.log("stale")', {
                mode: 0o755,
            })
            await fs.writeFile(sourceFile, 'console.log("source code")', { mode: 0o644 })

            const res = await resolveAndCleanStaleBinaries(
                {
                    path: primaryBin,
                    realPath: primaryBin,
                    manager: 'bun',
                    version: '0.3.25',
                    isSymlink: false,
                    isActive: true,
                    isShadowed: false,
                },
                [
                    {
                        path: primaryBin,
                        realPath: primaryBin,
                        manager: 'bun',
                        version: '0.3.25',
                        isSymlink: false,
                        isActive: true,
                        isShadowed: false,
                    },
                    {
                        path: staleBin,
                        realPath: staleBin,
                        manager: 'npm',
                        version: '0.3.20',
                        isSymlink: false,
                        isActive: false,
                        isShadowed: true,
                    },
                    {
                        path: sourceFile,
                        realPath: sourceFile,
                        manager: 'source',
                        version: '0.3.25',
                        isSymlink: false,
                        isActive: false,
                        isShadowed: true,
                    },
                ]
            )

            expect(res.cleanedOrForwarded).toContain(staleBin)
            expect(res.cleanedOrForwarded).not.toContain(sourceFile)
            const sourceContent = await fs.readFile(sourceFile, 'utf-8')
            expect(sourceContent).toBe('console.log("source code")')

            await fs.rm(tmpDir, { recursive: true, force: true })
        })
    })

    describe('safe cleanup rules', () => {
        const bin = (p: string, version: string | undefined, manager: any = 'npm') => ({
            path: p,
            realPath: p,
            manager,
            version,
            isSymlink: false,
            isActive: false,
            isShadowed: true,
        })

        test('leaves same, newer and unknown versions alone', async () => {
            const { resolveAndCleanStaleBinaries } = await import('../src/utils/bin-discovery')
            const target = bin('/a/december', '0.4.19')
            const res = await resolveAndCleanStaleBinaries(target, [
                target,
                bin('/b/december', '0.4.19'),
                bin('/c/december', '0.5.0'),
                bin('/d/december', undefined),
            ])
            expect(res.cleanedOrForwarded).toEqual([])
            expect(res.failedBinaries).toEqual([])
            expect(res.skipped.map((s) => s.path)).toEqual([
                '/b/december',
                '/c/december',
                '/d/december',
            ])
        })

        test('never aligns installs to a development build', async () => {
            const { resolveAndCleanStaleBinaries } = await import('../src/utils/bin-discovery')
            const target = bin('/repo/apps/cli/dist/december', '9.9.9', 'source')
            const res = await resolveAndCleanStaleBinaries(target, [
                target,
                bin('/b/december', '0.1.0'),
            ])
            expect(res.cleanedOrForwarded).toEqual([])
            expect(res.skipped.length).toBe(1)
        })

        test('selectPrimaryBinary picks the newest release and skips unknown and source', async () => {
            const { selectPrimaryBinary } = await import('../src/utils/bin-discovery')
            expect(selectPrimaryBinary([bin('/a/december', undefined)])).toBeUndefined()
            expect(
                selectPrimaryBinary([
                    bin('/a/december', '0.4.18'),
                    bin('/b/december', '0.4.19'),
                    bin('/repo/apps/cli/dist/december', '9.9.9', 'source'),
                ])?.path
            ).toBe('/b/december')
        })
    })

    describe('findActivePathBinary', () => {
        test('returns the first december on PATH with its version', async () => {
            const { findActivePathBinary } = await import('../src/utils/bin-discovery')
            const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'dec-path-test-'))
            const first = path.join(tmpDir, 'first')
            const second = path.join(tmpDir, 'second')
            await fs.mkdir(first)
            await fs.mkdir(second)
            await fs.writeFile(path.join(first, 'december'), '#!/bin/sh\necho 0.4.19\n', {
                mode: 0o755,
            })
            await fs.writeFile(path.join(second, 'december'), '#!/bin/sh\necho 0.3.0\n', {
                mode: 0o755,
            })

            const active = await findActivePathBinary({
                envPath: [path.join(tmpDir, 'missing'), first, second].join(path.delimiter),
            })
            expect(active?.path).toBe(path.join(first, 'december'))
            expect(active?.version).toBe('0.4.19')

            await fs.rm(tmpDir, { recursive: true, force: true })
        })
    })
})
