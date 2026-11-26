import { GlobalRegistrator } from '@happy-dom/global-registrator'
import { expect, test, describe, afterEach, beforeEach, mock } from 'bun:test'
import React from 'react'

import { useAppStore } from '../src/app/store'
import { PullRequestsWorkspace } from '../src/features/preview/components/PullRequestsWorkspace'
import { sessionAPI } from '../src/features/sessions/api/session'

if (!globalThis.document) {
    GlobalRegistrator.register()
}

const { render, screen, cleanup } = await import('@testing-library/react')

describe('Functional Pull Requests Workspace (Ticket #587)', () => {
    beforeEach(() => {
        useAppStore.setState({
            pullRequest: null,
        })
    })

    afterEach(() => {
        cleanup()
    })

    test('a pull request saved on the session shows no made-up checks or base branch', async () => {
        // the server sends only what the session row saved
        useAppStore.setState({
            pullRequest: {
                prNumber: 21,
                title: 'Add dark mode',
                url: 'https://github.com/acme/web/pull/21',
                state: 'merged',
                headRef: 'december/dark-mode',
                diffSummary: { additions: 40, deletions: 3 },
            },
        })

        render(<PullRequestsWorkspace sessionId="sess-saved-21" />)

        expect(screen.getByText('Add dark mode')).not.toBeNull()
        expect(screen.getByText('+40')).not.toBeNull()
        expect(screen.getByText('-3')).not.toBeNull()
        expect(screen.queryByText('main')).toBeNull()
        expect(screen.queryByText('Continuous Integration')).toBeNull()
        expect(screen.queryByText('All checks passed')).toBeNull()
        expect(screen.queryByText(/files? changed/)).toBeNull()
    })

    test('renders live PR status badge, number, title, branches, diff summary, and github link', async () => {
        const mockPr = {
            prNumber: 88,
            title: 'Add search filter to dashboard',
            url: 'https://github.com/phasehumans/december/pull/88',
            state: 'open',
            headRef: 'december/sess-test-88',
            baseRef: 'main',
            diffSummary: {
                additions: 120,
                deletions: 15,
                changedFiles: 4,
            },
            ciStatus: 'passing' as const,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        }

        useAppStore.setState({
            pullRequest: mockPr,
        })

        render(<PullRequestsWorkspace sessionId="sess-test-88" />)

        // Status badge
        expect(screen.getByText('Open')).not.toBeNull()

        // PR title and number
        expect(screen.getByText(/#88/)).not.toBeNull()
        expect(screen.getByText('Add search filter to dashboard')).not.toBeNull()

        // Branches
        expect(screen.getAllByText('december/sess-test-88').length).toBeGreaterThan(0)
        expect(screen.getByText('main')).not.toBeNull()

        // Diff summary metrics
        expect(screen.getByText('+120')).not.toBeNull()
        expect(screen.getByText('-15')).not.toBeNull()
        expect(screen.getByText('4 files changed')).not.toBeNull()

        // GitHub external link
        const githubLink = screen.getByRole('link', { name: /view on github/i })
        expect(githubLink).not.toBeNull()
        expect(githubLink.getAttribute('href')).toBe(
            'https://github.com/phasehumans/december/pull/88'
        )
        expect(githubLink.getAttribute('target')).toBe('_blank')

        // CI status
        expect(screen.getByText(/all checks passed/i)).not.toBeNull()
    })

    test('fetches PR data on mount when pullRequest store is null', async () => {
        const mockPr = {
            prNumber: 99,
            title: 'Implement terminal bridge',
            url: 'https://github.com/phasehumans/december/pull/99',
            state: 'open',
            headRef: 'december/sess-mount-99',
            baseRef: 'main',
            diffSummary: {
                additions: 45,
                deletions: 2,
                changedFiles: 1,
            },
            ciStatus: 'pending' as const,
        }

        sessionAPI.getSessionPullRequests = mock(async () => ({
            pullRequest: mockPr,
        }))

        render(<PullRequestsWorkspace sessionId="sess-mount-99" />)

        // Should call sessionAPI.getSessionPullRequests
        expect(sessionAPI.getSessionPullRequests).toHaveBeenCalledWith('sess-mount-99')
    })

    test('names no branch before a pull request when the session has no saved branch', () => {
        render(<PullRequestsWorkspace sessionId="sess-no-pr" />)

        expect(screen.getByText(/no pull request created yet/i)).not.toBeNull()
        // the branch prefix is a setting: the name is not `december/<id>` for every user
        expect(screen.queryByText(/december\/sess-no-pr/)).toBeNull()
    })

    test('names the saved branch of the session before a pull request', () => {
        render(<PullRequestsWorkspace sessionId="sess-no-pr" branch="feat/ai-sess-no-pr" />)

        expect(screen.getByText('feat/ai-sess-no-pr')).not.toBeNull()
    })

    test('shows the real branch and no fixed commit author', () => {
        useAppStore.setState({
            pullRequest: {
                prNumber: 7,
                title: 'Rename the settings page',
                state: 'open',
                baseRef: 'main',
                diffSummary: { additions: 1, deletions: 1, changedFiles: 1 },
                ciStatus: 'passing' as const,
            } as any,
        })

        render(<PullRequestsWorkspace sessionId="sess-7" branch="feat/ai-sess-7" />)

        expect(screen.getAllByText('feat/ai-sess-7').length).toBeGreaterThan(0)
        expect(screen.queryByText(/december\/sess-7/)).toBeNull()
        // the commit author is a setting (December, or the user with December as co-author)
        expect(screen.queryByText(/December Agent/)).toBeNull()
    })
})
