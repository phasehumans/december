import { describe, expect, test, mock } from 'bun:test'

import { COMMANDS } from '../../src/components/command-menu/commands'

describe('/update command action', () => {
    test('should define update command forwarded to chat screen', async () => {
        const updateCmd = COMMANDS.find((c) => c.name === 'update')
        expect(updateCmd).toBeDefined()
        expect(updateCmd?.value).toBe('/update')
        expect(updateCmd?.description).toBe('Update to the latest version')

        const mockContext: any = {
            toast: {
                show: () => {},
            },
            agent: {
                saveContext: mock(async () => {}),
            },
            exit: () => {},
        }

        expect(() => updateCmd?.action(mockContext)).not.toThrow()
    })
})

describe('/clear & /new commands', () => {
    test('clearContext and resetChat are called on /clear', async () => {
        const clearCmd = COMMANDS.find((c) => c.name === 'clear')
        expect(clearCmd).toBeDefined()

        const mockClear = mock(async () => {})
        const mockReset = mock(() => {})
        const toastMsgs: any[] = []

        await clearCmd?.action({
            agent: { clearContext: mockClear },
            resetChat: mockReset,
            toast: { show: (m: any) => toastMsgs.push(m) },
        } as any)

        expect(mockClear).toHaveBeenCalledTimes(1)
        expect(mockReset).toHaveBeenCalledTimes(1)
        expect(toastMsgs[0]?.message).toContain('Cleared conversation')
    })

    test('newContext and resetChat are called on /new', async () => {
        const newCmd = COMMANDS.find((c) => c.name === 'new')
        expect(newCmd).toBeDefined()

        const mockNew = mock(async () => {})
        const mockReset = mock(() => {})
        const toastMsgs: any[] = []

        await newCmd?.action({
            agent: { newContext: mockNew },
            resetChat: mockReset,
            toast: { show: (m: any) => toastMsgs.push(m) },
        } as any)

        expect(mockNew).toHaveBeenCalledTimes(1)
        expect(mockReset).toHaveBeenCalledTimes(1)
        expect(toastMsgs[0]?.message).toContain('Started a new conversation')
    })
})

describe('/fork command', () => {
    test('forkContext is called on /fork', async () => {
        const forkCmd = COMMANDS.find((c) => c.name === 'fork')
        expect(forkCmd).toBeDefined()

        const mockFork = mock(async () => 'session-fork-123')
        const toastMsgs: any[] = []

        await forkCmd?.action({
            agent: { forkContext: mockFork },
            toast: { show: (m: any) => toastMsgs.push(m) },
        } as any)

        expect(mockFork).toHaveBeenCalledTimes(1)
        expect(toastMsgs[0]?.message).toContain('Forked to new session: session-fork-123')
    })
})

describe('/init command', () => {
    test('is removed and not registered in COMMANDS', () => {
        const initCmd = COMMANDS.find((c) => c.name === 'init' || c.value === '/init')
        expect(initCmd).toBeUndefined()
    })
})

describe('/logout command', () => {
    test('is removed and not registered in COMMANDS', () => {
        const logoutCmd = COMMANDS.find((c) => c.name === 'logout' || c.value === '/logout')
        expect(logoutCmd).toBeUndefined()
    })
})

describe('/tui command', () => {
    test('is removed and not registered in COMMANDS', () => {
        const tuiCmd = COMMANDS.find((c) => c.name === 'tui' || c.value === '/tui')
        expect(tuiCmd).toBeUndefined()
    })
})

describe('/switch command', () => {
    test('should define switch command forwarded to chat screen', () => {
        const switchCmd = COMMANDS.find((c) => c.name === 'switch')
        expect(switchCmd).toBeDefined()
        expect(switchCmd?.value).toBe('/switch')
        expect(switchCmd?.description).toContain('Switch active LLM provider')

        const mockContext: any = {
            toast: { show: () => {} },
            agent: null,
            exit: () => {},
        }
        expect(() => switchCmd?.action(mockContext)).not.toThrow()
    })
})

describe('/grill-me and /plan skills', () => {
    test('should not register /grill-me and /plan in static COMMANDS because they are builtin skills', () => {
        const grillMeCmd = COMMANDS.find((c) => c.name === 'grill-me')
        const planCmd = COMMANDS.find((c) => c.name === 'plan')
        const grillCmd = COMMANDS.find((c) => c.name === 'grill')
        expect(grillMeCmd).toBeUndefined()
        expect(planCmd).toBeUndefined()
        expect(grillCmd).toBeUndefined()
    })
})

describe('/ask command', () => {
    test('is removed and not registered in COMMANDS', () => {
        const askCmd = COMMANDS.find((c) => c.name === 'ask' || c.value === '/ask')
        expect(askCmd).toBeUndefined()
    })
})

describe('/artifacts command', () => {
    test('registers /artifacts in COMMANDS and does not register duplicate /artifact', () => {
        const artifactsCmd = COMMANDS.find((c) => c.name === 'artifacts')
        expect(artifactsCmd).toBeDefined()
        expect(artifactsCmd?.value).toBe('/artifacts')

        const artifactCmd = COMMANDS.find((c) => c.name === 'artifact')
        expect(artifactCmd).toBeUndefined()
    })
})

describe('/changelog and /docs commands', () => {
    test('should define /changelog command forwarded to chat screen', () => {
        const changelogCmd = COMMANDS.find((c) => c.name === 'changelog')
        expect(changelogCmd).toBeDefined()
        expect(changelogCmd?.value).toBe('/changelog')
        expect(changelogCmd?.description).toContain('Open December changelog in your browser')
    })

    test('should define /docs command forwarded to chat screen', () => {
        const docsCmd = COMMANDS.find((c) => c.name === 'docs')
        expect(docsCmd).toBeDefined()
        expect(docsCmd?.value).toBe('/docs')
        expect(docsCmd?.description).toContain('Open December documentation in your browser')
    })

    test('should define /diff command forwarded to chat screen', () => {
        const diffCmd = COMMANDS.find((c) => c.name === 'diff')
        expect(diffCmd).toBeDefined()
        expect(diffCmd?.value).toBe('/diff')
        expect(diffCmd?.description).toContain('View git diff and workspace changes')
    })

    test('should define /mcp command forwarded to chat screen', () => {
        const mcpCmd = COMMANDS.find((c) => c.name === 'mcp')
        expect(mcpCmd).toBeDefined()
        expect(mcpCmd?.value).toBe('/mcp')
        expect(mcpCmd?.description).toContain('MCP')
    })

    test('should define /memory command forwarded to chat screen', () => {
        const memCmd = COMMANDS.find((c) => c.name === 'memory')
        expect(memCmd).toBeDefined()
        expect(memCmd?.value).toBe('/memory')
        expect(memCmd?.description).toContain('workspace memory')
        expect(memCmd?.description).toContain('AGENTS.md')
    })

    test('should define /help command with description', () => {
        const helpCmd = COMMANDS.find((c) => c.name === 'help')
        expect(helpCmd).toBeDefined()
        expect(helpCmd?.value).toBe('/help')
        expect(helpCmd?.description).toContain('commands, keybindings, and CLI info')
    })

    test('should define /effort command forwarded to chat screen and remove /reasoning', () => {
        const reasoningCmd = COMMANDS.find(
            (c) => c.name === 'reasoning' || c.value === '/reasoning'
        )
        expect(reasoningCmd).toBeUndefined()

        const effortCmd = COMMANDS.find((c) => c.name === 'effort')
        expect(effortCmd).toBeDefined()
        expect(effortCmd?.value).toBe('/effort')
        expect(effortCmd?.description).toContain('reasoning depth')
    })

    test('should define /open command forwarded to chat screen', () => {
        const openCmd = COMMANDS.find((c) => c.name === 'open')
        expect(openCmd).toBeDefined()
        expect(openCmd?.value).toBe('/open')
        expect(openCmd?.description).toContain('default editor')
    })

    test('should define /codesearch command forwarded to chat screen', () => {
        const csCmd = COMMANDS.find((c) => c.name === 'codesearch')
        expect(csCmd).toBeDefined()
        expect(csCmd?.value).toBe('/codesearch')
        expect(csCmd?.description).toContain('Search code')

        const csAlias = COMMANDS.find((c) => c.name === 'cs')
        expect(csAlias).toBeUndefined()
    })
})
