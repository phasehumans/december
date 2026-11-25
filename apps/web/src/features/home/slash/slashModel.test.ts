import { describe, expect, test } from 'bun:test'

import {
    buildSlashItems,
    formatTokenCount,
    getSlashGroupLabel,
    parseRenameCommand,
    parseSlashToken,
    replaceSlashToken,
    type SlashSkill,
} from './slashModel'

const skills: SlashSkill[] = [
    { name: 'write-tests', description: 'Write unit tests for changed files' },
    { name: 'pr-summary', description: 'Summarize the branch' },
    { name: 'release-notes', description: 'Write release notes', plugin: 'release-kit' },
    { name: 'bump-version', description: 'Bump the version', plugin: 'release-kit' },
]

const names = (items: { name: string }[]) => items.map((item) => item.name)
const atStart = (query = '') => ({ query, start: 0, atStart: true })

const build = (options: Partial<Parameters<typeof buildSlashItems>[0]> = {}) =>
    buildSlashItems({
        token: atStart(),
        scope: 'home',
        demo: false,
        onCredits: true,
        skills: [],
        ...options,
    })

describe('parseSlashToken', () => {
    test('finds a slash at the start of the prompt', () => {
        expect(parseSlashToken('/')).toEqual({ query: '', start: 0, atStart: true })
        expect(parseSlashToken('  /Model')).toEqual({ query: 'model', start: 2, atStart: true })
    })

    test('finds a slash after a space and marks it as not at the start', () => {
        expect(parseSlashToken('fix the bug /wri')).toEqual({
            query: 'wri',
            start: 12,
            atStart: false,
        })
    })

    test('ignores urls, paths and finished words', () => {
        expect(parseSlashToken('https://github.com/acme')).toBeNull()
        expect(parseSlashToken('see src/app')).toBeNull()
        expect(parseSlashToken('/usr/bin')).toBeNull()
        expect(parseSlashToken('/plan ')).toBeNull()
    })
})

describe('buildSlashItems', () => {
    test('lists the commands in group order: run, session, customize, help', () => {
        const home = names(build())
        expect(home.slice(0, 4)).toEqual(['plan', 'effort', 'model', 'switch'])
        expect(home.indexOf('resume')).toBeLessThan(home.indexOf('mcp'))
        expect(home.indexOf('settings')).toBeLessThan(home.indexOf('help'))
        expect(home.slice(-1)).toEqual(['update'])
    })

    test('leaves out what needs the server, and session commands on Home', () => {
        const home = names(build())
        // /plan works for everyone since the server reads plan first (#632)
        expect(home).toContain('plan')
        expect(home).not.toContain('skills')
        expect(home).not.toContain('compact')
        expect(home).not.toContain('rename')
    })

    test('a session adds the session commands', () => {
        expect(names(build({ scope: 'session' }))).toEqual(
            expect.arrayContaining(['new', 'rename', 'copy', 'diff', 'tasks', 'exit'])
        )
    })

    test('/effort is only there on December credits', () => {
        expect(names(build({ onCredits: true }))).toContain('effort')
        expect(names(build({ onCredits: false }))).not.toContain('effort')
    })

    test('demo mode adds /skills and the skills, plugin skills last', () => {
        const items = build({ demo: true, skills })
        expect(names(items)[0]).toBe('plan')
        expect(names(items)).toContain('skills')
        expect(names(items).slice(-4)).toEqual([
            'write-tests',
            'pr-summary',
            'release-notes',
            'bump-version',
        ])
    })

    test('typing filters the list, prefix matches first', () => {
        expect(names(build({ token: atStart('m') })).slice(0, 3)).toEqual([
            'model',
            'mcp',
            'memory',
        ])
        expect(names(build({ token: atStart('xyz') }))).toEqual([])
    })

    test('a slash in the middle of a sentence lists only skills', () => {
        const items = build({
            demo: true,
            skills,
            token: { query: '', start: 8, atStart: false },
        })
        expect(items).toHaveLength(4)
        expect(items.every((item) => item.type === 'skill')).toBe(true)
    })
})

describe('getSlashGroupLabel', () => {
    test('a list of commands only has no labels', () => {
        const items = build()
        expect(items.map((_, index) => getSlashGroupLabel(items, index))).toEqual(
            items.map(() => null)
        )
    })

    test('with skills, each group starts with its label', () => {
        const items = build({ demo: true, skills, token: atStart('e') })
        const labels = items
            .map((item, index) => [item.name, getSlashGroupLabel(items, index)] as const)
            .filter(([, label]) => label !== null)
        expect(labels[0][1]).toBe('Commands')
        expect(labels).toContainEqual(['write-tests', 'Skills'])
        expect(labels).toContainEqual(['release-notes', 'release-kit'])
        expect(labels).toHaveLength(3)
    })
})

describe('replaceSlashToken', () => {
    test('takes the slash word out and keeps the text around it', () => {
        const token = parseSlashToken('fix the bug /wri')!
        expect(replaceSlashToken('fix the bug /wri and more', 16, token)).toEqual({
            value: 'fix the bug  and more',
            cursor: 12,
        })
    })

    test('can swap the word for a full command', () => {
        const token = parseSlashToken('/ren')!
        expect(replaceSlashToken('/ren', 4, token, '/rename ')).toEqual({
            value: '/rename ',
            cursor: 8,
        })
    })
})

describe('parseRenameCommand', () => {
    test('reads the title after /rename', () => {
        expect(parseRenameCommand('/rename Billing webhooks')).toEqual({
            title: 'Billing webhooks',
        })
        expect(parseRenameCommand('/rename  ')).toEqual({ title: '' })
    })

    test('a normal prompt is not a rename', () => {
        expect(parseRenameCommand('please /rename this')).toBeNull()
        expect(parseRenameCommand('/renamed')).toBeNull()
    })
})

describe('formatTokenCount', () => {
    test('shortens large counts', () => {
        expect(formatTokenCount(512)).toBe('512')
        expect(formatTokenCount(84_000)).toBe('84k')
        expect(formatTokenCount(1_230_000)).toBe('1.2M')
    })
})
