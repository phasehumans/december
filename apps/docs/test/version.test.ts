import { describe, expect, it } from 'bun:test'

import rootPkg, { rawVersion, version } from '../src/lib/version'

describe('apps/docs version utility', () => {
    it('exports a valid semver rawVersion string', () => {
        expect(typeof rawVersion).toBe('string')
        expect(rawVersion.length).toBeGreaterThan(0)
        // Matches semver like 0.3.31 or 1.0.0-beta.1
        expect(rawVersion).toMatch(/^\d+\.\d+\.\d+(-[a-zA-Z0-9.]+)?$/)
    })

    it('exports version prefixed with v', () => {
        expect(typeof version).toBe('string')
        expect(version).toBe(`v${rawVersion}`)
        expect(version.startsWith('v')).toBe(true)
    })

    it('exports root package.json as default export', () => {
        expect(rootPkg).toBeDefined()
        expect(rootPkg.name).toBe('december')
        expect(rootPkg.version).toBe(rawVersion)
        expect(Array.isArray(rootPkg.workspaces)).toBe(true)
        expect(rootPkg.workspaces).toContain('apps/*')
        expect(rootPkg.workspaces).toContain('packages/*')
    })
})
