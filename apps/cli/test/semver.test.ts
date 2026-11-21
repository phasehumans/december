import { describe, expect, test } from 'bun:test'

import { compareVersions, extractVersion, isNewerVersion } from '../src/utils/semver'

describe('semver', () => {
    test('compares release versions', () => {
        expect(compareVersions('0.4.19', '0.4.18')).toBe(1)
        expect(compareVersions('0.4.18', '0.4.19')).toBe(-1)
        expect(compareVersions('v0.4.19', '0.4.19')).toBe(0)
        expect(compareVersions('1.0.0', '0.99.99')).toBe(1)
    })

    test('orders a pre-release before its release', () => {
        expect(compareVersions('0.5.0-beta.1', '0.5.0')).toBe(-1)
        expect(compareVersions('0.5.0', '0.5.0-rc.1')).toBe(1)
        expect(compareVersions('0.5.0-beta.1', '0.4.19')).toBe(1)
    })

    test('compares pre-release identifiers by semver rules', () => {
        expect(compareVersions('1.0.0-rc.2', '1.0.0-rc.10')).toBe(-1)
        expect(compareVersions('1.0.0-alpha', '1.0.0-beta')).toBe(-1)
        expect(compareVersions('1.0.0-alpha', '1.0.0-alpha.1')).toBe(-1)
        expect(compareVersions('1.0.0-1', '1.0.0-alpha')).toBe(-1)
    })

    test('ignores build metadata', () => {
        expect(compareVersions('1.0.0+abc', '1.0.0+def')).toBe(0)
    })

    test('handles missing versions', () => {
        expect(compareVersions(undefined, '1.0.0')).toBe(-1)
        expect(compareVersions('1.0.0', undefined)).toBe(1)
        expect(compareVersions(undefined, undefined)).toBe(0)
    })

    test('isNewerVersion and extractVersion', () => {
        expect(isNewerVersion('0.5.0-beta.1', '0.5.0')).toBe(true)
        expect(isNewerVersion('0.5.0', '0.5.0-beta.1')).toBe(false)
        expect(extractVersion('december v0.4.19\n')).toBe('0.4.19')
        expect(extractVersion('nothing here')).toBeUndefined()
    })
})
