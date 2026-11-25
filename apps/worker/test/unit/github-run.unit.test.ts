import { describe, expect, it } from 'bun:test'

import { describeTests, parseReviewFile, pickTestCommand } from '../../src/github-run'

describe('github run: the test command (#568)', () => {
    const pkg = (test?: string) => JSON.stringify({ scripts: test ? { test } : {} })

    it('uses the package manager of the lock file', () => {
        const texts = { 'package.json': pkg('vitest run') }
        expect(pickTestCommand({ files: ['package.json', 'bun.lock'], texts })).toEqual({
            command: 'bun run test',
            install: 'bun install',
        })
        expect(pickTestCommand({ files: ['package.json', 'pnpm-lock.yaml'], texts })?.command).toBe(
            'pnpm test'
        )
        expect(pickTestCommand({ files: ['package.json', 'yarn.lock'], texts })?.command).toBe(
            'yarn test'
        )
        expect(pickTestCommand({ files: ['package.json'], texts })?.command).toBe('npm test')
    })

    it('treats the npm placeholder script as no tests', () => {
        const texts = { 'package.json': pkg('echo "Error: no test specified" && exit 1') }
        expect(pickTestCommand({ files: ['package.json'], texts })).toBeNull()
    })

    it('finds go, cargo, pytest and make', () => {
        expect(pickTestCommand({ files: ['go.mod'], texts: {} })?.command).toBe('go test ./...')
        expect(pickTestCommand({ files: ['Cargo.toml'], texts: {} })?.command).toBe('cargo test')
        expect(
            pickTestCommand({
                files: ['pyproject.toml'],
                texts: { 'pyproject.toml': '[tool.pytest.ini_options]' },
            })?.command
        ).toBe('python -m pytest -q')
        expect(
            pickTestCommand({
                files: ['Makefile'],
                texts: { Makefile: 'build:\n\tgo build\ntest:\n\tgo test' },
            })?.command
        ).toBe('make test')
    })

    it('says "no tests found" instead of "passed" when there is nothing to run', () => {
        expect(pickTestCommand({ files: ['README.md'], texts: {} })).toBeNull()
        expect(describeTests({ status: 'none' })).toBe('no tests found')
        expect(describeTests({ status: 'passed', command: 'npm test', output: '' })).toBe(
            'passed (`npm test`)'
        )
    })
})

describe('github run: the review file', () => {
    it('keeps valid comments, at most ten', () => {
        const comments = Array.from({ length: 12 }, (_, i) => ({
            path: './src/a.ts',
            line: i + 1,
            body: `note ${i}`,
        }))
        const review = parseReviewFile(JSON.stringify({ summary: ' Looks fine. ', comments }))
        expect(review?.summary).toBe('Looks fine.')
        expect(review?.comments.length).toBe(10)
        expect(review?.comments[0]).toEqual({ path: 'src/a.ts', line: 1, body: 'note 0' })
    })

    it('drops comments without a file, a line or a body', () => {
        const review = parseReviewFile(
            JSON.stringify({
                summary: 's',
                comments: [
                    { path: '', line: 1, body: 'x' },
                    { path: 'a.ts', line: 0, body: 'x' },
                    { path: 'a.ts', line: 2.5, body: 'x' },
                    { path: 'a.ts', line: 3, body: ' ' },
                    { path: 'a.ts', line: 4, body: 'ok' },
                ],
            })
        )
        expect(review?.comments).toEqual([{ path: 'a.ts', line: 4, body: 'ok' }])
    })

    it('returns null for a broken or empty file', () => {
        expect(parseReviewFile('{not json')).toBeNull()
        expect(parseReviewFile(JSON.stringify({ summary: '', comments: [] }))).toBeNull()
    })
})
