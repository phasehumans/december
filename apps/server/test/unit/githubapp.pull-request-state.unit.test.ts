import { describe, it, expect } from 'bun:test'

import { toPullRequestStateEvent } from '../../src/modules/githubapp/githubapp.utils'

// issue 632, section 4a: the pull_request webhook keeps the saved pull request state current
describe('toPullRequestStateEvent', () => {
    // the fields of a GitHub pull_request webhook that the state is read from
    const payload = (action: string, pr: Record<string, unknown> = {}) => ({
        action,
        repository: { name: 'web', full_name: 'acme/web', owner: { login: 'acme' } },
        pull_request: {
            number: 412,
            title: 'fix: login redirect loop',
            state: 'open',
            draft: false,
            merged: false,
            merged_at: null,
            closed_at: null,
            created_at: '2026-01-03T10:00:00Z',
            additions: 40,
            deletions: 2,
            ...pr,
        },
    })

    const stateOf = (action: string, pr: Record<string, unknown> = {}) =>
        toPullRequestStateEvent('pull_request', payload(action, pr))?.state

    it('closed and merged gives merged', () => {
        expect(
            stateOf('closed', {
                state: 'closed',
                merged: true,
                merged_at: '2026-01-04T10:00:00Z',
                closed_at: '2026-01-04T10:00:00Z',
            })
        ).toBe('merged')
    })

    it('closed and not merged gives closed', () => {
        expect(stateOf('closed', { state: 'closed', closed_at: '2026-01-05T00:00:00Z' })).toBe(
            'closed'
        )
    })

    it('reopened gives open', () => {
        expect(stateOf('reopened')).toBe('open')
    })

    it('converted_to_draft gives draft', () => {
        expect(stateOf('converted_to_draft', { draft: true })).toBe('draft')
    })

    it('ready_for_review gives open', () => {
        expect(stateOf('ready_for_review', { draft: false })).toBe('open')
    })

    it('returns the repository, the number and the saved details with the state', () => {
        expect(
            toPullRequestStateEvent(
                'pull_request',
                payload('closed', {
                    state: 'closed',
                    merged: true,
                    merged_at: '2026-01-04T10:00:00Z',
                    closed_at: '2026-01-04T10:00:00Z',
                })
            )
        ).toEqual({
            gitProvider: 'GITHUB',
            repoOwner: 'acme',
            repoName: 'web',
            number: 412,
            state: 'merged',
            title: 'fix: login redirect loop',
            additions: 40,
            deletions: 2,
            openedAt: '2026-01-03T10:00:00Z',
            mergedAt: '2026-01-04T10:00:00Z',
            closedAt: '2026-01-04T10:00:00Z',
        })
    })

    it('ignores the actions that do not change the state', () => {
        for (const action of [
            'labeled',
            'unlabeled',
            'assigned',
            'review_requested',
            'locked',
            'auto_merge_enabled',
        ]) {
            expect(toPullRequestStateEvent('pull_request', payload(action))).toBeNull()
        }
    })

    it('ignores other webhook events', () => {
        expect(toPullRequestStateEvent('pull_request_review', payload('closed'))).toBeNull()
        expect(toPullRequestStateEvent('issues', payload('closed'))).toBeNull()
        expect(toPullRequestStateEvent(undefined, payload('closed'))).toBeNull()
    })

    it('ignores a payload with no pull request or no repository', () => {
        expect(toPullRequestStateEvent('pull_request', { action: 'closed' })).toBeNull()
        expect(
            toPullRequestStateEvent('pull_request', {
                action: 'closed',
                pull_request: { number: 412, state: 'closed' },
            })
        ).toBeNull()
        expect(
            toPullRequestStateEvent('pull_request', {
                ...payload('closed'),
                pull_request: { state: 'closed' },
            })
        ).toBeNull()
    })
})
