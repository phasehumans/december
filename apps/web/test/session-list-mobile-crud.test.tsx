import { GlobalRegistrator } from '@happy-dom/global-registrator'
import { expect, test, describe, mock, afterEach } from 'bun:test'
import React from 'react'

import { SessionListRow } from '../src/features/sessions/components/SessionListRow'

if (!globalThis.document) {
    GlobalRegistrator.register()
}

const { render, screen, fireEvent, cleanup, within } = await import('@testing-library/react')

afterEach(() => {
    cleanup()
})

const sampleSession = {
    id: 'session-123',
    title: 'Test Session',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    lastMessage: 'Hello world',
    tags: ['React', 'api', 'web'],
    isArchived: false,
    vmStatus: 'RUNNING',
    githubRepoName: 'acme/web',
    branch: 'feat/login',
    prNumber: 42,
    prState: 'merged',
    prUrl: 'https://github.com/acme/web/pull/42',
}

const renderRow = (overrides: Record<string, unknown> = {}) => {
    const handlers = {
        onOpenRename: mock(),
        onOpenTags: mock(),
        onToggleArchiveFromMenu: mock(),
        onOpenDelete: mock(),
        onStopSession: mock(),
        onCloseMenu: mock(),
    }
    render(
        <SessionListRow
            project={{ ...sampleSession, ...overrides }}
            isMenuOpen={true}
            onOpenProject={mock()}
            onToggleMenu={mock()}
            {...handlers}
        />
    )
    return handlers
}

const withPhone = (run: () => void) => {
    const original = window.matchMedia
    window.matchMedia = ((query: string) => ({
        matches: query.includes('max-width'),
        media: query,
        addEventListener: () => {},
        removeEventListener: () => {},
    })) as never
    try {
        run()
    } finally {
        window.matchMedia = original
    }
}

describe('SessionListRow', () => {
    test('shows repo, branch, status, more tags and a PR chip, without the last message', () => {
        renderRow()
        expect(screen.getAllByText('web').length).toBeGreaterThan(0)
        expect(screen.getAllByText('feat/login').length).toBeGreaterThan(0)
        expect(screen.getAllByText('Running').length).toBeGreaterThan(0)
        expect(screen.getAllByText('+2').length).toBeGreaterThan(0)
        expect(screen.queryByText('Hello world')).toBeNull()
        expect(screen.queryByText('No messages yet...')).toBeNull()

        const chips = screen.getAllByRole('button', { name: 'Open pull request 42 on GitHub' })
        expect(chips[0].className).toContain('text-[#C084FC]')
    })

    test('a starting session says Starting', () => {
        renderRow({ vmStatus: 'PROVISIONING' })
        expect(screen.getAllByText('Starting').length).toBeGreaterThan(0)
        expect(screen.queryByText('Provisioning')).toBeNull()
    })

    test('desktop menu has no Open item and says Stop', () => {
        const handlers = renderRow()
        expect(screen.queryByRole('button', { name: /^Open$/ })).toBeNull()

        // the shared session menu uses menu roles, so arrow keys work in it
        fireEvent.click(screen.getByRole('menuitem', { name: /Rename/i }))
        expect(handlers.onOpenRename).toHaveBeenCalled()
        fireEvent.click(screen.getByRole('menuitem', { name: /Tags/i }))
        expect(handlers.onOpenTags).toHaveBeenCalled()
        fireEvent.click(screen.getByRole('menuitem', { name: /^\s*Archive$/i }))
        expect(handlers.onToggleArchiveFromMenu).toHaveBeenCalled()
        fireEvent.click(screen.getByRole('menuitem', { name: /^\s*Stop$/i }))
        expect(handlers.onStopSession).toHaveBeenCalled()
        fireEvent.click(screen.getByRole('menuitem', { name: /Delete/i }))
        expect(handlers.onOpenDelete).toHaveBeenCalled()
    })

    test('on a phone the menu opens as a bottom sheet', () => {
        withPhone(() => {
            const handlers = renderRow()
            const sheet = screen.getByRole('dialog', { name: 'Session options' })
            const rows = within(sheet)
                .getAllByRole('button')
                .map((button) => button.textContent?.trim())
            expect(rows).toEqual(['Rename', 'Tags', 'Archive', 'Stop', 'Delete'])
            // no divider line above Delete in the sheet
            expect(sheet.querySelector('.h-\\[1px\\]')).toBeNull()

            fireEvent.click(within(sheet).getByRole('button', { name: 'Delete' }))
            expect(handlers.onOpenDelete).toHaveBeenCalled()
        })
    })
})
