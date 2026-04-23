import { describe, expect, it } from 'bun:test'
import { parseGitHubRepoUrl } from '../../src/modules/upload/upload.utils'

describe('parseGitHubRepoUrl', () => {
    describe('valid GitHub repo URLs', () => {
        it('parses a standard https repo URL', () => {
            const result = parseGitHubRepoUrl('https://github.com/vercel/next.js')

            expect(result).toEqual({
                ok: true,
                owner: 'vercel',
                repo: 'next.js',
                normalizedUrl: 'https://github.com/vercel/next.js',
            })
        })

        it('parses a repo URL with trailing slash', () => {
            const result = parseGitHubRepoUrl('https://github.com/vercel/next.js/')

            expect(result).toEqual({
                ok: true,
                owner: 'vercel',
                repo: 'next.js',
                normalizedUrl: 'https://github.com/vercel/next.js',
            })
        })

        it('parses a repo URL ending with .git', () => {
            const result = parseGitHubRepoUrl('https://github.com/vercel/next.js.git')

            expect(result).toEqual({
                ok: true,
                owner: 'vercel',
                repo: 'next.js',
                normalizedUrl: 'https://github.com/vercel/next.js',
            })
        })

        it('parses a tree URL and extracts owner/repo', () => {
            const result = parseGitHubRepoUrl('https://github.com/vercel/next.js/tree/canary')

            expect(result).toEqual({
                ok: true,
                owner: 'vercel',
                repo: 'next.js',
                normalizedUrl: 'https://github.com/vercel/next.js',
            })
        })

        it('parses a blob URL and extracts owner/repo', () => {
            const result = parseGitHubRepoUrl(
                'https://github.com/vercel/next.js/blob/canary/README.md'
            )

            expect(result).toEqual({
                ok: true,
                owner: 'vercel',
                repo: 'next.js',
                normalizedUrl: 'https://github.com/vercel/next.js',
            })
        })

        it('normalizes http to https in normalizedUrl', () => {
            const result = parseGitHubRepoUrl('http://github.com/vercel/next.js')

            expect(result).toEqual({
                ok: true,
                owner: 'vercel',
                repo: 'next.js',
                normalizedUrl: 'https://github.com/vercel/next.js',
            })
        })

        it('accepts github.com shorthand URLs', () => {
            const result = parseGitHubRepoUrl('github.com/vercel/next.js')

            expect(result).toEqual({
                ok: true,
                owner: 'vercel',
                repo: 'next.js',
                normalizedUrl: 'https://github.com/vercel/next.js',
            })
        })

        it('accepts www.github.com shorthand URLs', () => {
            const result = parseGitHubRepoUrl('www.github.com/vercel/next.js')

            expect(result).toEqual({
                ok: true,
                owner: 'vercel',
                repo: 'next.js',
                normalizedUrl: 'https://github.com/vercel/next.js',
            })
        })

        it('parses SSH git URLs', () => {
            const result = parseGitHubRepoUrl('git@github.com:vercel/next.js.git')

            expect(result).toEqual({
                ok: true,
                owner: 'vercel',
                repo: 'next.js',
                normalizedUrl: 'https://github.com/vercel/next.js',
            })
        })

        it('trims surrounding whitespace', () => {
            const result = parseGitHubRepoUrl('   https://github.com/vercel/next.js   ')

            expect(result).toEqual({
                ok: true,
                owner: 'vercel',
                repo: 'next.js',
                normalizedUrl: 'https://github.com/vercel/next.js',
            })
        })
    })

    describe('invalid inputs', () => {
        it('returns EMPTY_INPUT for empty string', () => {
            const result = parseGitHubRepoUrl('')

            expect(result).toEqual({
                ok: false,
                error: 'Repository URL is required',
                code: 'EMPTY_INPUT',
            })
        })

        it('returns EMPTY_INPUT for whitespace only', () => {
            const result = parseGitHubRepoUrl('   ')

            expect(result).toEqual({
                ok: false,
                error: 'Repository URL is required',
                code: 'EMPTY_INPUT',
            })
        })

        it('returns INVALID_URL for malformed input', () => {
            const result = parseGitHubRepoUrl('not a url')

            expect(result).toEqual({
                ok: false,
                error: 'Invalid URL format',
                code: 'INVALID_URL',
            })
        })

        it('returns NOT_GITHUB for non-GitHub domains', () => {
            const result = parseGitHubRepoUrl('https://gitlab.com/vercel/next.js')

            expect(result).toEqual({
                ok: false,
                error: 'URL must be a github.com repository URL',
                code: 'NOT_GITHUB',
            })
        })

        it('returns NOT_REPO_URL when only owner is present', () => {
            const result = parseGitHubRepoUrl('https://github.com/vercel')

            expect(result).toEqual({
                ok: false,
                error: 'URL is not a repository URL',
                code: 'NOT_REPO_URL',
            })
        })

        it('returns NOT_REPO_URL for bare github.com', () => {
            const result = parseGitHubRepoUrl('https://github.com')

            expect(result).toEqual({
                ok: false,
                error: 'URL is not a repository URL',
                code: 'NOT_REPO_URL',
            })
        })
    })
})
