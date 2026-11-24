import { GlobalRegistrator } from '@happy-dom/global-registrator'
import { expect, test, describe, mock, spyOn, afterEach } from 'bun:test'
import React from 'react'

import { SessionListRow } from '../src/features/sessions/components/SessionListRow'

if (!globalThis.document) {
    GlobalRegistrator.register()
}

const { render, screen, fireEvent, cleanup, within } = await import('@testing-library/react')

afterEach(() => {
    cleanup()
    mock.restore()
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

const renderRow = (overrides: Record<string, unknown> = {}, isMenuOpen = true) => {
    const handlers = {
        onOpenRename: mock(),
        onOpenTags: mock(),
        onToggleArchiveFromMenu: mock(),
        onOpenDelete: mock(),
        onStopSession: mock(),
        onCloseMenu: mock(),
        onOpenProject: mock(),
        onToggleMenu: mock(),
    }
    render(
        <SessionListRow
            project={{ ...sampleSession, ...overrides }}
            isMenuOpen={isMenuOpen}
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

    test('desktop menu has three groups: open, manage, Delete', () => {
        const handlers = renderRow()
        const open = spyOn(window, 'open').mockImplementation(() => null)
        const menu = screen.getByRole('menu')
        const rows = within(menu)
            .getAllByRole('menuitem')
            .map((item) => item.textContent?.trim())
        expect(rows).toEqual([
            'Open pull request',
            'New session in this repo',
            'Open in new tab',
            'Rename',
            'Tags',
            'Archive',
            'Stop',
            'Delete',
        ])
        expect(menu.querySelectorAll('.h-px').length).toBe(2)

        fireEvent.click(within(menu).getByRole('menuitem', { name: 'Open in new tab' }))
        expect(open).toHaveBeenCalledWith('/sessions/session-123', '_blank', 'noopener')
        expect(handlers.onCloseMenu).toHaveBeenCalled()
        expect(handlers.onOpenProject).not.toHaveBeenCalled()
    })

    test('a session with no pull request and no repository only gets Open in new tab', () => {
        renderRow({ prNumber: null, prUrl: null, githubRepoName: null })
        const rows = within(screen.getByRole('menu'))
            .getAllByRole('menuitem')
            .map((item) => item.textContent?.trim())
        expect(rows).toEqual(['Open in new tab', 'Rename', 'Tags', 'Archive', 'Stop', 'Delete'])
    })

    test('a right-click on the desktop row opens the menu', () => {
        const handlers = renderRow({}, false)
        expect(screen.queryByRole('menu')).toBeNull()
        const row = screen
            .getByRole('link', { name: 'Test Session' })
            .closest('.group') as HTMLElement
        fireEvent.contextMenu(row, { clientX: 120, clientY: 80 })
        expect(handlers.onToggleMenu).toHaveBeenCalledTimes(1)
        expect(handlers.onToggleMenu.mock.calls[0][0]).toBe('session-123')
    })

    test('the title is a link, and a ctrl click on the row opens a new tab', () => {
        const handlers = renderRow({}, false)
        const open = spyOn(window, 'open').mockImplementation(() => null)
        const link = screen.getByRole('link', { name: 'Test Session' })
        expect(link.getAttribute('href')).toBe('/sessions/session-123')

        // a plain click on the title opens the session in the app
        fireEvent.click(link)
        expect(handlers.onOpenProject).toHaveBeenCalledWith('session-123')
        expect(open).not.toHaveBeenCalled()

        // a ctrl click on the title is left to the browser
        fireEvent.click(link, { ctrlKey: true })
        expect(handlers.onOpenProject).toHaveBeenCalledTimes(1)
        expect(open).not.toHaveBeenCalled()

        // a ctrl click on the rest of the row opens a new tab
        fireEvent.click(link.closest('.group') as HTMLElement, { ctrlKey: true })
        expect(open).toHaveBeenCalledWith('/sessions/session-123', '_blank', 'noopener')
        expect(handlers.onOpenProject).toHaveBeenCalledTimes(1)
    })

    test('on a phone the menu opens as a bottom sheet', () => {
        withPhone(() => {
            const handlers = renderRow()
            const sheet = screen.getByRole('dialog', { name: 'Session options' })
            const rows = within(sheet)
                .getAllByRole('button')
                .map((button) => button.textContent?.trim())
            // the two open rows that fit a phone come first. no Open in new tab
            expect(rows).toEqual([
                'Open pull request',
                'New session in this repo',
                'Rename',
                'Tags',
                'Archive',
                'Stop',
                'Delete',
            ])
            // no divider line above Delete in the sheet
            expect(sheet.querySelector('.h-\\[1px\\]')).toBeNull()

            fireEvent.click(within(sheet).getByRole('button', { name: 'Delete' }))
            expect(handlers.onOpenDelete).toHaveBeenCalled()
        })
    })
})
