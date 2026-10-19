import { describe, expect, it } from 'bun:test'

import {
    fuzzyMatch,
    parseFilePath,
    getExtensionBadge,
    scoreAndSortFiles,
} from '../../src/utils/fuzzy'

describe('Fuzzy Matching Utility (Unit)', () => {
    describe('fuzzyMatch', () => {
        it('matches exact strings with highest score and all indices', () => {
            const res = fuzzyMatch('AGENTS.md', 'AGENTS.md')
            expect(res.matches).toBe(true)
            expect(res.indices).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8])
            expect(res.score).toBeGreaterThan(150)
        })

        it('matches prefix strings with high score', () => {
            const res = fuzzyMatch('AGENTS.md', 'agent')
            expect(res.matches).toBe(true)
            expect(res.indices).toEqual([0, 1, 2, 3, 4])
        })

        it('matches non-contiguous subsequence characters like exsrv in execution.service.ts', () => {
            const res = fuzzyMatch('execution.service.ts', 'exsrv')
            expect(res.matches).toBe(true)
            // 'e' -> 0, 'x' -> 1, 's' -> 10, 'r' -> 12, 'v' -> 13
            expect(res.indices).toContain(0)
            expect(res.indices).toContain(1)
            expect(res.indices).toContain(10)
        })

        it('fails gracefully when query characters are not in sequence', () => {
            const res = fuzzyMatch('execution.service.ts', 'xyz')
            expect(res.matches).toBe(false)
            expect(res.indices).toEqual([])
        })

        it('gives boundary bonus for delimiter and camelCase characters', () => {
            const boundaryRes = fuzzyMatch('mock-provider.ts', 'mp')
            const middleRes = fuzzyMatch('completely.ts', 'mp')

            expect(boundaryRes.matches).toBe(true)
            // 'm' is at 0, 'p' is at 5 (after '-')
            expect(boundaryRes.indices).toEqual([0, 5])
            if (middleRes.matches) {
                expect(boundaryRes.score).toBeGreaterThan(middleRes.score)
            }
        })
    })

    describe('parseFilePath', () => {
        it('parses root files correctly', () => {
            const parsed = parseFilePath('AGENTS.md')
            expect(parsed.basename).toBe('AGENTS.md')
            expect(parsed.dir).toBe('.')
            expect(parsed.extension).toBe('md')
        })

        it('parses nested files correctly', () => {
            const parsed = parseFilePath('packages/server/src/modules/execution.service.ts')
            expect(parsed.basename).toBe('execution.service.ts')
            expect(parsed.dir).toBe('packages/server/src/modules')
            expect(parsed.extension).toBe('ts')
        })
    })

    describe('getExtensionBadge', () => {
        it('returns proper badges and colors for known extensions', () => {
            expect(getExtensionBadge('ts').label).toBe('[TS]')
            expect(getExtensionBadge('tsx').label).toBe('[TSX]')
            expect(getExtensionBadge('json').label).toBe('[JSON]')
            expect(getExtensionBadge('md').label).toBe('[MD]')
            expect(getExtensionBadge('mdx').label).toBe('[MDX]')
            expect(getExtensionBadge('py').label).toBe('[PY]')
            expect(getExtensionBadge('rs').label).toBe('[RS]')
            expect(getExtensionBadge('css').label).toBe('[CSS]')
        })

        it('returns fallback badge for unknown extensions or files without extensions', () => {
            expect(getExtensionBadge('custom').label).toBe('[CUST]')
            expect(getExtensionBadge('').label).toBe('[FILE]')
        })
    })

    describe('scoreAndSortFiles', () => {
        const files = [
            'packages/agent/package.json',
            'packages/agent/tsconfig.json',
            'packages/agent/test/mock-provider.ts',
            'packages/agent/src/platform-adapter.ts',
            'AGENTS.md',
            'apps/docs/src/pages/blog/self-improving-agents.mdx',
            'packages/server/src/modules/execution/execution.service.ts',
        ]

        it('prioritizes basename matches over nested path matches', () => {
            const results = scoreAndSortFiles(files, 'agents')
            expect(results.length).toBeGreaterThan(0)
            // AGENTS.md has 'agents' in the basename, so it must rank first
            expect(results[0]?.basename).toBe('AGENTS.md')
        })

        it('matches non-contiguous sequence exsrv and returns execution.service.ts', () => {
            const results = scoreAndSortFiles(files, 'exsrv')
            expect(results.length).toBe(1)
            expect(results[0]?.basename).toBe('execution.service.ts')
            expect(results[0]?.dir).toBe('packages/server/src/modules/execution')
        })

        it('boosts recently modified files when query is empty or short', () => {
            const recent = new Set(['packages/agent/src/platform-adapter.ts'])
            const results = scoreAndSortFiles(files, '', recent)
            expect(results[0]?.path).toBe('packages/agent/src/platform-adapter.ts')
        })

        it('includes character highlight indices for the basename', () => {
            const results = scoreAndSortFiles(files, 'self')
            const match = results.find((r) => r.basename.includes('self-improving-agents.mdx'))
            expect(match).toBeDefined()
            expect(match?.basenameIndices).toEqual([0, 1, 2, 3])
        })
    })
})
