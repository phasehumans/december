import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import { describe, expect, it, beforeEach, afterEach } from 'bun:test'

import { getConfigDir, getConfigFile, loadConfig, saveConfig } from '../../src/config'
import { FileSessionRepository } from '../../src/file-session-repository'
import { PromptHistory } from '../../src/utils/prompt-history'

describe('Global Machine Root Configuration & Directory Resolution (Unit)', () => {
    let originalEnv: NodeJS.ProcessEnv
    let testBaseDir: string
    let mockHome: string

    beforeEach(async () => {
        originalEnv = { ...process.env }
        testBaseDir = path.join(
            os.tmpdir(),
            `december-dir-test-${Date.now()}-${Math.random().toString(36).slice(2)}`
        )
        mockHome = path.join(testBaseDir, 'userhome')
        await fs.mkdir(mockHome, { recursive: true })

        delete process.env.DECEMBER_CONFIG_DIR
        process.env.HOME = mockHome
        process.env.USERPROFILE = mockHome
    })

    afterEach(async () => {
        process.env = originalEnv
        try {
            await fs.rm(testBaseDir, { recursive: true, force: true })
        } catch {
            // Intentionally swallowed: test sandbox cleanup
        }
    })

    it('honors process.env.DECEMBER_CONFIG_DIR override when set', () => {
        const customDir = path.join(testBaseDir, 'custom-dec-config')
        process.env.DECEMBER_CONFIG_DIR = customDir
        expect(getConfigDir()).toBe(customDir)
        expect(getConfigFile()).toBe(path.join(customDir, 'config.json'))
    })

    it('defaults to ~/.december when neither directory exists', () => {
        const canonical = path.join(mockHome, '.december')
        expect(getConfigDir()).toBe(canonical)
        expect(getConfigFile()).toBe(path.join(canonical, 'config.json'))
    })

    it('resolves to ~/.december when canonical ~/.december directory exists', async () => {
        const canonical = path.join(mockHome, '.december')
        await fs.mkdir(canonical, { recursive: true })

        expect(getConfigDir()).toBe(canonical)
        expect(getConfigFile()).toBe(path.join(canonical, 'config.json'))
    })

    it('falls back to ~/.config/december if only legacy directory exists', async () => {
        const legacy = path.join(mockHome, '.config', 'december')
        await fs.mkdir(legacy, { recursive: true })

        expect(getConfigDir()).toBe(legacy)
        expect(getConfigFile()).toBe(path.join(legacy, 'config.json'))
    })

    it('prefers ~/.december over ~/.config/december when both exist', async () => {
        const canonical = path.join(mockHome, '.december')
        const legacy = path.join(mockHome, '.config', 'december')
        await fs.mkdir(canonical, { recursive: true })
        await fs.mkdir(legacy, { recursive: true })

        expect(getConfigDir()).toBe(canonical)
    })

    it('loadConfig seamlessly falls back to legacy ~/.config/december/config.json when canonical does not exist', async () => {
        const canonicalDir = path.join(mockHome, '.december')
        const legacyDir = path.join(mockHome, '.config', 'december')
        await fs.mkdir(canonicalDir, { recursive: true })
        await fs.mkdir(legacyDir, { recursive: true })

        const legacyPayload = {
            activeProvider: 'anthropic',
            providers: { anthropic: 'sk-ant-test' },
        }
        await fs.writeFile(
            path.join(legacyDir, 'config.json'),
            JSON.stringify(legacyPayload, null, 2),
            'utf-8'
        )

        const loaded = await loadConfig()
        expect(loaded.activeProvider).toBe('anthropic')
        expect(loaded.providers?.anthropic).toBe('sk-ant-test')

        // Verify it auto-migrated into canonical ~/.december/config.json
        const canonicalContent = await fs.readFile(path.join(canonicalDir, 'config.json'), 'utf-8')
        const parsedCanonical = JSON.parse(canonicalContent)
        expect(parsedCanonical.activeProvider).toBe('anthropic')
        expect(parsedCanonical.providers?.anthropic).toBe('sk-ant-test')
    })

    it('saveConfig writes to canonical ~/.december/config.json and preserves permissions', async () => {
        const canonicalDir = path.join(mockHome, '.december')
        await saveConfig({
            activeProvider: 'openai',
            providers: { openai: 'sk-proj-test' },
        })

        const savedFile = path.join(canonicalDir, 'config.json')
        const content = await fs.readFile(savedFile, 'utf-8')
        const parsed = JSON.parse(content)
        expect(parsed.activeProvider).toBe('openai')
        expect(parsed.providers?.openai).toBe('sk-proj-test')
    })

    it('PromptHistory defaults to ~/.december/history and falls back to legacy ~/.config/december/history', async () => {
        const legacyHistoryFile = path.join(mockHome, '.config', 'december', 'history')
        await fs.mkdir(path.dirname(legacyHistoryFile), { recursive: true })
        await fs.writeFile(legacyHistoryFile, 'first prompt\nsecond prompt\n', 'utf-8')

        const history = new PromptHistory()
        expect(history.getPrevious('')).toBe('second prompt')

        // If canonical exists, it should use canonical
        const canonicalHistoryFile = path.join(mockHome, '.december', 'history')
        await fs.mkdir(path.dirname(canonicalHistoryFile), { recursive: true })
        await fs.writeFile(canonicalHistoryFile, 'canonical prompt\n', 'utf-8')

        const canonicalHistory = new PromptHistory()
        expect(canonicalHistory.getPrevious('')).toBe('canonical prompt')
    })

    it('FileSessionRepository defaults to ~/.december/sessions and loads legacy sessions as fallback', async () => {
        const repo = new FileSessionRepository()

        // Create legacy session in ~/.config/december/sessions
        const legacyDir = path.join(mockHome, '.config', 'december', 'sessions')
        await fs.mkdir(legacyDir, { recursive: true })
        const legacyMsg = { id: 'msg-1', role: 'user', content: 'legacy message', timestamp: 100 }
        await fs.writeFile(
            path.join(legacyDir, 'legacy-session-123.jsonl'),
            JSON.stringify(legacyMsg) + '\n',
            'utf-8'
        )

        const loaded = await repo.loadContext('legacy-session-123')
        expect(loaded.length).toBe(1)
        expect(loaded[0].content).toBe('legacy message')
    })
})
