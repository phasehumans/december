import { describe, expect, test, spyOn } from 'bun:test'

import { TreeReporter } from '../../src/utils/tree-reporter'

describe('TreeReporter (Unit)', () => {
    test('renders step header with signature asterisk and white text', () => {
        let logged = ''
        const spy = spyOn(console, 'log').mockImplementation((msg: string) => {
            logged = msg
        })

        const reporter = new TreeReporter()
        reporter.step('checking december cli for updates...')

        spy.mockRestore()
        expect(logged).toContain('✱')
        expect(logged).toContain('checking december cli for updates...')
    })

    test('renders tree detail item with trunk vertical bar', () => {
        let logged = ''
        const spy = spyOn(console, 'log').mockImplementation((msg: string) => {
            logged = msg
        })

        const reporter = new TreeReporter()
        reporter.tree('detected local source development repository.')

        spy.mockRestore()
        expect(logged).toContain('│')
        expect(logged).toContain('detected local source development repository.')
    })

    test('renders formatted item with aligned label and value', () => {
        let logged = ''
        const spy = spyOn(console, 'log').mockImplementation((msg: string) => {
            logged = msg
        })

        const reporter = new TreeReporter()
        reporter.item('current version', 'v0.3.27')

        spy.mockRestore()
        expect(logged).toContain('│')
        expect(logged).toContain('current version:')
        expect(logged).toContain('v0.3.27')
    })

    test('renders success checkmark in green', () => {
        let logged = ''
        const spy = spyOn(console, 'log').mockImplementation((msg: string) => {
            logged = msg
        })

        const reporter = new TreeReporter()
        reporter.success('package successfully updated via bun')

        spy.mockRestore()
        expect(logged).toContain('✔')
        expect(logged).toContain('package successfully updated via bun')
    })

    test('renders warning indicator', () => {
        let logged = ''
        const spy = spyOn(console, 'log').mockImplementation((msg: string) => {
            logged = msg
        })

        const reporter = new TreeReporter()
        reporter.warn('shell cached previous binary path.')

        spy.mockRestore()
        expect(logged).toContain('⚠')
        expect(logged).toContain('shell cached previous binary path.')
    })

    test('renders error indicator', () => {
        let logged = ''
        const spy = spyOn(console, 'log').mockImplementation((msg: string) => {
            logged = msg
        })

        const reporter = new TreeReporter()
        reporter.error('permission denied while installing global package')

        spy.mockRestore()
        expect(logged).toContain('✖')
        expect(logged).toContain('permission denied while installing global package')
    })

    test('renders space with trunk bar only', () => {
        let logged = ''
        const spy = spyOn(console, 'log').mockImplementation((msg: string) => {
            logged = msg
        })

        const reporter = new TreeReporter()
        reporter.space()

        spy.mockRestore()
        expect(logged).toContain('│')
    })

    test('manages spinner lifecycle without throwing', () => {
        const reporter = new TreeReporter()
        expect(() => {
            reporter.startSpinner('downloading asset...')
            reporter.updateSpinner('unpacking binary...')
            reporter.stopSpinner()
        }).not.toThrow()
    })
})
