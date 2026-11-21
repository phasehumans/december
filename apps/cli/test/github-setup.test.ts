import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { describe, expect, it } from 'bun:test'

import {
    buildWorkflowYaml,
    resolveGithubProvider,
    setGithubSecret,
    toActionProvider,
    writeDecemberWorkflow,
} from '../src/utils/github-setup'

describe('/github setup', () => {
    it('maps December providers to the providers the action supports', () => {
        expect(toActionProvider('google')).toBe('gemini')
        expect(toActionProvider('anthropic')).toBe('anthropic')
        expect(toActionProvider('claude')).toBeNull()
    })

    it('uses the active provider when it has a saved key', () => {
        const plan = resolveGithubProvider({
            activeProvider: 'anthropic',
            providers: { anthropic: 'sk-ant', openai: 'sk-oa' },
        })
        expect(plan).toMatchObject({
            provider: 'anthropic',
            secretName: 'ANTHROPIC_API_KEY',
            savedKey: 'sk-ant',
        })
    })

    it('falls back to a supported provider with a saved key', () => {
        const plan = resolveGithubProvider({
            activeProvider: 'mistral',
            providers: { openai: 'k' },
        })
        expect(plan.provider).toBe('openai')
        expect(plan.savedKey).toBe('k')
    })

    it('explains that a subscription login cannot run in CI', () => {
        const plan = resolveGithubProvider({ activeProvider: 'claude', providers: {} })
        expect(plan.savedKey).toBeUndefined()
        expect(plan.note).toContain('Subscription logins do not work in CI')
    })

    it('builds a workflow for the chosen provider and base branch', () => {
        const yaml = buildWorkflowYaml({
            provider: 'anthropic',
            secretName: 'ANTHROPIC_API_KEY',
            baseBranch: 'develop',
        })
        expect(yaml).toContain('uses: trydecember/action@v1')
        expect(yaml).toContain('provider: anthropic')
        expect(yaml).toContain('anthropic_api_key: ${{ secrets.ANTHROPIC_API_KEY }}')
        expect(yaml).toContain('base_branch: develop')
        expect(yaml).toContain("contains(github.event.comment.body, '@trydecember')")
    })

    it('does not overwrite an existing workflow unless asked', () => {
        const root = fs.mkdtempSync(path.join(os.tmpdir(), 'december-gh-'))
        try {
            const options = {
                gitRoot: root,
                provider: 'gemini' as const,
                secretName: 'GEMINI_API_KEY',
                baseBranch: 'main',
            }
            const file = writeDecemberWorkflow(options)
            fs.writeFileSync(file, 'custom')
            expect(() => writeDecemberWorkflow(options)).toThrow('already exists')
            expect(fs.readFileSync(file, 'utf-8')).toBe('custom')
            writeDecemberWorkflow({ ...options, overwrite: true })
            expect(fs.readFileSync(file, 'utf-8')).toContain('gemini_api_key')
        } finally {
            fs.rmSync(root, { recursive: true, force: true })
        }
    })

    it('rejects bad secret names and empty values before calling gh', () => {
        expect(() => setGithubSecret(os.tmpdir(), 'BAD NAME', 'x')).toThrow('Invalid secret name')
        expect(() => setGithubSecret(os.tmpdir(), 'GOOD_NAME', '  ')).toThrow('empty')
    })
})
