import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import { describe, it, expect, beforeEach, afterEach } from 'bun:test'

import { handleLogoutCommand, handleInitCommand, handleUpdateCommand } from '../src/commands'
import { loadConfig, saveConfig } from '../src/config'

describe('CLI Standalone Commands', () => {
    let tmpDir: string
    const originalHome = process.env.HOME

    beforeEach(async () => {
        tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'commands-test-'))
        process.env.HOME = tmpDir
        process.env.DECEMBER_CONFIG_DIR = path.join(tmpDir, '.config', 'december')
    })

    afterEach(async () => {
        process.env.HOME = originalHome
        delete process.env.DECEMBER_CONFIG_DIR
        await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {
            // Intentionally swallowed: cleanup temporary directory
        })
    })

    it('handleLogoutCommand clears decemberToken and providers config', async () => {
        await saveConfig({
            decemberToken: 'test-token',
            email: 'test@example.com',
            providers: { openai: 'sk-test' },
            activeProvider: 'openai',
        })

        await handleLogoutCommand()

        const config = await loadConfig()
        expect(config.decemberToken).toBeUndefined()
        expect(config.email).toBeUndefined()
        expect(config.providers).toEqual({})
        expect(config.activeProvider).toBeUndefined()
    })

    it('handleInitCommand scaffolds workspace files with AGENTS.md in root and config in .december', async () => {
        const originalCwd = process.cwd()
        try {
            process.chdir(tmpDir)
            await handleInitCommand()

            const rootAgentsPath = path.join(tmpDir, 'AGENTS.md')
            const agentsExists = await fs
                .access(rootAgentsPath)
                .then(() => true)
                .catch(() => false)
            expect(agentsExists).toBe(true)

            const agentsContent = await fs.readFile(rootAgentsPath, 'utf-8')
            expect(agentsContent).toContain('Agent Guidelines')

            const decFiles = ['settings.json']
            for (const file of decFiles) {
                const exists = await fs
                    .access(path.join(tmpDir, '.december', file))
                    .then(() => true)
                    .catch(() => false)
                expect(exists).toBe(true)
            }

            const ignoreExists = await fs
                .access(path.join(tmpDir, '.decemberignore'))
                .then(() => true)
                .catch(() => false)
            expect(ignoreExists).toBe(false)

            const rulesExists = await fs
                .access(path.join(tmpDir, '.december', 'rules.md'))
                .then(() => true)
                .catch(() => false)
            expect(rulesExists).toBe(false)

            const skillsExists = await fs
                .access(path.join(tmpDir, '.december', 'skills.md'))
                .then(() => true)
                .catch(() => false)
            expect(skillsExists).toBe(false)

            const rawSettingsContent = await fs.readFile(
                path.join(tmpDir, '.december', 'settings.json'),
                'utf-8'
            )
            const parsedSettings = JSON.parse(rawSettingsContent)
            expect(parsedSettings.toolPermission).toBe('always-proceed')
            expect(parsedSettings.thinkingLevel).toBe('auto')
            expect(parsedSettings.steeringMode).toBe('all')
            expect(parsedSettings.followUpMode).toBe('all')
            expect(parsedSettings.pathGuard).toBe(true)
        } finally {
            process.chdir(originalCwd)
        }
    })

    it('handleUpdateCommand executes successfully for local source environment', async () => {
        let loggedOutput = ''
        const originalLog = console.log
        console.log = (...args: any[]) => {
            loggedOutput += args.join(' ') + '\n'
        }
        try {
            await handleUpdateCommand()
            expect(loggedOutput).toContain('December CLI')
        } finally {
            console.log = originalLog
        }
    }, 15000)

    it('handleKeyCommand saves API key to config and sets activeProvider', async () => {
        const { handleKeyCommand } = await import('../src/commands')
        await handleKeyCommand({ provider: 'openai', key: 'sk-test-custom-key' })

        const config = await loadConfig()
        expect(config.providers?.openai).toBe('sk-test-custom-key')
        expect(config.activeProvider).toBe('openai')
        expect(config.authPriority).toBe('byok')
    })

    it('handleLinkCommand without provider outputs available subscriptions', async () => {
        let loggedOutput = ''
        const originalLog = console.log
        console.log = (...args: any[]) => {
            loggedOutput += args.join(' ') + '\n'
        }
        try {
            const { handleLinkCommand } = await import('../src/commands')
            await handleLinkCommand({})
            expect(loggedOutput).toContain('Link an AI Subscription')
            expect(loggedOutput).toContain('copilot')
            expect(loggedOutput).toContain('claude')
            expect(loggedOutput).toContain('chatgpt')
            expect(loggedOutput).toContain('gemini')
        } finally {
            console.log = originalLog
        }
    })

    it('handleAuthCommand prints subscriptions, BYOK, and cloud status', async () => {
        let loggedOutput = ''
        const originalLog = console.log
        console.log = (...args: any[]) => {
            loggedOutput += args.join(' ') + '\n'
        }
        try {
            const { handleAuthCommand } = await import('../src/commands')
            await handleAuthCommand({ action: 'status' })
            expect(loggedOutput).toContain('Authentication & Subscription Status')
            expect(loggedOutput).toContain('Subscriptions:')
            expect(loggedOutput).toContain('BYOK API Keys:')
            expect(loggedOutput).toContain('December Cloud Wallet:')
        } finally {
            console.log = originalLog
        }
    })

    it('handleDoctorCommand reports environment, runtime, and collision diagnostics', async () => {
        let loggedOutput = ''
        const originalLog = console.log
        console.log = (...args: any[]) => {
            loggedOutput += args.join(' ') + '\n'
        }
        try {
            const { handleDoctorCommand } = await import('../src/commands')
            await handleDoctorCommand()
            expect(loggedOutput).toContain('December CLI Health & Environment Doctor')
            expect(loggedOutput).toContain('Environment & Runtime:')
            expect(loggedOutput).toContain('Installed Binaries & $PATH Precedence:')
        } finally {
            console.log = originalLog
        }
    })

    it('handleSwitchCommand switches active provider and updates authPriority and activeModel', async () => {
        await saveConfig({
            activeProvider: 'anthropic',
            activeModel: 'claude-sonnet-4.6',
            authPriority: 'byok',
            lastUsedModels: {
                anthropic: 'claude-sonnet-4.6',
                openai: 'gpt-5.6-sol',
            },
            providers: {
                anthropic: 'sk-ant',
                openai: 'sk-openai',
            },
        })

        const { handleSwitchCommand } = await import('../src/commands')
        await handleSwitchCommand({ provider: 'openai' })

        const updated = await loadConfig()
        expect(updated.activeProvider).toBe('openai')
        expect(updated.authPriority).toBe('byok')
        expect(updated.activeModel).toBe('gpt-5.6-sol')
        expect(updated.lastUsedModels?.openai).toBe('gpt-5.6-sol')
    })

    it('handleSwitchCommand without args prints configured providers list', async () => {
        process.env.DECEMBER_CONFIG_DIR = path.join(tmpDir, '.config', 'december')
        await saveConfig({
            activeProvider: 'anthropic',
            activeModel: 'claude-sonnet-4.6',
            authPriority: 'byok',
            providers: {
                anthropic: 'sk-ant',
            },
            decemberToken: 'tok-123',
        })

        let loggedOutput = ''
        const originalLog = console.log
        console.log = (...args: any[]) => {
            loggedOutput += args.join(' ') + '\n'
        }
        try {
            const { handleSwitchCommand } = await import('../src/commands')
            await handleSwitchCommand({})
            expect(loggedOutput).toContain('Configured Providers')
            expect(loggedOutput).toContain('Anthropic')
            expect(loggedOutput).not.toContain('(API Key)')
            expect(loggedOutput).toContain('December (Cloud Wallet)')
            expect(loggedOutput).toContain('(Active)')
        } finally {
            console.log = originalLog
        }
    })
})
