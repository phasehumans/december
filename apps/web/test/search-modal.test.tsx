import { GlobalRegistrator } from '@happy-dom/global-registrator'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { expect, test, describe, afterEach, beforeEach, spyOn, mock } from 'bun:test'
import React from 'react'

if (!globalThis.document) {
    GlobalRegistrator.register()
}

const { render, screen, cleanup, fireEvent, act } = await import('@testing-library/react')
const { MemoryRouter, useLocation } = await import('react-router-dom')
const { useAppStore } = await import('../src/app/store')
const { takeHomePrefill } = await import('../src/features/home/prefill')
const { SearchModal } = await import('../src/features/navigation/components/SearchModal')
const { CLI_INSTALL_COMMAND } = await import('../src/features/navigation/search/searchItems')
const { profileAPI } = await import('../src/features/profile/api/profile')
const { sessionAPI } = await import('../src/features/sessions/api/session')

const originalClipboard = Object.getOwnPropertyDescriptor(navigator, 'clipboard')
const originalWindowOpen = window.open
const originalInnerWidth = window.innerWidth

// the search reads sessions and repositories through react-query, so it needs a client
const renderModal = (
    props: Partial<React.ComponentProps<typeof SearchModal>> & { onClose?: () => void } = {},
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
) => {
    let currentPath = '/'
    const PathProbe = () => {
        currentPath = useLocation().pathname
        return null
    }
    const result = render(
        <QueryClientProvider client={queryClient}>
            <MemoryRouter>
                <PathProbe />
                <SearchModal
                    isOpen={true}
                    onClose={props.onClose ?? (() => {})}
                    isAuthenticated={true}
                    {...props}
                />
            </MemoryRouter>
        </QueryClientProvider>
    )
    return { ...result, getPath: () => currentPath, queryClient }
}

describe('SearchModal component', () => {
    beforeEach(() => {
        cleanup()
        takeHomePrefill()
        useAppStore.setState({
            isAuthenticated: true,
            activeProjectId: null,
            activeSessionId: null,
        })
        spyOn(sessionAPI, 'getSessions').mockResolvedValue({ sessions: [], total: 0 } as never)
        spyOn(profileAPI, 'getGithubRepos').mockResolvedValue([] as never)
    })

    afterEach(() => {
        cleanup()
        mock.restore()
        takeHomePrefill()
        window.open = originalWindowOpen
        Object.defineProperty(window, 'innerWidth', {
            configurable: true,
            writable: true,
            value: originalInnerWidth,
        })
        if (originalClipboard) {
            Object.defineProperty(navigator, 'clipboard', originalClipboard)
        }
        useAppStore.setState({
            isAuthenticated: false,
            activeProjectId: null,
            activeSessionId: null,
        })
    })

    test('renders navigation items without Device Activation', () => {
        const onClose = () => {}

        renderModal({ onClose })

        // Ensure primary navigation items are present
        expect(screen.getByText('New session')).toBeDefined()
        expect(screen.getByText('Sessions')).toBeDefined()
        expect(screen.getAllByText('Pull requests').length).toBeGreaterThanOrEqual(1)
        expect(screen.getByText('Documentation')).toBeDefined()
        // the Defaults page is removed
        expect(screen.queryByText('Defaults')).toBeNull()
        expect(screen.getByText('Sandbox')).toBeDefined()
        expect(screen.getByText('GitHub repositories')).toBeDefined()

        // Verify Device Activation is removed
        expect(screen.queryByText('Device Activation')).toBeNull()
        expect(screen.queryByText('Link CLI or secondary device code')).toBeNull()
    })

    test('does not include Device Activation in any category', () => {
        const onClose = () => {}

        renderModal({ onClose })

        expect(screen.queryByText(/Device Activation/i)).toBeNull()
        expect(screen.queryByText(/secondary device code/i)).toBeNull()
    })

    test('calls onClose when Escape key is pressed or backdrop is clicked', () => {
        const onClose = mock(() => {})

        const { container } = renderModal({ onClose })

        fireEvent.keyDown(window, { key: 'Escape' })
        expect(onClose).toHaveBeenCalledTimes(1)

        // Click inside modal card should not close
        const input = screen.getByPlaceholderText('Search')
        fireEvent.click(input)
        expect(onClose).toHaveBeenCalledTimes(1)

        // Click backdrop should close
        const backdrop = container.querySelector('.bg-black\\/50')
        expect(backdrop).not.toBeNull()
        fireEvent.click(backdrop!)
        expect(onClose).toHaveBeenCalledTimes(2)
    })

    test('supports keyboard ArrowDown/ArrowUp wrapping and Enter activation', async () => {
        const onClose = mock(() => {})
        const onNewThread = mock(() => {})
        const onAction = mock(() => {})

        renderModal({ onClose, onNewThread, onAction })

        const options = screen.getAllByRole('option')
        expect(options.length).toBeGreaterThan(2)
        expect(options[0].getAttribute('aria-selected')).toBe('true')

        // ArrowUp from index 0 wraps to last option
        await act(async () => {
            fireEvent.keyDown(window, { key: 'ArrowUp' })
        })
        expect(
            screen.getAllByRole('option')[options.length - 1].getAttribute('aria-selected')
        ).toBe('true')

        // ArrowDown from last wraps back to 0 (New session)
        await act(async () => {
            fireEvent.keyDown(window, { key: 'ArrowDown' })
        })
        expect(screen.getAllByRole('option')[0].getAttribute('aria-selected')).toBe('true')

        // Enter activates New session
        await act(async () => {
            fireEvent.keyDown(window, { key: 'Enter' })
        })
        expect(onClose).toHaveBeenCalledTimes(1)
        expect(onNewThread).toHaveBeenCalledTimes(1)
        expect(onAction).toHaveBeenCalledTimes(1)
    })

    test('Cmd/Ctrl+Enter opens navigation item href in a new tab instead of in-app navigation', async () => {
        const openMock = mock((_url?: string | URL, _target?: string, _features?: string) => null)
        window.open = openMock as unknown as typeof window.open
        const onClose = mock(() => {})

        const { getPath } = renderModal({ onClose })

        const input = screen.getByPlaceholderText('Search')
        await act(async () => {
            fireEvent.change(input, { target: { value: 'Pull requests' } })
        })

        await act(async () => {
            fireEvent.keyDown(window, { key: 'Enter', metaKey: true })
        })

        expect(onClose).toHaveBeenCalledTimes(1)
        expect(openMock).toHaveBeenCalledTimes(1)
        expect(String(openMock.mock.calls[0][0])).toContain('/pull-requests')
        expect(getPath()).toBe('/')
    })

    test('command mode (>) filters only commands/navigation/settings and shows No results on miss', async () => {
        renderModal()

        const input = screen.getByPlaceholderText('Search')

        // Entering ">" enters command mode without Ask December or Docs
        await act(async () => {
            fireEvent.change(input, { target: { value: '>' } })
        })
        expect(screen.getByText('Actions')).toBeDefined()
        expect(screen.getByText('Navigation')).toBeDefined()
        expect(screen.getByText('Settings')).toBeDefined()
        expect(screen.queryByText('Ask December')).toBeNull()
        expect(screen.queryByText('Docs')).toBeNull()

        // Non-matching command query displays "No results"
        await act(async () => {
            fireEvent.change(input, { target: { value: '>zzzznonexistent' } })
        })
        expect(screen.getByText('No results')).toBeDefined()
    })

    test('typing a query shows Ask December row and prefills Home prompt on activation', async () => {
        const onClose = mock(() => {})
        const onNewThread = mock(() => {})

        renderModal({ onClose, onNewThread })

        const input = screen.getByPlaceholderText('Search')
        await act(async () => {
            fireEvent.change(input, { target: { value: 'build a landing page' } })
        })

        const askOption = screen
            .getAllByRole('option')
            .find((el) => el.textContent?.includes('Ask December'))
        expect(askOption).toBeDefined()

        await act(async () => {
            fireEvent.click(askOption!)
        })

        expect(onClose).toHaveBeenCalledTimes(1)
        expect(onNewThread).toHaveBeenCalledTimes(1)
        expect(takeHomePrefill()).toEqual({ prompt: 'build a landing page' })
    })

    test('Copy CLI install command copies text, flashes Copied, and closes after delay', async () => {
        const writeTextMock = mock(() => Promise.resolve())
        Object.defineProperty(navigator, 'clipboard', {
            configurable: true,
            value: { writeText: writeTextMock },
        })
        const onClose = mock(() => {})
        const onAction = mock(() => {})

        renderModal({ onClose, onAction })

        const copyOption = screen
            .getAllByRole('option')
            .find((el) => el.textContent?.includes('Copy CLI install command'))
        expect(copyOption).toBeDefined()

        await act(async () => {
            fireEvent.click(copyOption!)
        })

        expect(writeTextMock).toHaveBeenCalledWith(CLI_INSTALL_COMMAND)
        expect(screen.getByText('Copied')).toBeDefined()
        expect(onClose).not.toHaveBeenCalled()

        await act(async () => {
            await new Promise((resolve) => setTimeout(resolve, 750))
        })

        expect(onClose).toHaveBeenCalledTimes(1)
        expect(onAction).toHaveBeenCalledTimes(1)
    })

    test('renders recent sessions, opens a session on click, and triggers debounced title search', async () => {
        const getSessionsSpy = spyOn(sessionAPI, 'getSessions').mockResolvedValue({
            sessions: [
                {
                    id: 'sess-1',
                    title: 'Fix auth redirect',
                    type: 'WEB',
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                    lastMessage: null,
                    githubRepoName: 'december',
                    isArchived: false,
                },
            ],
            total: 1,
        } as never)
        const onOpenSession = mock(() => {})
        const onClose = mock(() => {})

        renderModal({ onOpenSession, onClose })

        const sessionRow = await screen.findByText('Fix auth redirect')
        expect(sessionRow).toBeDefined()

        await act(async () => {
            fireEvent.click(sessionRow)
        })
        expect(onClose).toHaveBeenCalledTimes(1)
        expect(onOpenSession).toHaveBeenCalledWith('sess-1')

        const input = screen.getByPlaceholderText('Search')
        await act(async () => {
            fireEvent.change(input, { target: { value: 'billing' } })
            await new Promise((resolve) => setTimeout(resolve, 200))
        })

        const titleSearchCall = getSessionsSpy.mock.calls.find(
            (call) => call[0]?.search === 'billing' && call[0]?.searchIn === 'title'
        )
        expect(titleSearchCall).toBeDefined()
    })

    test('shows sidebar toggle action on desktop when onToggleSidebar is passed, hides on mobile', async () => {
        const onToggleSidebar = mock(() => {})
        const onClose = mock(() => {})

        const { unmount } = renderModal({
            onClose,
            onToggleSidebar,
            isSidebarCollapsed: false,
        })

        const collapseBtn = screen
            .getAllByRole('option')
            .find((el) => el.textContent?.includes('Collapse sidebar'))
        expect(collapseBtn).toBeDefined()

        await act(async () => {
            fireEvent.click(collapseBtn!)
        })
        expect(onToggleSidebar).toHaveBeenCalledTimes(1)
        expect(onClose).toHaveBeenCalledTimes(1)
        unmount()

        // Mobile viewport (< 768) hides sidebar toggle action and renders bottom sheet
        Object.defineProperty(window, 'innerWidth', {
            configurable: true,
            writable: true,
            value: 390,
        })
        renderModal({ onClose, onToggleSidebar, isSidebarCollapsed: false })
        expect(screen.queryByText('Collapse sidebar')).toBeNull()
        expect(screen.queryByText('Expand sidebar')).toBeNull()
    })

    test('shows Archive this session when activeProjectId is set and archives after the confirm', async () => {
        useAppStore.setState({ activeProjectId: 'sess-active', activeSessionId: 'sess-active' })
        const archiveSpy = spyOn(sessionAPI, 'archiveSession').mockResolvedValue({} as never)
        const onClose = mock(() => {})

        renderModal({ onClose })

        const archiveOption = screen
            .getAllByRole('option')
            .find((el) => el.textContent?.includes('Archive this session'))
        expect(archiveOption).toBeDefined()

        await act(async () => {
            fireEvent.click(archiveOption!)
        })

        // it asks first, like the session menus
        expect(await screen.findByText('Archive session')).toBeTruthy()
        expect(archiveSpy).not.toHaveBeenCalled()
        expect(onClose).toHaveBeenCalledTimes(1)

        await act(async () => {
            fireEvent.click(screen.getByRole('button', { name: 'Archive' }))
        })
        expect(archiveSpy).toHaveBeenCalledWith('sess-active')
    })

    test('Unarchive this session runs with no question', async () => {
        useAppStore.setState({ activeProjectId: 'sess-archived', activeSessionId: 'sess-archived' })
        const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
        queryClient.setQueryData(['session', 'sess-archived'], {
            id: 'sess-archived',
            isArchived: true,
        })
        const unarchiveSpy = spyOn(sessionAPI, 'unarchiveSession').mockResolvedValue({} as never)

        renderModal({ onClose: mock(() => {}) }, queryClient)

        const option = screen
            .getAllByRole('option')
            .find((el) => el.textContent?.includes('Unarchive this session'))
        expect(option).toBeDefined()
        await act(async () => {
            fireEvent.click(option!)
        })

        expect(unarchiveSpy).toHaveBeenCalledWith('sess-archived')
        expect(screen.queryByText('Archive session')).toBeNull()
    })

    test('selecting a repository starts a new thread and prefills the repo on Home', async () => {
        const repo = {
            id: 42,
            name: 'december-app',
            fullName: 'phasehumans/december-app',
            private: false,
            defaultBranch: 'main',
            updatedAt: new Date().toISOString(),
            htmlUrl: 'https://github.com/phasehumans/december-app',
            cloneUrl: 'https://github.com/phasehumans/december-app.git',
            language: 'TypeScript',
            description: null,
            owner: { login: 'phasehumans', avatarUrl: 'https://example.com/avatar.png' },
        }
        spyOn(profileAPI, 'getGithubRepos').mockResolvedValue([repo] as never)
        const onNewThread = mock(() => {})
        const onClose = mock(() => {})

        renderModal({ onNewThread, onClose })

        // Wait for repos query to populate
        await act(async () => {
            await new Promise((resolve) => setTimeout(resolve, 20))
        })

        const input = screen.getByPlaceholderText('Search')
        await act(async () => {
            fireEvent.change(input, { target: { value: 'december-app' } })
        })

        const repoOption = screen
            .getAllByRole('option')
            .find((el) => el.textContent?.includes('december-app'))
        expect(repoOption).toBeDefined()

        await act(async () => {
            fireEvent.click(repoOption!)
        })

        expect(onClose).toHaveBeenCalledTimes(1)
        expect(onNewThread).toHaveBeenCalledTimes(1)
        expect(takeHomePrefill()).toEqual({ repo })
    })

    test('unauthenticated SearchModal hides Sessions, Pull requests, and Settings, showing Docs', () => {
        useAppStore.setState({ isAuthenticated: false })
        renderModal({ isAuthenticated: false })

        expect(screen.getByText('New session')).toBeDefined()
        expect(screen.getByText('Documentation')).toBeDefined()
        expect(screen.getByText('Docs')).toBeDefined()
        expect(screen.queryByText('Sessions')).toBeNull()
        expect(screen.queryByText('Pull requests')).toBeNull()
        expect(screen.queryByText('Settings')).toBeNull()
    })

    test('reads isArchived from cached BackendSessionDetail project when active session is archived', async () => {
        const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
        queryClient.setQueryData(['session', 'sess-archived'], {
            project: {
                id: 'sess-archived',
                title: 'Archived session',
                type: 'WEB',
                isArchived: true,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                lastMessage: null,
            },
            versions: [],
            selectedVersionId: null,
            activeVersion: null,
            chatMessages: [],
            generatedFiles: {},
        })
        useAppStore.setState({
            activeProjectId: 'sess-archived',
            activeSessionId: 'sess-archived',
        })
        const unarchiveSpy = spyOn(sessionAPI, 'unarchiveSession').mockResolvedValue({} as never)

        renderModal({}, queryClient)

        const unarchiveOption = screen
            .getAllByRole('option')
            .find((el) => el.textContent?.includes('Unarchive this session'))
        expect(unarchiveOption).toBeDefined()

        await act(async () => {
            fireEvent.click(unarchiveOption!)
        })
        expect(unarchiveSpy).toHaveBeenCalledWith('sess-archived')
    })

    test('session rows exclude SEARCH type, fall back to projectName, and support Cmd+Enter new tab', async () => {
        const openMock = mock((_url?: string | URL, _target?: string, _features?: string) => null)
        window.open = openMock as unknown as typeof window.open
        spyOn(sessionAPI, 'getSessions').mockResolvedValue({
            sessions: [
                {
                    id: 'sess-proj-name',
                    title: null,
                    projectName: 'Fallback Project Name',
                    type: 'WEB',
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                    lastMessage: null,
                    isArchived: false,
                },
                {
                    id: 'sess-search-only',
                    title: 'Internal Search Session',
                    type: 'SEARCH',
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                    lastMessage: null,
                    isArchived: false,
                },
            ],
            total: 2,
        } as never)

        renderModal()

        const projectRow = await screen.findByText('Fallback Project Name')
        expect(projectRow).toBeDefined()
        expect(screen.queryByText('Internal Search Session')).toBeNull()

        await act(async () => {
            fireEvent.keyDown(window, { key: 'Enter', metaKey: true })
        })

        expect(openMock).toHaveBeenCalledTimes(1)
        expect(String(openMock.mock.calls[0][0])).toContain('/sessions/sess-proj-name')
    })

    test('closing early cancels Copy CLI flash timer and resets query on reopen', async () => {
        Object.defineProperty(navigator, 'clipboard', {
            configurable: true,
            value: { writeText: mock(() => Promise.resolve()) },
        })
        const onClose = mock(() => {})
        const onAction = mock(() => {})

        const { rerender, queryClient } = renderModal({ isOpen: true, onClose, onAction })

        const input = screen.getByPlaceholderText('Search') as HTMLInputElement
        await act(async () => {
            fireEvent.change(input, { target: { value: 'copy cli' } })
        })

        const copyOption = screen
            .getAllByRole('option')
            .find((el) => el.textContent?.includes('Copy CLI install command'))
        expect(copyOption).toBeDefined()

        await act(async () => {
            fireEvent.click(copyOption!)
        })
        expect(screen.getByText('Copied')).toBeDefined()

        // Close modal early before FLASH_MS (700ms)
        rerender(
            <QueryClientProvider client={queryClient}>
                <MemoryRouter>
                    <SearchModal
                        isOpen={false}
                        onClose={onClose}
                        onAction={onAction}
                        isAuthenticated={true}
                    />
                </MemoryRouter>
            </QueryClientProvider>
        )

        // Reopen immediately and wait past 750ms; stale timer must not close the reopened modal
        rerender(
            <QueryClientProvider client={queryClient}>
                <MemoryRouter>
                    <SearchModal
                        isOpen={true}
                        onClose={onClose}
                        onAction={onAction}
                        isAuthenticated={true}
                    />
                </MemoryRouter>
            </QueryClientProvider>
        )

        const reopenedInput = screen.getByPlaceholderText('Search') as HTMLInputElement
        expect(reopenedInput.value).toBe('')

        await act(async () => {
            await new Promise((resolve) => setTimeout(resolve, 750))
        })

        expect(onClose).not.toHaveBeenCalled()
        expect(onAction).not.toHaveBeenCalled()
    })

    test('ignores Enter during IME composition and does not leave prefill for unauthenticated Ask December', async () => {
        const onClose = mock(() => {})
        const onNewThread = mock(() => {})

        useAppStore.setState({ isAuthenticated: false })
        renderModal({ isOpen: true, isAuthenticated: false, onClose, onNewThread })

        const input = screen.getByPlaceholderText('Search')
        await act(async () => {
            fireEvent.change(input, { target: { value: 'unauth prompt' } })
        })

        // IME composition Enter must be ignored
        await act(async () => {
            const event = new KeyboardEvent('keydown', {
                key: 'Enter',
                isComposing: true,
                bubbles: true,
            })
            window.dispatchEvent(event)
        })
        expect(onClose).not.toHaveBeenCalled()
        expect(onNewThread).not.toHaveBeenCalled()

        const askOption = screen
            .getAllByRole('option')
            .find((el) => el.textContent?.includes('Ask December'))
        expect(askOption).toBeDefined()

        await act(async () => {
            fireEvent.click(askOption!)
        })

        expect(onClose).toHaveBeenCalledTimes(1)
        expect(onNewThread).toHaveBeenCalledTimes(1)
        expect(takeHomePrefill()).toBeNull()
    })
})
