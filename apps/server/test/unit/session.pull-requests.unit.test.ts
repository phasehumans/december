import { describe, it, expect } from 'bun:test'

import { toPullRequestStateEvent } from '../../src/modules/githubapp/githubapp.utils'
import {
    MAX_DB_INT,
    PULL_REQUEST_SORT_FALLBACK,
    cleanCachedPullRequest,
    decodePullRequestCursor,
    pickSessionPullRequest,
    encodePullRequestCursor,
    searchedPullRequestNumber,
    toPullRequestState,
    toSavedPullRequest,
    webLinkOrNull,
    withSavedPullRequest,
} from '../../src/modules/session/session.utils'

import type {
    PullRequestCursor,
    SavedPullRequestRow,
    SessionPullRequest,
} from '../../src/modules/session/session.types'

// the pure parts of the Pull requests page server code: search numbers, safe links, the
// page cursor, the saved and cached pull request of a session, and the webhook event

const ID = '3f2c9a4e-1b7d-4c8e-9f00-0a1b2c3d4e5f'

describe('searchedPullRequestNumber', () => {
    it('reads a number typed in the search', () => {
        expect(searchedPullRequestNumber('42')).toBe(42)
        expect(searchedPullRequestNumber('1')).toBe(1)
        expect(searchedPullRequestNumber('007')).toBe(7)
    })

    it('takes the largest number the column holds, and nothing past it', () => {
        expect(searchedPullRequestNumber(String(MAX_DB_INT))).toBe(MAX_DB_INT)
        expect(searchedPullRequestNumber(String(MAX_DB_INT + 1))).toBeNull()
        expect(searchedPullRequestNumber('99999999999')).toBeNull()
        expect(searchedPullRequestNumber('9'.repeat(400))).toBeNull()
    })

    it('is null for 0 and for anything that is not only digits', () => {
        for (const text of ['0', '', '#42', '42a', '-1', '4 2', '1.5', '1e3', ' 42', '٤٢']) {
            expect(searchedPullRequestNumber(text)).toBeNull()
        }
    })
})

describe('webLinkOrNull', () => {
    it('keeps http and https links', () => {
        expect(webLinkOrNull('https://github.com/acme/web/pull/1')).toBe(
            'https://github.com/acme/web/pull/1'
        )
        expect(webLinkOrNull('http://gitlab.local/acme/web/-/merge_requests/2')).toBe(
            'http://gitlab.local/acme/web/-/merge_requests/2'
        )
        expect(webLinkOrNull('HTTPS://GitHub.com/a/b/pull/3')).toBe('HTTPS://GitHub.com/a/b/pull/3')
    })

    it('trims spaces around a web link', () => {
        expect(webLinkOrNull('  https://github.com/a/b/pull/4 \n')).toBe(
            'https://github.com/a/b/pull/4'
        )
    })

    it('drops every link that could run code or is not a web page', () => {
        for (const link of [
            'javascript:alert(1)',
            'JavaScript:alert(1)',
            ' javascript:alert(1)',
            'java\tscript:alert(1)',
            'data:text/html,<script>alert(1)</script>',
            'vbscript:msgbox(1)',
            'file:///etc/passwd',
            'mailto:a@b.c',
            'ftp://example.com/x',
            '//evil.example.com/x',
            '/relative/path',
            'not a link',
            '',
        ]) {
            expect(webLinkOrNull(link)).toBeNull()
        }
    })

    it('is null for no link', () => {
        expect(webLinkOrNull(null)).toBeNull()
        expect(webLinkOrNull(undefined)).toBeNull()
    })
})

describe('toPullRequestState', () => {
    it('keeps the four states and reads anything else as open', () => {
        for (const state of ['open', 'draft', 'merged', 'closed'] as const) {
            expect(toPullRequestState(state)).toBe(state)
        }
        for (const value of [null, undefined, '', 'OPEN', 'reopened', 42, {}]) {
            expect(toPullRequestState(value)).toBe('open')
        }
    })
})

describe('the page cursor', () => {
    const cursor = (fields: Partial<PullRequestCursor> = {}): PullRequestCursor => ({
        sortBy: 'prUpdatedAt',
        sortOrder: 'desc',
        value: '2026-11-20T10:00:00.000Z',
        fallback: '2026-11-19T10:00:00.000Z',
        id: ID,
        ...fields,
    })
    const encodeRaw = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url')

    it('reads back what it wrote, for every sort', () => {
        const all: PullRequestCursor[] = [
            cursor(),
            cursor({ sortOrder: 'asc' }),
            cursor({ value: null }),
            cursor({ sortBy: 'prOpenedAt' }),
            cursor({ sortBy: 'updatedAt', fallback: null }),
            cursor({ sortBy: 'createdAt', sortOrder: 'asc', fallback: null }),
        ]
        for (const one of all) {
            const text = encodePullRequestCursor(one)
            // safe in a url as it is
            expect(text).toMatch(/^[A-Za-z0-9_-]+$/)
            expect(decodePullRequestCursor(text)).toEqual(one)
        }
    })

    it('a sort with a fallback column needs the fallback date', () => {
        expect(PULL_REQUEST_SORT_FALLBACK.prUpdatedAt).toBe('updatedAt')
        expect(PULL_REQUEST_SORT_FALLBACK.prOpenedAt).toBe('createdAt')
        expect(decodePullRequestCursor(encodeRaw(cursor({ fallback: null })))).toBeNull()
    })

    it('a sort with no fallback column needs a value and no fallback', () => {
        expect(PULL_REQUEST_SORT_FALLBACK.updatedAt).toBeNull()
        expect(
            decodePullRequestCursor(encodeRaw(cursor({ sortBy: 'updatedAt', value: null })))
        ).toBeNull()
        expect(decodePullRequestCursor(encodeRaw(cursor({ sortBy: 'createdAt' })))).toBeNull()
    })

    it('refuses text that is not a cursor this server made', () => {
        for (const text of [
            'not-a-cursor',
            '!!!',
            encodeRaw(null),
            encodeRaw('text'),
            encodeRaw([]),
            encodeRaw({}),
            encodeRaw(cursor({ sortBy: 'userId' as any })),
            encodeRaw(cursor({ sortBy: '__proto__' as any })),
            encodeRaw(cursor({ sortOrder: 'sideways' as any })),
            encodeRaw(cursor({ id: 'not-a-uuid' })),
            encodeRaw(cursor({ id: `${ID}' OR 1=1 --` })),
            encodeRaw(cursor({ value: 'yesterday' })),
            encodeRaw(cursor({ value: 12345 as any })),
            encodeRaw(cursor({ fallback: { $gt: '' } as any })),
            encodeRaw(cursor({ value: 'x'.repeat(100) })),
        ]) {
            expect(decodePullRequestCursor(text)).toBeNull()
        }
    })
})

describe('the pull request saved on a session', () => {
    const row = (fields: Partial<SavedPullRequestRow> = {}): SavedPullRequestRow => ({
        gitProvider: 'GITHUB',
        title: 'Session title',
        branch: 'main',
        prNumber: 21,
        prUrl: 'https://github.com/acme/web/pull/21',
        prState: 'merged',
        prTitle: 'Add dark mode',
        prBranch: 'december/dark-mode',
        prAdditions: 40,
        prDeletions: 3,
        prOpenedAt: new Date('2026-10-01T09:00:00Z'),
        prUpdatedAt: new Date('2026-10-02T09:00:00Z'),
        prCheckedAt: new Date('2026-10-03T09:00:00Z'),
        ...fields,
    })

    it('is null when the session opened none', () => {
        expect(toSavedPullRequest(row({ prNumber: null }))).toBeNull()
    })

    it('holds only what was saved', () => {
        expect(toSavedPullRequest(row())).toEqual({
            prNumber: 21,
            gitProvider: 'GITHUB',
            url: 'https://github.com/acme/web/pull/21',
            title: 'Add dark mode',
            state: 'merged',
            headRef: 'december/dark-mode',
            diffSummary: { additions: 40, deletions: 3 },
            createdAt: '2026-10-01T09:00:00.000Z',
            // the last change on the host, not the last check
            updatedAt: '2026-10-02T09:00:00.000Z',
        })
    })

    it('never names the base branch as the branch of the pull request', () => {
        expect(toSavedPullRequest(row({ prBranch: null }))?.headRef).toBe('')
    })

    it('falls back to the session title, then the number', () => {
        expect(toSavedPullRequest(row({ prTitle: null }))?.title).toBe('Session title')
        expect(toSavedPullRequest(row({ prTitle: null, title: null }))?.title).toBe(
            'Pull request #21'
        )
    })

    it('drops a link that is not a web link', () => {
        expect(toSavedPullRequest(row({ prUrl: 'javascript:alert(1)' }))).not.toHaveProperty('url')
    })

    it('has no line counts for GitLab, or when one count is missing', () => {
        expect(toSavedPullRequest(row({ gitProvider: 'GITLAB' }))).not.toHaveProperty('diffSummary')
        expect(toSavedPullRequest(row({ prAdditions: null }))).not.toHaveProperty('diffSummary')
        expect(toSavedPullRequest(row({ prDeletions: null }))).not.toHaveProperty('diffSummary')
    })

    it('reads an unknown state as open', () => {
        expect(toSavedPullRequest(row({ prState: null }))?.state).toBe('open')
        expect(toSavedPullRequest(row({ prState: 'weird' }))?.state).toBe('open')
    })
})

describe('the pull request cached after a run', () => {
    const cached = (fields: Partial<SessionPullRequest> = {}): SessionPullRequest => ({
        prNumber: 21,
        url: 'https://github.com/acme/web/pull/21',
        title: 'feat: dark mode',
        state: 'open',
        headRef: 'december/dark-mode',
        baseRef: 'main',
        diffSummary: { additions: 35, deletions: 4, changedFiles: 3 },
        ciStatus: 'passing',
        ...fields,
    })

    it('keeps a GitHub pull request as it is, with its host, but not its old checks', () => {
        const { ciStatus: _checks, ...rest } = cached()
        expect(cleanCachedPullRequest(cached(), 'GITHUB')).toEqual({
            ...rest,
            gitProvider: 'GITHUB',
        })
    })

    it('drops the checks of the run end, so "Checks running" never stays for ever', () => {
        expect(
            cleanCachedPullRequest(cached({ ciStatus: 'pending' }), 'GITHUB')
        ).not.toHaveProperty('ciStatus')
    })

    it('drops a link that is not a web link', () => {
        expect(
            cleanCachedPullRequest(cached({ url: 'javascript:alert(1)' }), 'GITHUB')
        ).not.toHaveProperty('url')
    })

    it('drops GitLab line counts (a 0 there is not a count) but keeps the changed files', () => {
        const clean = cleanCachedPullRequest(
            cached({ diffSummary: { additions: 0, deletions: 0, changedFiles: 2 } }),
            'GITLAB'
        )
        expect(clean.diffSummary).toEqual({ changedFiles: 2 })
        expect(clean.gitProvider).toBe('GITLAB')
    })

    it('has no diff summary when nothing about the diff is known', () => {
        expect(
            cleanCachedPullRequest(
                cached({ diffSummary: { additions: 0, deletions: 0 } }),
                'GITLAB'
            )
        ).not.toHaveProperty('diffSummary')
        expect(
            cleanCachedPullRequest(cached({ diffSummary: undefined }), 'GITHUB')
        ).not.toHaveProperty('diffSummary')
    })

    it('takes the state, title, link, counts and date the row keeps current', () => {
        const saved = toSavedPullRequest({
            gitProvider: 'GITHUB',
            title: 'Session',
            branch: 'main',
            prNumber: 21,
            prUrl: 'https://github.com/acme/web/pull/21?moved',
            prState: 'merged',
            prTitle: 'feat: dark mode (final)',
            prBranch: 'december/dark-mode',
            prAdditions: 51,
            prDeletions: 7,
            prOpenedAt: null,
            prUpdatedAt: new Date('2026-10-05T00:00:00Z'),
            prCheckedAt: null,
        }) as SessionPullRequest
        const merged = withSavedPullRequest(cached(), saved, 'feat: dark mode (final)')
        expect(merged).toEqual({
            prNumber: 21,
            gitProvider: 'GITHUB',
            url: 'https://github.com/acme/web/pull/21?moved',
            title: 'feat: dark mode (final)',
            state: 'merged',
            headRef: 'december/dark-mode',
            // the base branch is only in the cache; its checks are old, so they are left out
            baseRef: 'main',
            diffSummary: { additions: 51, deletions: 7, changedFiles: 3 },
            updatedAt: '2026-10-05T00:00:00.000Z',
        })
    })

    it('keeps the cached title when the row has no title of the pull request', () => {
        const saved = toSavedPullRequest({
            gitProvider: 'GITHUB',
            title: 'Session title',
            branch: null,
            prNumber: 21,
            prUrl: null,
            prState: 'open',
            prTitle: null,
            prBranch: null,
            prAdditions: null,
            prDeletions: null,
            prOpenedAt: null,
            prUpdatedAt: null,
            prCheckedAt: null,
        }) as SessionPullRequest
        const merged = withSavedPullRequest(cached(), saved, null)
        expect(merged.title).toBe('feat: dark mode')
        expect(merged.url).toBe('https://github.com/acme/web/pull/21')
        // the row has no counts: the cached ones stay
        expect(merged.diffSummary).toEqual({ additions: 35, deletions: 4, changedFiles: 3 })
    })

    it('a GitLab row never shows the cached 0 counts', () => {
        const saved = toSavedPullRequest({
            gitProvider: 'GITLAB',
            title: 'MR',
            branch: null,
            prNumber: 21,
            prUrl: 'https://gitlab.com/acme/web/-/merge_requests/21',
            prState: 'open',
            prTitle: 'MR',
            prBranch: 'feat/x',
            prAdditions: 0,
            prDeletions: 0,
            prOpenedAt: null,
            prUpdatedAt: null,
            prCheckedAt: null,
        }) as SessionPullRequest
        const merged = withSavedPullRequest(
            cached({ diffSummary: { additions: 0, deletions: 0, changedFiles: 1 } }),
            saved,
            'MR'
        )
        expect(merged.diffSummary).toEqual({ changedFiles: 1 })
        expect(merged.gitProvider).toBe('GITLAB')
    })
})

describe('toPullRequestStateEvent: repository id and last change', () => {
    const payload = (repository: Record<string, unknown>, pr: Record<string, unknown> = {}) => ({
        action: 'synchronize',
        repository: { name: 'web', owner: { login: 'acme' }, ...repository },
        pull_request: { number: 5, state: 'open', draft: false, ...pr },
    })

    it('sends the repository id as text', () => {
        expect(toPullRequestStateEvent('pull_request', payload({ id: 123456 }))?.repoId).toBe(
            '123456'
        )
        expect(toPullRequestStateEvent('pull_request', payload({ id: '987' }))?.repoId).toBe('987')
    })

    it('sends no repository id when the payload has none or a bad one', () => {
        for (const id of [undefined, null, '', {}, []]) {
            expect(toPullRequestStateEvent('pull_request', payload({ id }))).not.toHaveProperty(
                'repoId'
            )
        }
    })

    it('sends when the pull request last changed, or null', () => {
        expect(
            toPullRequestStateEvent(
                'pull_request',
                payload({ id: 1 }, { updated_at: '2026-01-06T12:00:00Z' })
            )?.updatedAt
        ).toBe('2026-01-06T12:00:00Z')
        expect(toPullRequestStateEvent('pull_request', payload({ id: 1 }))?.updatedAt).toBeNull()
        expect(
            toPullRequestStateEvent('pull_request', payload({ id: 1 }, { updated_at: 5 }))
                ?.updatedAt
        ).toBeNull()
    })
})

describe('the pull request of one session (cache or saved row)', () => {
    const savedRow = (fields: Partial<SavedPullRequestRow> = {}): SavedPullRequestRow => ({
        gitProvider: 'GITHUB',
        title: 'Session',
        branch: 'main',
        prNumber: 21,
        prUrl: 'https://github.com/acme/web/pull/21',
        prState: 'merged',
        prTitle: 'feat: dark mode',
        prBranch: 'december/dark-mode',
        prAdditions: 5,
        prDeletions: 1,
        prOpenedAt: null,
        prUpdatedAt: null,
        prCheckedAt: null,
        ...fields,
    })
    // what the worker caches when "open pull request" is off: no number, made-up checks
    const branchOnly: SessionPullRequest = {
        title: 'Refactor the cart',
        state: 'branch',
        headRef: 'feat/cart',
        baseRef: 'main',
        diffSummary: { additions: 0, deletions: 0, changedFiles: 3 },
        ciStatus: 'pending',
    }

    it('a branch-only run is no pull request', () => {
        expect(
            pickSessionPullRequest({
                cached: branchOnly,
                saved: null,
                savedPrTitle: null,
                gitProvider: 'GITHUB',
            })
        ).toBeNull()
    })

    it('a branch-only cache does not hide the pull request the row saved', () => {
        const saved = toSavedPullRequest(savedRow())
        expect(
            pickSessionPullRequest({
                cached: branchOnly,
                saved,
                savedPrTitle: 'feat: dark mode',
                gitProvider: 'GITHUB',
            })
        ).toEqual(saved)
    })

    it('the same pull request: the row state over the cache, with the base branch', () => {
        const picked = pickSessionPullRequest({
            cached: {
                prNumber: 21,
                title: 'feat: dark mode',
                state: 'open',
                headRef: 'december/dark-mode',
                baseRef: 'main',
                ciStatus: 'pending',
            },
            saved: toSavedPullRequest(savedRow()),
            savedPrTitle: 'feat: dark mode',
            gitProvider: 'GITHUB',
        })
        expect(picked?.state).toBe('merged')
        expect(picked?.baseRef).toBe('main')
        expect(picked).not.toHaveProperty('ciStatus')
    })

    it('a cache of another pull request: the saved one answers', () => {
        const saved = toSavedPullRequest(savedRow({ prNumber: 30 }))
        expect(
            pickSessionPullRequest({
                cached: { prNumber: 21, title: 'old', state: 'open', headRef: 'x' },
                saved,
                savedPrTitle: null,
                gitProvider: 'GITHUB',
            })
        ).toEqual(saved)
    })

    it('a cached pull request the row did not save still shows, cleaned', () => {
        const picked = pickSessionPullRequest({
            cached: { prNumber: 9, title: 'MR', state: 'open', headRef: 'x', ciStatus: 'failed' },
            saved: null,
            savedPrTitle: null,
            gitProvider: 'GITLAB',
        })
        expect(picked).toEqual({
            prNumber: 9,
            title: 'MR',
            state: 'open',
            headRef: 'x',
            gitProvider: 'GITLAB',
        })
    })
})
