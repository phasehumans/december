import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { PassThrough } from 'node:stream'

import { beforeEach, describe, expect, it } from 'bun:test'

import { DifferentialApp } from '../../src/renderer/app'
import { TerminalController } from '../../src/renderer/terminal'

const flush = () => new Promise((r) => setTimeout(r, 0))

describe('new slash commands', () => {
    let terminal: TerminalController

    beforeEach(() => {
        terminal = new TerminalController({
            stdin: new PassThrough() as any,
            stdout: new PassThrough() as any,
            handleSignals: false,
        })
    })

    function makeApp(options: Record<string, any> = {}) {
        const submitted: string[] = []
        const app = new DifferentialApp({
            terminal,
            width: 100,
            height: 30,
            onSubmit: (p: string) => submitted.push(p),
            ...options,
        } as any)
        return { app, submitted }
    }

    function type(app: DifferentialApp, text: string) {
        for (const ch of text) app.handleKey(ch)
    }

    describe('plan mode', () => {
        it('shift+tab toggles plan mode and plain prompts are sent as /plan', () => {
            const { app, submitted } = makeApp()
            app.handleKey('\x1b[Z')
            expect(app.state.planMode).toBe(true)
            type(app, 'refactor auth')
            app.handleKey('\r')
            expect(submitted).toEqual(['/plan refactor auth'])

            app.handleKey('\x1b[Z')
            expect(app.state.planMode).toBe(false)
            type(app, 'hello')
            app.handleKey('\r')
            expect(submitted[1]).toBe('hello')
        })

        it('/plan without a goal toggles plan mode', () => {
            const { app } = makeApp()
            app.executeCommand('plan')
            expect(app.state.planMode).toBe(true)
        })
    })

    describe('/compact', () => {
        it('passes the focus, adds a marker, and ends the busy state', async () => {
            let focusSeen: string | undefined
            const { app } = makeApp({
                onCompact: async (focus?: string) => {
                    focusSeen = focus
                    return { compacted: true, tokensBefore: 48_200, tokensAfter: 9_100 }
                },
            })
            app.executeCommand('compact keep auth details')
            expect(app.state.isStreaming).toBe(true)
            await flush()
            await flush()
            expect(focusSeen).toBe('keep auth details')
            expect(app.state.isStreaming).toBe(false)
            const marker = app.state.messages.find((m) => m.role === 'compaction')
            expect(marker?.content).toBe(
                'Conversation compacted · ~48.2k → ~9.1k tokens · focus: keep auth details'
            )
        })

        it('does not run while a turn is streaming', () => {
            let called = false
            const { app } = makeApp({
                onCompact: async () => {
                    called = true
                    return { compacted: true }
                },
            })
            app.state.isStreaming = true
            app.executeCommand('compact')
            expect(called).toBe(false)
            expect(app.state.toast?.message).toContain('Wait for the current turn')
        })
    })

    describe('/check', () => {
        it('shows checks grouped, with fixes under problems', async () => {
            const { app } = makeApp({
                onRunChecks: async () => [
                    { group: 'Auth', label: 'Active provider', status: 'fail', fix: 'Run /login' },
                    { group: 'Rules', label: 'AGENTS.md', status: 'ok', detail: '120 chars' },
                ],
            })
            app.executeCommand('check')
            expect(app.state.activeOverlay).toBe('report')
            await flush()
            const rows = app.state.report!.rows.map((r) => r.text)
            expect(rows).toEqual([
                'Auth',
                'Active provider',
                '└ Run /login',
                '',
                'Rules',
                'AGENTS.md',
            ])
            expect(app.state.report!.subtitle).toBe('1 problem, 0 warnings')
            app.handleKey('\x1b')
            expect(app.state.activeOverlay).toBe('none')
        })
    })

    describe('/permissions', () => {
        it('adds a rule from the text input and removes the selected rule', async () => {
            const changes: any[] = []
            const data = {
                allow: { global: [], project: ['bun test*'] as string[] },
                deny: { global: [], project: [] as string[] },
                toolPermission: 'always-ask' as const,
                globalPath: '~/.december/config.json',
                projectPath: '.december/settings.json',
            }
            const { app } = makeApp({
                onLoadPermissions: async () => data,
                onChangePermissionRule: async (change: any) => {
                    changes.push(change)
                },
            })
            app.executeCommand('permissions')
            await flush()
            const selected = app.state.report!.rows[app.state.report!.selectedIndex]
            expect(selected?.text).toBe('bun test*')

            app.handleKey('d')
            await flush()
            expect(changes[0]).toEqual({
                action: 'remove',
                kind: 'allow',
                scope: 'project',
                pattern: 'bun test*',
            })

            await flush()
            app.handleKey('a')
            expect(app.state.report!.input?.prompt).toBe('Add project allow rule:')
            type(app, 'npm run lint')
            app.handleKey('\r')
            await flush()
            expect(changes[1]).toEqual({
                action: 'add',
                kind: 'allow',
                scope: 'project',
                pattern: 'npm run lint',
            })
        })

        it('tab switches to deny rules', async () => {
            const { app } = makeApp({
                onLoadPermissions: async () => ({
                    allow: { global: [], project: [] },
                    deny: { global: ['git push*'], project: [] },
                    toolPermission: 'always-proceed',
                    globalPath: 'g',
                    projectPath: 'p',
                }),
            })
            app.executeCommand('permissions')
            await flush()
            app.handleKey('\t')
            await flush()
            expect(app.state.report!.tabs?.find((t) => t.active)?.label).toBe('Deny')
            expect(app.state.report!.rows.some((r) => r.text === 'git push*')).toBe(true)
        })
    })

    describe('report text input', () => {
        it('masks secrets and esc cancels the input before closing', async () => {
            const { app } = makeApp()
            app.openReport({
                kind: 'github',
                title: 'GitHub Action',
                rows: [],
                isLoading: false,
                footer: [],
                input: { prompt: 'KEY:', value: '', mask: true, onSubmit: () => {} },
            })
            type(app, 'sk-123')
            expect(app.state.report!.input?.value).toBe('sk-123')
            app.handleKey('\x1b')
            expect(app.state.report!.input).toBeUndefined()
            expect(app.state.activeOverlay).toBe('report')
            app.handleKey('\x1b')
            expect(app.state.activeOverlay).toBe('none')
        })
    })

    describe('/keybindings', () => {
        it('creates the file with defaults and opens it', async () => {
            const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'december-tui-keys-'))
            const file = path.join(dir, 'keybindings.json')
            const opened: string[] = []
            const { app } = makeApp({
                keybindingsPath: file,
                onOpenEditor: async (p: string) => {
                    opened.push(p)
                },
            })
            app.executeCommand('keybindings')
            await flush()
            expect(opened).toEqual([file])
            expect(JSON.parse(fs.readFileSync(file, 'utf-8')).bindings.submit).toBe('enter')
            fs.rmSync(dir, { recursive: true, force: true })
        })

        it('applies a user binding from the file', () => {
            const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'december-tui-keys-'))
            const file = path.join(dir, 'keybindings.json')
            fs.writeFileSync(file, JSON.stringify({ bindings: { togglePlanMode: 'ctrl+g' } }))
            const { app } = makeApp({ keybindingsPath: file })
            app.handleKey('\x07')
            expect(app.state.planMode).toBe(true)
            app.handleKey('\x1b[Z')
            expect(app.state.planMode).toBe(true)
            fs.rmSync(dir, { recursive: true, force: true })
        })
    })

    describe('/diff session filter (#618)', () => {
        const sessionFile = {
            path: 'src/edited-by-december.ts',
            additions: 2,
            deletions: 0,
            status: 'modified' as const,
            diff: '@@ -1 +1,3 @@\n a\n+b\n+c',
        }

        async function openDiff(app: DifferentialApp) {
            app.executeCommand('diff')
            expect(app.state.isDiffLoading).toBe(true)
            for (let i = 0; i < 200 && app.state.isDiffLoading; i++) {
                await new Promise((r) => setTimeout(r, 10))
            }
            expect(app.state.isDiffLoading).toBe(false)
        }

        it('opens on this session when it changed files, and s switches views', async () => {
            const { app } = makeApp({ onLoadSessionChanges: async () => [sessionFile] })
            await openDiff(app)
            expect(app.state.diffScope).toBe('session')
            expect(app.state.diffFiles).toEqual([sessionFile])

            app.handleKey('s')
            expect(app.state.diffScope).toBe('all')
            expect(app.state.diffFiles).toBe(app.state.diffAllFiles)

            app.handleKey('s')
            expect(app.state.diffScope).toBe('session')
            expect(app.state.diffFiles).toEqual([sessionFile])
            expect(app.state.diffSelectedIndex).toBe(0)
        })

        it('opens on all changes when the session has no snapshot or no changes', async () => {
            for (const result of [null, []]) {
                const { app } = makeApp({ onLoadSessionChanges: async () => result })
                await openDiff(app)
                expect(app.state.diffScope).toBe('all')
                app.handleKey('s')
                expect(app.state.diffScope).toBe('session')
                expect(app.state.diffFiles).toEqual([])
            }
        })

        it('falls back to all changes when loading the session changes fails', async () => {
            const { app } = makeApp({
                onLoadSessionChanges: async () => {
                    throw new Error('no git')
                },
            })
            await openDiff(app)
            expect(app.state.diffScope).toBe('all')
            expect(app.state.diffSessionFiles).toBeNull()
        })
    })
})
