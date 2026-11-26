import { GlobalRegistrator } from '@happy-dom/global-registrator'
import { expect, test, describe, mock, afterEach, spyOn } from 'bun:test'
import React from 'react'

import { useAppStore } from '../src/app/store'
import { PlanChecklistPanel } from '../src/features/preview/components/PlanChecklistPanel'
import { pullRequestUrlOf } from '../src/features/pullrequests/lib/pullRequests'
import { sessionAPI } from '../src/features/sessions/api/session'
import { SessionListRow } from '../src/features/sessions/components/SessionListRow'
import { openExternal, repoOfSession } from '../src/features/sessions/lib/sessionLinks'

import type { BackendSession } from '../src/features/sessions/api/session'

if (!globalThis.document) {
    GlobalRegistrator.register()
}

const { render, screen, fireEvent, cleanup } = await import('@testing-library/react')

afterEach(() => {
    cleanup()
    mock.restore()
})

const session = (overrides: Partial<BackendSession> = {}): BackendSession => ({
    id: 'sess-1',
    title: 'Session',
    type: 'WEB',
    createdAt: '2026-11-01T00:00:00.000Z',
    updatedAt: '2026-11-01T00:00:00.000Z',
    lastMessage: null,
    ...overrides,
})

describe('New session in this repo', () => {
    test('joins the owner and the name the list sends apart', () => {
        const repo = repoOfSession(
            session({ githubRepoOwner: 'acme', githubRepoName: 'web', branch: 'dev' })
        )
        expect(repo?.fullName).toBe('acme/web')
        expect(repo?.defaultBranch).toBe('dev')
    })

    test('still reads an old row with owner/name in the name', () => {
        expect(repoOfSession(session({ githubRepoName: 'acme/api' }))?.fullName).toBe('acme/api')
    })

    test('a GitLab session gets no GitHub repository', () => {
        expect(
            repoOfSession(
                session({
                    gitProvider: 'GITLAB',
                    githubRepoOwner: 'group',
                    githubRepoName: 'project',
                    repoUrl: 'https://gitlab.com/group/project',
                })
            )
        ).toBeNull()
    })
})

describe('links to other sites', () => {
    test('a saved pull request link that is not http(s) is never used', () => {
        expect(pullRequestUrlOf(session({ prNumber: 3, prUrl: 'javascript:alert(1)' }))).toBeNull()
        expect(pullRequestUrlOf(session({ prNumber: 3, repoUrl: 'file:///etc/passwd' }))).toBeNull()
        expect(
            pullRequestUrlOf(session({ prNumber: 3, repoUrl: 'https://github.com/acme/web.git' }))
        ).toBe('https://github.com/acme/web/pull/3')
    })

    test('openExternal opens web links only', () => {
        const open = spyOn(window, 'open').mockImplementation(() => null)
        openExternal('javascript:alert(1)')
        expect(open).not.toHaveBeenCalled()
        openExternal('https://github.com/acme/web/pull/3')
        expect(open).toHaveBeenCalledWith(
            'https://github.com/acme/web/pull/3',
            '_blank',
            'noopener,noreferrer'
        )
    })
})

describe('the plan tab', () => {
    test('shows "No plan yet" and no made-up steps when the agent wrote no plan', async () => {
        useAppStore.setState({ sessionPlan: null })
        sessionAPI.getSessionPlan = mock(async () => ({ plan: null }))
        render(<PlanChecklistPanel sessionId="sess-no-plan" />)
        expect(screen.getByText('No plan yet')).not.toBeNull()
        expect(screen.queryByText('Reproduce & Understand')).toBeNull()
    })
})

describe('the desktop ⋯ menu of a Sessions row', () => {
    const renderRow = (isMenuOpen: boolean) => {
        const handlers = {
            onOpenRename: mock(),
            onOpenTags: mock(),
            onToggleArchiveFromMenu: mock(),
            onOpenDelete: mock(),
            onCloseMenu: mock(),
            onOpenProject: mock(),
            onToggleMenu: mock(),
        }
        render(
            <SessionListRow
                project={session({ title: 'Row' })}
                isMenuOpen={isMenuOpen}
                {...handlers}
            />
        )
        // the phone row comes first in the markup; the desktop ⋯ is the last one
        const triggers = screen.getAllByRole('button', { name: 'Session options' })
        return { handlers, trigger: triggers[triggers.length - 1] as HTMLElement }
    }

    test('a press on ⋯ while open is not a click outside, so the click can close it', () => {
        const { handlers, trigger } = renderRow(true)
        fireEvent.mouseDown(trigger)
        expect(handlers.onCloseMenu).not.toHaveBeenCalled()
        fireEvent.click(trigger)
        expect(handlers.onToggleMenu).toHaveBeenCalledTimes(1)
    })

    test('a press outside closes it', () => {
        const { handlers } = renderRow(true)
        fireEvent.mouseDown(document.body)
        expect(handlers.onCloseMenu).toHaveBeenCalledTimes(1)
    })

    test('Escape closes it and gives focus back to ⋯', () => {
        const { handlers, trigger } = renderRow(true)
        fireEvent.keyDown(document, { key: 'Escape' })
        expect(handlers.onCloseMenu).toHaveBeenCalled()
        expect(document.activeElement).toBe(trigger)
    })

    test('the arrow keys move between the menu rows', () => {
        renderRow(true)
        const items = screen.getAllByRole('menuitem')
        expect(document.activeElement).toBe(items[0])
        fireEvent.keyDown(document, { key: 'ArrowDown' })
        expect(document.activeElement).toBe(items[1])
        fireEvent.keyDown(document, { key: 'End' })
        expect(document.activeElement).toBe(items[items.length - 1])
    })
})
