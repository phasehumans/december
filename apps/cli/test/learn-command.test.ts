import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { afterEach, beforeEach, describe, expect, test } from 'bun:test'

import { getLearnPrompt } from '../src/constants/prompts'
import { findRuleRoot, resolveLearnTarget } from '../src/utils/learn-target'

const baseOptions = {
    lesson: '',
    ruleFile: '/repo/AGENTS.md',
    ruleFileExists: true,
    nestedRuleFiles: [],
    skillsDir: '/repo/.december/skills',
    existingSkillNames: [],
}

describe('getLearnPrompt (Unit)', () => {
    test('saves the given lesson when the user types text', () => {
        const prompt = getLearnPrompt({ ...baseOptions, lesson: 'never use axios' })
        expect(prompt).toContain('<lesson>\nnever use axios\n</lesson>')
        expect(prompt).not.toContain('The user gave no text')
    })

    test('asks the agent to find the lesson and allows a no-op without text', () => {
        const prompt = getLearnPrompt(baseOptions)
        expect(prompt).toContain('The user gave no text')
        expect(prompt).toContain('Do not write a file.')
    })

    test('names the rule file, skills folder, and existing skills', () => {
        const prompt = getLearnPrompt({
            ...baseOptions,
            nestedRuleFiles: ['/repo/packages/api/AGENTS.md'],
            existingSkillNames: ['verify', 'plan'],
        })
        expect(prompt).toContain('Rule file: /repo/AGENTS.md')
        expect(prompt).toContain('This file exists. Read it before you change it.')
        expect(prompt).toContain('- /repo/packages/api/AGENTS.md')
        expect(prompt).toContain('Create /repo/.december/skills/<name>/SKILL.md')
        expect(prompt).toContain('Existing skills: verify, plan.')
        expect(prompt).toContain('Do not ask for confirmation.')
    })

    test('tells the agent to create AGENTS.md when it does not exist', () => {
        const prompt = getLearnPrompt({ ...baseOptions, ruleFileExists: false })
        expect(prompt).toContain('This file does not exist yet.')
    })

    test('contains no em dash and no context mention trigger', () => {
        const prompt = getLearnPrompt(baseOptions)
        expect(prompt).not.toContain('—')
        expect(prompt).not.toContain('@')
    })
})

describe('resolveLearnTarget (Unit)', () => {
    let tmpDir: string

    beforeEach(() => {
        tmpDir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'learn-target-test-')))
    })

    afterEach(() => {
        fs.rmSync(tmpDir, { recursive: true, force: true })
    })

    test('targets AGENTS.md at the git root from a subfolder', () => {
        fs.mkdirSync(path.join(tmpDir, '.git'))
        const subDir = path.join(tmpDir, 'packages', 'api')
        fs.mkdirSync(subDir, { recursive: true })

        const target = resolveLearnTarget(subDir)
        expect(target.rootDir).toBe(tmpDir)
        expect(target.ruleFile).toBe(path.join(tmpDir, 'AGENTS.md'))
        expect(target.ruleFileExists).toBe(false)
        expect(target.skillsDir).toBe(path.join(tmpDir, '.december', 'skills'))
    })

    test('uses CLAUDE.md at the root when there is no AGENTS.md', () => {
        fs.mkdirSync(path.join(tmpDir, '.git'))
        fs.writeFileSync(path.join(tmpDir, 'CLAUDE.md'), '# Rules')

        const target = resolveLearnTarget(tmpDir)
        expect(target.ruleFile).toBe(path.join(tmpDir, 'CLAUDE.md'))
        expect(target.ruleFileExists).toBe(true)
    })

    test('lists nested rule files between the root and the workspace', () => {
        fs.mkdirSync(path.join(tmpDir, '.git'))
        fs.writeFileSync(path.join(tmpDir, 'AGENTS.md'), '# Root')
        const subDir = path.join(tmpDir, 'packages', 'api')
        fs.mkdirSync(subDir, { recursive: true })
        fs.writeFileSync(path.join(subDir, 'AGENTS.md'), '# Api')

        const target = resolveLearnTarget(subDir)
        expect(target.ruleFile).toBe(path.join(tmpDir, 'AGENTS.md'))
        expect(target.nestedRuleFiles).toEqual([path.join(subDir, 'AGENTS.md')])
    })

    test('uses the workspace when it is not in a git repository', () => {
        expect(findRuleRoot(tmpDir)).toBe(tmpDir)
    })
})
