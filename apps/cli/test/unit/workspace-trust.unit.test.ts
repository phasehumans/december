import os from 'node:os'
import path from 'node:path'

import { describe, it, expect, beforeEach, afterEach } from 'bun:test'

import {
    resolveWorkspaceRoot,
    isWorkspaceTrusted,
    ensureWorkspaceTrust,
} from '../../src/utils/workspace-trust'

import type { DecemberConfig } from '../../src/config'

describe('Workspace Trust Utility (Unit)', () => {
    const originalEnv = { ...process.env }
    const originalExit = process.exit
    const originalConsoleError = console.error

    beforeEach(() => {
        process.env = { ...originalEnv }
    })

    afterEach(() => {
        process.exit = originalExit
        console.error = originalConsoleError
    })

    describe('resolveWorkspaceRoot', () => {
        it('resolves the git repository root for directories within the repo', () => {
            const currentDir = process.cwd()
            const root = resolveWorkspaceRoot(currentDir)
            expect(root).toBeDefined()
            expect(typeof root).toBe('string')
            expect(path.isAbsolute(root)).toBe(true)
        })

        it('falls back to target directory when target is not a git repo', () => {
            const tmpDir = os.tmpdir()
            const resolved = resolveWorkspaceRoot(tmpDir)
            expect(resolved).toBe(path.resolve(tmpDir))
        })
    })

    describe('isWorkspaceTrusted', () => {
        it('returns true when exact workspace is in trustedWorkspaces', () => {
            const config: DecemberConfig = {
                providers: {},
                trustedWorkspaces: ['/home/testuser/code/my-project'],
            }
            expect(isWorkspaceTrusted('/home/testuser/code/my-project', config)).toBe(true)
        })

        it('returns false when workspace is not in trustedWorkspaces', () => {
            const config: DecemberConfig = {
                providers: {},
                trustedWorkspaces: ['/home/testuser/code/another-project'],
            }
            expect(isWorkspaceTrusted('/home/testuser/code/my-project', config)).toBe(false)
        })

        it('allows subdirectories to inherit trust from a trusted ancestor project', () => {
            const config: DecemberConfig = {
                providers: {},
                trustedWorkspaces: ['/home/testuser/code/my-project'],
            }
            expect(
                isWorkspaceTrusted('/home/testuser/code/my-project/packages/frontend', config)
            ).toBe(true)
        })

        it('does not allow blanket inheritance if trusted workspace is system root or home directory', () => {
            const home = os.homedir()
            const config: DecemberConfig = {
                providers: {},
                trustedWorkspaces: [home, '/'],
            }
            // Exact match returns true
            expect(isWorkspaceTrusted(home, config)).toBe(true)
            expect(isWorkspaceTrusted('/', config)).toBe(true)

            // Descendants do NOT inherit from home or root
            expect(isWorkspaceTrusted(path.join(home, 'secret-folder'), config)).toBe(false)
            expect(isWorkspaceTrusted('/var/data', config)).toBe(false)
        })
    })

    describe('ensureWorkspaceTrust in non-interactive / headless mode', () => {
        it('exits with error code 1 when workspace is untrusted and isHeadless is true', async () => {
            let exitCode: number | undefined
            const errorMessages: string[] = []

            process.exit = ((code?: number) => {
                exitCode = code ?? 0
                throw new Error(`EXIT_${code}`)
            }) as any

            console.error = ((...args: any[]) => {
                errorMessages.push(args.join(' '))
            }) as any

            const untrustedDir = path.join(os.tmpdir(), `untrusted-test-${Date.now()}`)

            await expect(
                ensureWorkspaceTrust({
                    targetDir: untrustedDir,
                    isHeadless: true,
                })
            ).rejects.toThrow('EXIT_1')

            expect(exitCode).toBe(1)
            const combinedErrors = errorMessages.join('\n')
            expect(combinedErrors).toContain('Error:')
            expect(combinedErrors).toContain('is not trusted')
            expect(combinedErrors).toContain('Please run "december" interactively first')
        })
    })
})
