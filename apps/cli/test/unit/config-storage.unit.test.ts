import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import { describe, expect, it, beforeEach, afterEach } from 'bun:test'

import { loadConfig, getAuthStatus, saveConfig } from '../../src/config'

describe('CLI Config Storage & Auth Status (Unit)', () => {
    let originalEnv: NodeJS.ProcessEnv
    let testConfigDir: string

    beforeEach(async () => {
        originalEnv = { ...process.env }
        testConfigDir = path.join(
            os.tmpdir(),
            `december-config-storage-${Date.now()}-${Math.random()}`
        )
        await fs.mkdir(testConfigDir, { recursive: true })
        process.env.DECEMBER_CONFIG_DIR = testConfigDir
        process.env.HOME = testConfigDir

        await saveConfig({
            providers: { openai: 'test-key' },
            activeProvider: 'openai',
            authPriority: 'byok',
        })
    })

    afterEach(async () => {
        process.env = originalEnv
        try {
            await fs.rm(testConfigDir, { recursive: true, force: true })
        } catch {
            // Intentionally swallowed: test cleanup
        }
    })

    it('returns valid config object structure from loadConfig', async () => {
        const config = await loadConfig()
        expect(config).toBeDefined()
        expect(typeof config).toBe('object')
        expect(config.providers).toBeDefined()
    })

    it('returns auth status object', async () => {
        const status = await getAuthStatus()
        expect(status).toBeDefined()
        expect(typeof status.hasByok).toBe('boolean')
        expect(typeof status.hasDecember).toBe('boolean')
        expect(['byok', 'december', 'subscription']).toContain(status.authPriority)
    })
})
