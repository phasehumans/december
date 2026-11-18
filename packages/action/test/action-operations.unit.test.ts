import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { describe, expect, it } from 'bun:test'

import { createActionOperations } from '../src/action-operations'
import { resolveActionProvider } from '../src/action-runner'

describe('resolveActionProvider', () => {
    const none = {
        gemini: undefined,
        openai: undefined,
        anthropic: undefined,
        openrouter: undefined,
    }

    it('uses the requested provider when it has a key', () => {
        expect(resolveActionProvider('anthropic', { ...none, gemini: 'g', anthropic: 'a' })).toBe(
            'anthropic'
        )
    })

    it('treats google as gemini', () => {
        expect(resolveActionProvider('google', { ...none, gemini: 'g' })).toBe('gemini')
    })

    it('falls back to the first provider with a key when the requested one has none', () => {
        expect(resolveActionProvider('gemini', { ...none, openai: 'o' })).toBe('openai')
    })

    it('returns undefined when no key is set', () => {
        expect(resolveActionProvider('gemini', none)).toBeUndefined()
    })
})

describe('createActionOperations', () => {
    it('gives tools the fs, bash, and env shape they call', async () => {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'december-action-'))
        const ops = createActionOperations(dir)

        await ops.fs.writeFile('src/hello.txt', 'hi')
        expect(await ops.fs.readFile('src/hello.txt')).toBe('hi')
        expect(await ops.fs.exists('src/hello.txt')).toBe(true)
        expect(await ops.fs.readdir('src')).toEqual(['hello.txt'])
        expect(ops.env.cwd()).toBe(dir)

        const ok = await ops.bash.exec('cat src/hello.txt')
        expect(ok.exitCode).toBe(0)
        expect(ok.output.trim()).toBe('hi')

        const failed = await ops.bash.exec('exit 3')
        expect(failed.exitCode).toBe(3)

        fs.rmSync(dir, { recursive: true, force: true })
    })
})
