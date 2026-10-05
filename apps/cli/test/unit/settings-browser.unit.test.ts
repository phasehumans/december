import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import { describe, expect, test, beforeEach, afterEach } from 'bun:test'

import { loadConfig } from '../../src/config'
import { useSettingsHandlers } from '../../src/hooks/use-settings-handlers'
import { useCliStore } from '../../src/store'

describe('Settings Browser Window Toggle (Unit)', () => {
    let testConfigDir: string
    const originalEnv = { ...process.env }

    beforeEach(async () => {
        testConfigDir = path.join(
            os.tmpdir(),
            `december-settings-test-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
        )
        await fs.mkdir(testConfigDir, { recursive: true })
        process.env = { ...originalEnv }
        process.env.HOME = testConfigDir
        process.env.USERPROFILE = testConfigDir
        process.env.DECEMBER_CONFIG_DIR = testConfigDir

        useCliStore.setState({
            settingsBrowserVisible: true,
            toasts: [],
        })
    })

    afterEach(async () => {
        process.env = { ...originalEnv }
        try {
            await fs.rm(testConfigDir, { recursive: true, force: true })
        } catch {
            // Intentionally swallowed: test dir cleanup
        }
    })

    test('toggling browserVisible flips state from true to false and persists to config', async () => {
        const { handleSettingsMainSelect } = useSettingsHandlers()

        // Initial state is true (visible / on)
        expect(useCliStore.getState().settingsBrowserVisible).toBe(true)

        // Toggle once: true -> false
        await handleSettingsMainSelect({ value: 'browserVisible' })
        expect(useCliStore.getState().settingsBrowserVisible).toBe(false)

        let config = await loadConfig()
        expect(config.browserVisible).toBe(false)

        // Toggle again: false -> true
        await handleSettingsMainSelect({ value: 'browserVisible' })
        expect(useCliStore.getState().settingsBrowserVisible).toBe(true)

        config = await loadConfig()
        expect(config.browserVisible).toBe(true)
    })
})
