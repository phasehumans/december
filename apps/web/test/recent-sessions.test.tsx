import { GlobalRegistrator } from '@happy-dom/global-registrator'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { expect, test, describe, spyOn, afterEach, beforeEach, mock } from 'bun:test'
import React from 'react'

if (!globalThis.document) {
    GlobalRegistrator.register()
}

const { render, screen, fireEvent, cleanup, waitFor, act } = await import('@testing-library/react')
const { MemoryRouter } = await import('react-router-dom')
const { useAppStore } = await import('../src/app/store')
const { generationAPI } = await import('../src/features/generation/api/generation')
const { takeHomePrefill } = await import('../src/features/home/prefill')
const { MobileMenuSheet } = await import('../src/features/navigation/components/MobileMenuSheet')
const { RecentSessions } = await import('../src/features/navigation/components/RecentSessions')
const { sessionAPI } = await import('../src/features/sessions/api/session')
const { SessionDeleteModal } =
    await import('../src/features/sessions/components/SessionDeleteModal')
const { NEW_SESSION_REQUEST_EVENT } = await import('../src/shared/lib/appEvents')

const now = new Date().toISOString()
const session = (over: Record<string, unknown>) => ({
    id: 's1',
    title: 'Fix login redirect loop',
    type: 'WEB',
    isArchived: false,
    createdAt: now,
    updatedAt: now,
    vmStatus: null,
    prNumber: null,
    prState: null,
    ...over,
})

const SESSIONS = [
    session({
        id: 'run',
        title: 'Running one',
        vmStatus: 'RUNNING',
        repoUrl: 'https://github.com/phasehumans/december',
        branch: 'fix-login',
    }),
    session({
        id: 'start',
        title: 'Starting one',
        vmStatus: 'PROVISIONING',
        repoUrl: 'https://github.com/phasehumans/docs.git',
    }),
    session({ id: 'pr', title: 'Merged one', prNumber: 638, prState: 'merged' }),
    session({
        id: 'pr2',
        title: 'Open one',
        prNumber: 644,
        prState: 'open',
        prUrl: 'https://github.com/phasehumans/december/pull/644',
        repoUrl: 'https://github.com/phasehumans/december',
    }),
]

/** a small fake server: it filters like the list API */
const listFor = (filters?: any) =>
    SESSIONS.filter(
        (s: any) =>
            (filters?.vmStatus !== 'running' ||
                s.vmStatus === 'RUNNING' ||
                s.vmStatus === 'PROVISIONING') &&
            (!filters?.hasPr || s.prNumber)
    )

const renderRecent = (props: Partial<React.ComponentProps<typeof RecentSessions>> = {}) => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    return render(
        <QueryClientProvider client={client}>
            <MemoryRouter>
                <RecentSessions
                    isAuthenticated
                    onOpenProject={mock()}
                    onSessions={mock()}
                    onLeaveCurrent={mock()}
                    {...props}
                />
            </MemoryRouter>
        </QueryClientProvider>
    )
}

describe('sidebar Recent list', () => {
    beforeEach(() => {
        cleanup()
        localStorage.clear()
        useAppStore.setState({ isAuthenticated: true, isAuthRestored: true, activeProjectId: null })
        spyOn(sessionAPI, 'getSessionCounts').mockImplementation(async () => ({
            running: 0,
            needsAnswer: 0,
            needsYou: 0,
            openPullRequests: 0,
            merged: 0,
        }))
    })

    afterEach(() => {
        cleanup()
        mock.restore()
    })

    test('asks the server for 20 web sessions and shows status and PR colour without All sessions', async () => {
        const getSessions = spyOn(sessionAPI, 'getSessions').mockImplementation(async () => ({
            sessions: SESSIONS as any,
        }))
        renderRecent()

        expect(await screen.findByText('Running one')).toBeTruthy()
        expect(getSessions.mock.calls[0][0]).toMatchObject({
            type: 'WEB',
            isArchived: false,
            sortBy: 'updatedAt',
            limit: 20,
        })
        expect(screen.getByText('Running')).toBeTruthy()
        expect(screen.getByText('Starting')).toBeTruthy()
        expect(screen.queryByText('Provisioning')).toBeNull()
        expect(screen.getByText('638').parentElement?.className).toContain('text-[#C084FC]')
        expect(screen.queryByText('All sessions')).toBeNull()
    })

    test('⋯ menu sorts, filters and groups, stays open after a pick and remembers the view', async () => {
        const getSessions = spyOn(sessionAPI, 'getSessions').mockImplementation(
            async (filters?: any) => ({
                sessions: (filters?.vmStatus === 'running' ? [] : SESSIONS) as any,
            })
        )
        renderRecent()
        await screen.findByText('Running one')

        fireEvent.click(screen.getByLabelText('More options'))
        const menu = screen.getByRole('menu', { name: 'Sort and filter' })
        for (const label of [
            'Last updated',
            'Newest',
            'Filter',
            'Running',
            'Pull request',
            'Group by repository',
        ]) {
            expect(menu.textContent).toContain(label)
        }
        for (const label of ['Created', 'Show', 'Web', 'Archived', 'View all sessions']) {
            expect(menu.textContent).not.toContain(label)
        }

        fireEvent.click(screen.getByRole('menuitemcheckbox', { name: 'Running' }))
        // the menu stays open, like the menu of the Sessions page
        expect(screen.getByRole('menu', { name: 'Sort and filter' })).toBeTruthy()
        expect(await screen.findByText('No running sessions')).toBeTruthy()
        expect(screen.getByText('· Running', { exact: false })).toBeTruthy()
        expect(JSON.parse(localStorage.getItem('december:recent-view') || '{}')).toEqual({
            sort: 'updated',
            running: true,
            hasPr: false,
            needsAnswer: false,
            group: false,
        })
        expect(getSessions.mock.calls.some((c: any[]) => c[0]?.vmStatus === 'running')).toBe(true)

        fireEvent.click(screen.getByText('Show all'))
        expect(await screen.findByText('Running one')).toBeTruthy()
    })

    test('Running and Pull request combine, and the heading names what is on', async () => {
        const getSessions = spyOn(sessionAPI, 'getSessions').mockImplementation(
            async (filters?: any) => ({ sessions: listFor(filters) as any })
        )
        renderRecent()
        await screen.findByText('Running one')

        fireEvent.click(screen.getByLabelText('More options'))
        // two sessions run, so the row shows the count
        fireEvent.click(await screen.findByRole('menuitemcheckbox', { name: 'Running, 2' }))
        expect(await screen.findByText('· Running', { exact: false })).toBeTruthy()
        fireEvent.click(screen.getByRole('menuitemcheckbox', { name: 'Pull request' }))
        expect(await screen.findByText('· 2 filters', { exact: false })).toBeTruthy()
        expect(
            getSessions.mock.calls.some(
                (c: any[]) => c[0]?.vmStatus === 'running' && c[0]?.hasPr === true
            )
        ).toBe(true)

        // no session runs and has a pull request
        expect(await screen.findByText('No sessions found')).toBeTruthy()
        fireEvent.click(screen.getByText('Clear filters'))
        expect(await screen.findByText('Merged one')).toBeTruthy()
        expect(screen.queryByText('· 2 filters', { exact: false })).toBeNull()
    })

    test('the old saved view (show: running) still turns the Running filter on', async () => {
        localStorage.setItem(
            'december:recent-view',
            JSON.stringify({ sort: 'created', show: 'running' })
        )
        const getSessions = spyOn(sessionAPI, 'getSessions').mockImplementation(
            async (filters?: any) => ({ sessions: listFor(filters) as any })
        )
        renderRecent()
        await screen.findByText('Running one')
        expect(getSessions.mock.calls[0][0]).toMatchObject({
            vmStatus: 'running',
            sortBy: 'createdAt',
        })
        expect(screen.getByText('· Running', { exact: false })).toBeTruthy()
    })

    test('Group by repository puts rows under repository names', async () => {
        spyOn(sessionAPI, 'getSessions').mockImplementation(async (filters?: any) => ({
            sessions: listFor(filters) as any,
        }))
        renderRecent()
        await screen.findByText('Running one')
        expect(screen.queryByText('docs')).toBeNull()

        fireEvent.click(screen.getByLabelText('More options'))
        fireEvent.click(screen.getByRole('menuitemcheckbox', { name: 'Group by repository' }))

        const list = screen.getByText('Running one').closest('.overflow-y-auto') as HTMLElement
        // december first (its first session is newest), sessions with no repository last
        expect(list.textContent).toMatch(
            /december.*Running one.*Open one.*docs.*Starting one.*No repository.*Merged one/
        )
    })

    test('Stop running sessions asks for a second click, then stops each one', async () => {
        spyOn(sessionAPI, 'getSessions').mockImplementation(async (filters?: any) => ({
            sessions: listFor(filters) as any,
        }))
        const stop = spyOn(generationAPI, 'stopSessionStream').mockImplementation(() => {})
        renderRecent()
        await screen.findByText('Running one')

        fireEvent.click(screen.getByLabelText('More options'))
        fireEvent.click(await screen.findByRole('menuitem', { name: 'Stop running sessions' }))
        expect(stop).not.toHaveBeenCalled()
        fireEvent.click(screen.getByRole('menuitem', { name: 'Stop 2 sessions?' }))
        expect(stop.mock.calls.map((c: any[]) => c[0]).sort()).toEqual(['run', 'start'])
        expect(screen.queryByRole('menu', { name: 'Sort and filter' })).toBeNull()
    })

    test('no Stop row when nothing runs', async () => {
        spyOn(sessionAPI, 'getSessions').mockImplementation(async () => ({
            sessions: [SESSIONS[2]] as any,
        }))
        renderRecent()
        await screen.findByText('Merged one')
        fireEvent.click(screen.getByLabelText('More options'))
        expect(screen.queryByText('Stop running sessions')).toBeNull()
        expect(screen.getByRole('menuitemcheckbox', { name: 'Running' })).toBeTruthy()
    })

    test('a row is a link: a plain click opens here, a ctrl click is left to the browser', async () => {
        spyOn(sessionAPI, 'getSessions').mockImplementation(async () => ({
            sessions: SESSIONS as any,
        }))
        const onOpenProject = mock()
        renderRecent({ onOpenProject })

        const link = (await screen.findByText('Running one')).closest('a') as HTMLAnchorElement
        expect(link.getAttribute('href')).toBe('/sessions/run')

        fireEvent.click(link, { ctrlKey: true })
        expect(onOpenProject).not.toHaveBeenCalled()
        fireEvent.click(link)
        expect(onOpenProject).toHaveBeenCalledWith('run')
    })

    test('a right-click on a row opens the row menu at the pointer', async () => {
        spyOn(sessionAPI, 'getSessions').mockImplementation(async () => ({
            sessions: SESSIONS as any,
        }))
        renderRecent()
        const row = (await screen.findByText('Merged one')).closest('a') as HTMLElement
        fireEvent.contextMenu(row, { clientX: 40, clientY: 60 })

        const menu = screen.getByRole('menu', { name: 'Session options' })
        expect(menu.style.left).toBe('40px')
        expect(menu.style.top).toBe('60px')
        expect(menu.textContent).toContain('Rename')
    })

    test('row menu opens the pull request and a new session in the repository', async () => {
        spyOn(sessionAPI, 'getSessions').mockImplementation(async () => ({
            sessions: SESSIONS as any,
        }))
        const open = spyOn(window, 'open').mockImplementation(() => null)
        const asked = mock()
        window.addEventListener(NEW_SESSION_REQUEST_EVENT, asked)
        renderRecent()
        await screen.findByText('Open one')
        const optionsOf = (title: string) =>
            screen
                .getByText(title)
                .closest('a')
                ?.parentElement?.querySelector('[aria-label="Session options"]') as HTMLElement

        // no pull request and no repository: no open rows, and never Open in new tab
        fireEvent.click(optionsOf('Merged one'))
        let menu = screen.getByRole('menu', { name: 'Session options' })
        expect(menu.textContent).not.toContain('Open pull request')
        expect(menu.textContent).not.toContain('New in this repo')
        expect(menu.textContent).not.toContain('Open in new tab')
        fireEvent.keyDown(document, { key: 'Escape' })
        expect(screen.queryByRole('menu', { name: 'Session options' })).toBeNull()

        fireEvent.click(optionsOf('Open one'))
        fireEvent.click(screen.getByRole('menuitem', { name: 'Open pull request' }))
        expect(open).toHaveBeenCalledWith(
            'https://github.com/phasehumans/december/pull/644',
            '_blank',
            'noopener,noreferrer'
        )

        fireEvent.click(optionsOf('Running one'))
        menu = screen.getByRole('menu', { name: 'Session options' })
        expect(menu.textContent).not.toContain('Open pull request')
        fireEvent.click(screen.getByRole('menuitem', { name: 'New in this repo' }))
        expect(asked).toHaveBeenCalledTimes(1)
        const prefill = takeHomePrefill()
        expect(prefill?.repo?.fullName).toBe('phasehumans/december')
        expect(prefill?.repo?.htmlUrl).toBe('https://github.com/phasehumans/december')
        expect(prefill?.branch).toBe('fix-login')
        window.removeEventListener(NEW_SESSION_REQUEST_EVENT, asked)
    })

    test('the ⋯ menu opens like the inbox: below the ⋯, from its left edge', async () => {
        spyOn(sessionAPI, 'getSessions').mockImplementation(async () => ({
            sessions: SESSIONS as any,
        }))
        renderRecent()
        await screen.findByText('Running one')
        const button = screen.getByLabelText('More options')
        button.getBoundingClientRect = () =>
            ({ top: 248, bottom: 270, left: 155, right: 177, width: 22, height: 22 }) as DOMRect

        // the tooltip shows on hover, and hides while the menu is open (it would cover
        // the first row of the menu)
        fireEvent.mouseEnter(button.parentElement as HTMLElement)
        expect(screen.getByText('More options')).toBeTruthy()

        fireEvent.click(button)
        const menu = screen.getByRole('menu', { name: 'Sort and filter' })
        // the sidebar is 200 wide and the menu 180: a part is over the sidebar, the rest
        // is over the page
        expect(menu.style.left).toBe('155px')
        expect(menu.style.top).toBe('276px')
        expect(screen.queryByText('More options')).toBeNull()
    })

    test('Esc closes the ⋯ menu', async () => {
        spyOn(sessionAPI, 'getSessions').mockImplementation(async () => ({
            sessions: SESSIONS as any,
        }))
        renderRecent()
        await screen.findByText('Running one')
        fireEvent.click(screen.getByLabelText('More options'))
        expect(screen.getByRole('menu', { name: 'Sort and filter' })).toBeTruthy()
        fireEvent.keyDown(document, { key: 'Escape' })
        expect(screen.queryByRole('menu', { name: 'Sort and filter' })).toBeNull()
    })

    test('a failed load offers Try again', async () => {
        spyOn(sessionAPI, 'getSessions').mockImplementation(async () => {
            throw new Error('boom')
        })
        renderRecent()
        expect(await screen.findByText("Couldn't load sessions")).toBeTruthy()
        expect(screen.getByText('Try again')).toBeTruthy()
        expect(screen.queryByText('No recent sessions')).toBeNull()
    })

    test('signed out shows only a Sign in button', () => {
        renderRecent({ isAuthenticated: false })
        expect(screen.getByText('Sign in')).toBeTruthy()
        expect(screen.queryByText(/Sign in to view/)).toBeNull()
    })

    test('row ⋯ has the Sessions page items, and archive can be undone', async () => {
        // a small fake server: archived sessions drop out of the list like the real one
        const archived = new Set<string>()
        spyOn(sessionAPI, 'getSessions').mockImplementation(async () => ({
            sessions: SESSIONS.filter((s) => !archived.has(s.id)) as any,
        }))
        const archive = spyOn(sessionAPI, 'archiveSession').mockImplementation(
            async (id: string) => {
                archived.add(id)
                return {} as any
            }
        )
        const unarchive = spyOn(sessionAPI, 'unarchiveSession').mockImplementation(
            async (id: string) => {
                archived.delete(id)
                return {} as any
            }
        )
        renderRecent()
        await screen.findByText('Running one')

        fireEvent.click(screen.getAllByLabelText('Session options')[0])
        const menu = screen.getByRole('menu', { name: 'Session options' })
        for (const label of ['Rename', 'Tags', 'Archive', 'Stop', 'Delete']) {
            expect(menu.textContent).toContain(label)
        }

        fireEvent.click(screen.getByRole('menuitem', { name: /Archive/ }))
        // it asks first: nothing is archived until the dialog's Archive
        expect(await screen.findByText('Archive session')).toBeTruthy()
        expect(archive).not.toHaveBeenCalled()
        fireEvent.click(screen.getByRole('button', { name: 'Archive' }))
        await waitFor(() => expect(archive).toHaveBeenCalledWith('run'))
        expect(await screen.findByText('Undo')).toBeTruthy()

        expect(screen.queryByText('Running one')).toBeNull()

        fireEvent.click(screen.getByText('Undo'))
        await waitFor(() => expect(unarchive).toHaveBeenCalledWith('run'))
        expect(await screen.findByText('Running one')).toBeTruthy()
    })
})

describe('delete modal copy', () => {
    afterEach(() => cleanup())

    test('says session and shows no name', () => {
        render(
            <SessionDeleteModal
                isOpen
                projectTitle="Refactor session repository"
                isPending={false}
                onClose={mock()}
                onConfirm={mock()}
            />
        )
        expect(screen.getByText('Delete session')).toBeTruthy()
        expect(screen.queryByText('Refactor session repository')).toBeNull()
        expect(screen.queryByText(/project/i)).toBeNull()
    })
})

describe('phone menu sheet Recent', () => {
    beforeEach(() => {
        cleanup()
        useAppStore.setState({
            isAuthenticated: true,
            isAuthRestored: true,
            activeProjectId: null,
            isMobileSidebarOpen: true,
            mobileSheetStart: 'menu',
        })
    })

    afterEach(() => {
        cleanup()
        mock.restore()
        useAppStore.setState({ isMobileSidebarOpen: false })
    })

    const renderSheet = () => {
        const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
        return render(
            <QueryClientProvider client={client}>
                <MemoryRouter>
                    <MobileMenuSheet
                        onNewThread={mock()}
                        onSessions={mock()}
                        onProfile={mock()}
                        onOpenProject={mock()}
                        isAuthenticated
                        onOpenAuth={mock()}
                    />
                </MemoryRouter>
            </QueryClientProvider>
        )
    }

    test('holding a row opens its options and Delete needs two taps', async () => {
        spyOn(sessionAPI, 'getSessions').mockImplementation(async () => ({
            sessions: SESSIONS as any,
        }))
        const del = spyOn(sessionAPI, 'deleteSession').mockImplementation(async () => ({}) as any)
        renderSheet()

        const row = (await screen.findByText('Merged one')).closest('button') as HTMLElement
        expect(screen.queryByText('All sessions')).toBeNull()
        fireEvent.pointerDown(row, { clientX: 10, clientY: 10 })
        await act(() => new Promise((r) => setTimeout(r, 600)))
        fireEvent.pointerUp(row)

        expect(await screen.findByText('Rename')).toBeTruthy()
        // no pull request link and no repository on this session
        expect(screen.queryByText('Open pull request')).toBeNull()
        expect(screen.queryByText('Open in new tab')).toBeNull()
        fireEvent.click(screen.getByText('Delete'))
        expect(del).not.toHaveBeenCalled()
        fireEvent.click(screen.getByText('Tap again to delete'))
        await waitFor(() => expect(del).toHaveBeenCalledWith('pr'))
    })

    test('a held row with a pull request and a repository gets the two open rows', async () => {
        spyOn(sessionAPI, 'getSessions').mockImplementation(async () => ({
            sessions: SESSIONS as any,
        }))
        const open = spyOn(window, 'open').mockImplementation(() => null)
        renderSheet()

        const row = (await screen.findByText('Open one')).closest('button') as HTMLElement
        fireEvent.pointerDown(row, { clientX: 10, clientY: 10 })
        await act(() => new Promise((r) => setTimeout(r, 600)))
        fireEvent.pointerUp(row)

        expect(await screen.findByText('New session in this repo')).toBeTruthy()
        expect(screen.queryByText('Open in new tab')).toBeNull()
        fireEvent.click(screen.getByText('Open pull request'))
        await waitFor(() =>
            expect(open).toHaveBeenCalledWith(
                'https://github.com/phasehumans/december/pull/644',
                '_blank',
                'noopener,noreferrer'
            )
        )
    })
})
