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

describe('/grill and /plan commands', () => {
    test('should define /grill-me command and ensure /grill alias is removed', () => {
        const grillMeCmd = COMMANDS.find((c) => c.name === 'grill-me')
        const grillCmd = COMMANDS.find((c) => c.name === 'grill')
        expect(grillMeCmd).toBeDefined()
        expect(grillMeCmd?.value).toBe('/grill-me')
        expect(grillCmd).toBeUndefined()
    })

    test('should define /plan command', () => {
        const planCmd = COMMANDS.find((c) => c.name === 'plan')
        expect(planCmd).toBeDefined()
        expect(planCmd?.value).toBe('/plan')
    })
})

describe('/ask command', () => {
    test('should define /ask command forwarded to chat screen', () => {
        const askCmd = COMMANDS.find((c) => c.name === 'ask')
        expect(askCmd).toBeDefined()
        expect(askCmd?.value).toBe('/ask')
        expect(askCmd?.description).toContain('Ask a question about the codebase')
    })
})
