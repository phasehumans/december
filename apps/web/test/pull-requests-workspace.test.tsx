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

    test('renders pending/empty fallback with task branch details when no PR exists', () => {
        render(<PullRequestsWorkspace sessionId="sess-no-pr" />)

        expect(screen.getByText(/no pull request created yet/i)).not.toBeNull()
        expect(screen.getByText('december/sess-no-pr')).not.toBeNull()
    })
})
