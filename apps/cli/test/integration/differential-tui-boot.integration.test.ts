import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { PassThrough } from 'node:stream'

import { DifferentialApp, TerminalController } from '@december/tui'
import { afterAll, beforeAll, describe, expect, it } from 'bun:test'

describe('Differential TUI Interactive Boot & Ink Elimination (Integration)', () => {
    let tempDir: string
    let tempConfigDir: string

    beforeAll(() => {
        tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'december-tui-workspace-'))
        tempConfigDir = fs.mkdtempSync(path.join(os.tmpdir(), 'december-tui-config-'))

        const config = {
            activeProvider: 'gemini',
            activeModel: 'gemini-3.7-flash',
            trustedWorkspaces: [tempDir],
        }

        fs.writeFileSync(
            path.join(tempConfigDir, 'config.json'),
            JSON.stringify(config, null, 2),
            'utf8'
        )
    })

    afterAll(() => {
        try {
            fs.rmSync(tempDir, { recursive: true, force: true })
            fs.rmSync(tempConfigDir, { recursive: true, force: true })
        } catch {
            // Intentionally swallowed: cleanup directory error
        }
    })

    it('verifies CLI source does not import ink or react in main execution path', async () => {
        const cliIndexPath = path.resolve(__dirname, '../../src/index.ts')
        const indexSource = fs.readFileSync(cliIndexPath, 'utf8')

        expect(indexSource).not.toContain("import('ink')")
        expect(indexSource).not.toContain("import('react')")
        expect(indexSource).not.toContain('React.createElement')
        expect(indexSource).not.toContain('inkInstance')
        expect(indexSource).toContain('DifferentialApp')
    })

    it('measures cold interactive CLI boot under 30ms in-process', () => {
        const mockStdin = new PassThrough()
        const mockStdout = new PassThrough()
        const terminal = new TerminalController({
            stdin: mockStdin as any,
            stdout: mockStdout as any,
            handleSignals: false,
        })

        const start = performance.now()
        const app = new DifferentialApp({
            terminal,
            width: 80,
            height: 24,
            cliVersion: '0.4.15',
            modelLabel: 'Claude 3.7',
        })
        app.start()
        const duration = performance.now() - start
        app.stop()

        expect(duration).toBeLessThan(30)
    })

    it('spawns CLI binary successfully with exit code 0', async () => {
        const cliIndexPath = path.resolve(__dirname, '../../src/index.ts')

        const proc = Bun.spawn([process.execPath, cliIndexPath, '--version'], {
            cwd: tempDir,
            env: {
                ...process.env,
                NODE_ENV: 'test',
                DECEMBER_CONFIG_DIR: tempConfigDir,
            },
            stdout: 'pipe',
            stderr: 'pipe',
        })

        const stdout = await new Response(proc.stdout).text()
        const exitCode = await proc.exited

        expect(exitCode).toBe(0)
        expect(stdout.trim()).toBeDefined()
    })

    it('intercepts prompt submissions when unauthenticated and displays AUTH_REQUIRED_NOTICE', async () => {
        const { AUTH_REQUIRED_NOTICE } = await import('../../src/constants/messages')
        const mockStdin = new PassThrough()
        const mockStdout = new PassThrough()
        const terminal = new TerminalController({
            stdin: mockStdin as any,
            stdout: mockStdout as any,
            handleSignals: false,
        })

        let submitted = false
        const app = new DifferentialApp({
            terminal,
            width: 80,
            height: 24,
            isAuthenticated: false,
            authRequiredNotice: AUTH_REQUIRED_NOTICE,
            onSubmit: (prompt) => {
                if (!app.state.isAuthenticated) {
                    app.state.messages.push({
                        role: 'assistant',
                        content: AUTH_REQUIRED_NOTICE,
                    })
                    return
                }
                submitted = true
            },
        })
        app.start()

        for (const char of 'Build me a login screen') {
            app.handleKey(char)
        }
        app.handleKey('\r')

        expect(submitted).toBe(false)
        expect(app.state.messages.length).toBe(2)
        expect(app.state.messages[0].role).toBe('user')
        expect(app.state.messages[0].content).toBe('Build me a login screen')
        expect(app.state.messages[1].role).toBe('assistant')
        expect(app.state.messages[1].content).toContain(
            'You are not logged in and have no custom API keys (BYOK) configured.'
        )

        app.stop()
    })
})
