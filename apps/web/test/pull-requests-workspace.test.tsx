import { GlobalRegistrator } from '@happy-dom/global-registrator'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { expect, test, describe, afterEach, beforeEach, mock } from 'bun:test'
import React from 'react'
import { MemoryRouter } from 'react-router-dom'

import { useAppStore } from '../src/app/store'
import { PullRequestsWorkspace } from '../src/features/preview/components/PullRequestsWorkspace'
import { sessionAPI } from '../src/features/sessions/api/session'
import { useSessionController } from '../src/features/sessions/hooks/useSessionController'

if (!globalThis.document) {
    GlobalRegistrator.register()
}

const { render, renderHook, screen, cleanup, waitFor, act } = await import('@testing-library/react')

describe('Functional Pull Requests Workspace (Ticket #587)', () => {
    beforeEach(() => {
        useAppStore.setState({
            pullRequest: null,
        })
        // the view reads the pull request each time it opens: by default the session has none
        sessionAPI.getSessionPullRequests = mock(async () => ({ pullRequest: null }))
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
        // no checks or tests the run did not do are claimed
        expect(screen.queryByText(/Verification Notes/i)).toBeNull()
        expect(screen.queryByText(/executed cleanly/i)).toBeNull()
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

    test('names no branch before a pull request when the session has no saved branch', async () => {
        render(<PullRequestsWorkspace sessionId="sess-no-pr" />)

        expect(await screen.findByText(/no pull request yet/i)).not.toBeNull()
        // no promise of a pull request: opening one can be off for the session
        expect(screen.queryByText(/will be generated/i)).toBeNull()
        // the branch prefix is a setting: the name is not `december/<id>` for every user
        expect(screen.queryByText(/december\/sess-no-pr/)).toBeNull()
    })

    test('names the saved branch of the session before a pull request', async () => {
        render(<PullRequestsWorkspace sessionId="sess-no-pr" branch="feat/ai-sess-no-pr" />)

        expect(await screen.findByText('feat/ai-sess-no-pr')).not.toBeNull()
    })

    test('a run that pushed only a branch shows no pull request and no checks', async () => {
        // what the worker sends when "open pull request" is off: no number, no checks
        useAppStore.setState({
            pullRequest: {
                title: 'Refactor the cart',
                state: 'branch',
                headRef: 'feat/cart',
                baseRef: 'main',
                diffSummary: { additions: 0, deletions: 0, changedFiles: 3 },
                ciStatus: 'pending',
            },
        })
        render(<PullRequestsWorkspace sessionId="sess-branch" />)

        expect(await screen.findByText(/no pull request yet/i)).not.toBeNull()
        expect(screen.queryByText('Open')).toBeNull()
        expect(screen.queryByText(/checks running/i)).toBeNull()
        expect(screen.queryByText('+0')).toBeNull()
    })

    test('"No pull request yet" does not show while the pull request is on the way', async () => {
        let answer: (value: { pullRequest: any }) => void = () => {}
        sessionAPI.getSessionPullRequests = mock(
            () =>
                new Promise<{ pullRequest: any }>((resolve) => {
                    answer = resolve
                })
        )
        render(<PullRequestsWorkspace sessionId="sess-slow" />)
        expect(screen.queryByText(/no pull request yet/i)).toBeNull()

        await act(async () => {
            answer({
                pullRequest: { prNumber: 3, title: 'Slow one', state: 'open', headRef: 'feat/s' },
            })
        })
        expect(screen.getByText('Slow one')).not.toBeNull()
    })

    test('a failed read says so and Retry reads again', async () => {
        let calls = 0
        sessionAPI.getSessionPullRequests = mock(async () => {
            calls += 1
            if (calls === 1) throw new Error('offline')
            return {
                pullRequest: { prNumber: 4, title: 'Back again', state: 'open', headRef: 'f' },
            }
        })
        render(<PullRequestsWorkspace sessionId="sess-fail" />)

        expect(await screen.findByText(/could not load the pull request/i)).not.toBeNull()
        expect(screen.queryByText(/no pull request yet/i)).toBeNull()
        await act(async () => {
            screen.getByRole('button', { name: 'Retry' }).click()
        })
        expect(await screen.findByText('Back again')).not.toBeNull()
        expect(calls).toBe(2)
    })

    test('opening the view reads the pull request again, so a merge on the host shows', async () => {
        useAppStore.setState({
            pullRequest: { prNumber: 12, title: 'Ship it', state: 'open', headRef: 'feat/ship' },
        })
        sessionAPI.getSessionPullRequests = mock(async () => ({
            pullRequest: { prNumber: 12, title: 'Ship it', state: 'merged', headRef: 'feat/ship' },
        }))
        render(<PullRequestsWorkspace sessionId="sess-ship" />)

        expect(await screen.findByText('Merged')).not.toBeNull()
        expect(sessionAPI.getSessionPullRequests).toHaveBeenCalledWith('sess-ship')
    })

    test('a new message empties the store: the pull request is read again', async () => {
        const pr = { prNumber: 14, title: 'Keep me', state: 'open', headRef: 'feat/keep' }
        useAppStore.setState({ pullRequest: pr })
        sessionAPI.getSessionPullRequests = mock(async () => ({ pullRequest: pr }))
        render(<PullRequestsWorkspace sessionId="sess-keep" />)
        await waitFor(() => expect(sessionAPI.getSessionPullRequests).toHaveBeenCalledTimes(1))

        await act(async () => {
            useAppStore.getState().setPullRequest(null)
        })
        await waitFor(() => expect(sessionAPI.getSessionPullRequests).toHaveBeenCalledTimes(2))
        expect(await screen.findByText('Keep me')).not.toBeNull()
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

    test('a draft pull request reads Draft, not Closed', () => {
        useAppStore.setState({
            pullRequest: { prNumber: 5, title: 'Wip', state: 'draft', headRef: 'feat/wip' },
        })
        render(<PullRequestsWorkspace sessionId="sess-draft" />)

        expect(screen.getByText('Draft')).not.toBeNull()
        expect(screen.queryByText('Closed')).toBeNull()
    })

    test('a link that is not a web link is not shown', () => {
        useAppStore.setState({
            pullRequest: {
                prNumber: 6,
                title: 'Bad link',
                url: 'javascript:alert(1)',
                state: 'open',
                headRef: 'feat/x',
            },
        })
        const { container } = render(<PullRequestsWorkspace sessionId="sess-link" />)

        expect(screen.queryByRole('link')).toBeNull()
        expect(container.querySelector('a[href^="javascript"]')).toBeNull()
    })

    test('a GitLab merge request names GitLab and shows no made-up line counts', () => {
        useAppStore.setState({
            pullRequest: {
                prNumber: 9,
                gitProvider: 'GITLAB',
                title: 'Fix login',
                url: 'https://gitlab.com/acme/web/-/merge_requests/9',
                state: 'open',
                headRef: 'feat/login',
            },
        })
        render(<PullRequestsWorkspace sessionId="sess-gitlab" />)

        expect(screen.getByRole('link', { name: /view on gitlab/i })).not.toBeNull()
        expect(screen.queryByText('+0')).toBeNull()
        expect(screen.queryByText('-0')).toBeNull()
        // nothing is known about the diff: no empty Diff Summary box
        expect(screen.queryByText('Diff Summary')).toBeNull()
    })

    test('the answer of a session left before it came does not show on the next one', async () => {
        let answerFirst: (value: { pullRequest: any }) => void = () => {}
        sessionAPI.getSessionPullRequests = mock((sessionId: string) =>
            sessionId === 'sess-first'
                ? new Promise<{ pullRequest: any }>((resolve) => {
                      answerFirst = resolve
                  })
                : Promise.resolve({
                      pullRequest: { prNumber: 2, title: 'Second', state: 'open', headRef: 'b' },
                  })
        )

        const view = render(<PullRequestsWorkspace sessionId="sess-first" />)
        view.rerender(<PullRequestsWorkspace sessionId="sess-second" />)
        expect(await screen.findByText('Second')).not.toBeNull()

        await act(async () => {
            answerFirst({
                pullRequest: { prNumber: 1, title: 'First', state: 'open', headRef: 'a' },
            })
        })
        expect(screen.queryByText('First')).toBeNull()
        expect(useAppStore.getState().pullRequest?.prNumber).toBe(2)
    })

    test('opening another session drops the pull request of the one before', async () => {
        useAppStore.setState({
            pullRequest: { prNumber: 1, title: 'First', state: 'open', headRef: 'a' },
        })
        sessionAPI.getSessionDetail = mock(async () => ({
            session: { id: 'sess-second', title: 'Second' },
            chatMessages: [],
        })) as any

        const client = new QueryClient()
        const { result } = renderHook(
            () =>
                useSessionController(
                    'sessions',
                    () => {},
                    () => {},
                    { current: 'sessions' }
                ),
            {
                wrapper: ({ children }) => (
                    <QueryClientProvider client={client}>
                        <MemoryRouter>{children}</MemoryRouter>
                    </QueryClientProvider>
                ),
            }
        )

        await act(async () => {
            await result.current.openProject({ projectId: 'sess-second' })
        })
        await waitFor(() => expect(useAppStore.getState().pullRequest).toBeNull())
    })
})
