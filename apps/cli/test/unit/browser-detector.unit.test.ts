import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import { describe, expect, test, beforeEach, afterEach } from 'bun:test'

import {
    findSystemChrome,
    isChromeAvailable,
    isExecutable,
    resetChromePathCache,
} from '../../src/utils/browser/detector'

describe('Browser Detector (Unit)', () => {
    const originalEnv = { ...process.env }
    let tempDir: string

    beforeEach(async () => {
        resetChromePathCache()
        process.env = { ...originalEnv }
        delete process.env.CHROME_PATH
        delete process.env.CHROME_BIN
        delete process.env.CHROMIUM_PATH
        delete process.env.PUPPETEER_EXECUTABLE_PATH

        tempDir = path.join(
            os.tmpdir(),
            `december-test-browser-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
        )
        await fs.mkdir(tempDir, { recursive: true })
    })

    afterEach(async () => {
        process.env = { ...originalEnv }
        resetChromePathCache()
        try {
            await fs.rm(tempDir, { recursive: true, force: true })
        } catch {
            // Intentionally swallowed: test dir cleanup
        }
    })

    test('isExecutable returns true for executable file and false for non-existent file', async () => {
        const dummyFile = path.join(tempDir, 'dummy-exec')
        await fs.writeFile(dummyFile, '#!/bin/sh\necho ok', { mode: 0o755 })

        expect(await isExecutable(dummyFile)).toBe(true)
        expect(await isExecutable(path.join(tempDir, 'non-existent'))).toBe(false)
    })

    test('respects CHROME_PATH environment variable if executable exists', async () => {
        const fakeChrome = path.join(tempDir, 'mock-chrome')
        await fs.writeFile(fakeChrome, '#!/bin/sh\necho mock chrome', { mode: 0o755 })

        process.env.CHROME_PATH = fakeChrome
        resetChromePathCache()

        const detected = await findSystemChrome()
        expect(detected).toBe(fakeChrome)
        expect(await isChromeAvailable()).toBe(true)
    })

    test('respects CHROME_BIN environment variable', async () => {
        const fakeChrome = path.join(tempDir, 'mock-chrome-bin')
        await fs.writeFile(fakeChrome, '#!/bin/sh\necho mock chrome bin', { mode: 0o755 })

        process.env.CHROME_BIN = fakeChrome
        resetChromePathCache()

        const detected = await findSystemChrome()
        expect(detected).toBe(fakeChrome)
    })

    test('ignores non-executable CHROME_PATH', async () => {
        const fakeChrome = path.join(tempDir, 'mock-chrome-not-exec')
        await fs.writeFile(fakeChrome, 'not executable', { mode: 0o644 })

        process.env.CHROME_PATH = fakeChrome
        resetChromePathCache()

        // Should skip the non-executable file
        const detected = await findSystemChrome()
        expect(detected).not.toBe(fakeChrome)
    })

    test('caches discovered path across subsequent calls and clears on reset', async () => {
        const fakeChrome = path.join(tempDir, 'mock-cached-chrome')
        await fs.writeFile(fakeChrome, '#!/bin/sh\necho mock', { mode: 0o755 })

        process.env.CHROME_PATH = fakeChrome
        resetChromePathCache()

        expect(await findSystemChrome()).toBe(fakeChrome)

        // Delete env var, but cache should still return fakeChrome
        delete process.env.CHROME_PATH
        expect(await findSystemChrome()).toBe(fakeChrome)

        // Reset cache, now it shouldn't return fakeChrome
        resetChromePathCache()
        expect(await findSystemChrome()).not.toBe(fakeChrome)
    })
})
