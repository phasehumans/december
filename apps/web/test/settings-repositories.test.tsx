import { GlobalRegistrator } from '@happy-dom/global-registrator'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, beforeEach, describe, expect, mock, spyOn, test } from 'bun:test'
import React from 'react'

if (!globalThis.document) {
    GlobalRegistrator.register()
}

const { render, screen, cleanup, fireEvent } = await import('@testing-library/react')
const { MemoryRouter, useLocation } = await import('react-router-dom')

const { profileAPI } = await import('../src/features/profile/api/profile')
const { ApiError } = await import('../src/shared/api/client')
const { ProfileRepositoriesSettings } =
    await import('../src/features/profile/components/ProfileRepositoriesSettings')
const { setSkeletonPreview } = await import('../src/shared/lib/skeletonPreview')

import type { GithubRepo, RepoList } from '../src/features/profile/api/profile'

const repo = (overrides: Partial<GithubRepo>): GithubRepo => ({
    id: 1,
    name: 'web',
    fullName: 'acme/web',
    private: true,
    defaultBranch: 'main',
    updatedAt: '2026-11-01T00:00:00Z',
    htmlUrl: 'https://github.com/acme/web',
    cloneUrl: 'https://github.com/acme/web.git',
    language: 'TypeScript',
    description: 'The web app',
    owner: { login: 'acme', avatarUrl: '' },
    provider: 'GITHUB',
    ...overrides,
})

const list = (repos: GithubRepo[], extra: Partial<RepoList> = {}): RepoList => ({
    repos,
    unavailable: [],
    truncated: false,
    ...extra,
})

// react reads a typed value only after this full sequence in happy-dom
const typeInto = (el: HTMLElement, value: string) => {
    fireEvent.focusIn(el)
    fireEvent.change(el, { target: { value } })
    fireEvent.keyUp(el)
    fireEvent.focusOut(el)
}

let lastSearch = ''
const LocationProbe = () => {
    lastSearch = useLocation().search
    return null
}

const renderPage = (opts: { isGithubConnected: boolean; path?: string }) => {
    const onConnectGithub = mock(() => {})
    const path = opts.path ?? '/settings/repositories'
    // the page reads connect errors from the address itself
    ;(window as unknown as { happyDOM: { setURL: (url: string) => void } }).happyDOM.setURL(
        `http://localhost${path}`
    )
    const view = render(
        <QueryClientProvider
            client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
        >
            <MemoryRouter initialEntries={[path]}>
                <ProfileRepositoriesSettings
                    isGithubConnected={opts.isGithubConnected}
                    onConnectGithub={onConnectGithub}
                />
                <LocationProbe />
            </MemoryRouter>
        </QueryClientProvider>
    )
    return { ...view, onConnectGithub }
}

const gitlabStatus = (status: { available: boolean; connected: boolean }) =>
    spyOn(profileAPI, 'getGitlabStatus').mockImplementation(async () => ({
        ...status,
        username: status.connected ? 'me' : null,
    }))

describe('repositories settings page', () => {
    beforeEach(() => {
        cleanup()
        setSkeletonPreview(false)
        lastSearch = ''
    })

    afterEach(() => {
        cleanup()
        mock.restore()
        ;(window as unknown as { happyDOM: { setURL: (url: string) => void } }).happyDOM.setURL(
            'http://localhost/'
        )
    })

    test('nothing connected: drawing, both connect buttons in the box, no search (E1)', async () => {
        gitlabStatus({ available: true, connected: false })
        const githubRepos = spyOn(profileAPI, 'getGithubRepos')
        const { container, onConnectGithub } = renderPage({ isGithubConnected: false })

        expect(
            await screen.findByText('Connect GitHub or GitLab to see your repositories')
        ).toBeDefined()
        expect(container.querySelector('svg')).not.toBeNull()
        expect(screen.queryByPlaceholderText('Search repositories')).toBeNull()
        expect(screen.getAllByRole('button', { name: 'Connect GitLab' }).length).toBe(1)
        fireEvent.click(screen.getByRole('button', { name: 'Connect GitHub' }))
        expect(onConnectGithub).toHaveBeenCalled()
        expect(githubRepos).not.toHaveBeenCalled()
    })

    test('nothing connected and no GitLab on the server: GitHub only (E2)', async () => {
        gitlabStatus({ available: false, connected: false })
        renderPage({ isGithubConnected: false })
        expect(await screen.findByText('Connect GitHub to see your repositories')).toBeDefined()
        expect(screen.queryByRole('button', { name: 'Connect GitLab' })).toBeNull()
    })

    test('shows every repository newest first as links, with the host and no language', async () => {
        gitlabStatus({ available: true, connected: true })
        spyOn(profileAPI, 'getGithubRepos').mockImplementation(async () =>
            list([
                repo({
                    id: 1,
                    name: 'old',
                    fullName: 'acme/old',
                    htmlUrl: 'https://github.com/acme/old',
                    updatedAt: '2026-01-01T00:00:00Z',
                }),
                repo({
                    id: 2,
                    name: 'new',
                    fullName: 'acme/new',
                    htmlUrl: 'https://github.com/acme/new',
                    updatedAt: '2026-11-20T00:00:00Z',
                }),
            ])
        )
        spyOn(profileAPI, 'getGitlabRepos').mockImplementation(async () =>
            list([
                repo({
                    id: 1,
                    name: 'infra',
                    fullName: 'group/sub/infra',
                    owner: { login: 'group/sub', avatarUrl: '' },
                    provider: 'GITLAB',
                    private: false,
                    htmlUrl: 'https://gitlab.com/group/sub/infra',
                    updatedAt: '2026-06-01T00:00:00Z',
                }),
            ])
        )
        const { container } = renderPage({ isGithubConnected: true })

        await screen.findByText('new')
        const links = Array.from(container.querySelectorAll('a'))
        expect(links).toHaveLength(3)
        expect(links.map((a) => a.getAttribute('href'))).toEqual([
            'https://github.com/acme/new',
            'https://gitlab.com/group/sub/infra',
            'https://github.com/acme/old',
        ])
        for (const link of links) {
            expect(link.getAttribute('target')).toBe('_blank')
            expect(link.getAttribute('rel')).toBe('noopener noreferrer')
        }
        expect(screen.getByText('group/sub · GitLab')).toBeDefined()
        expect(screen.getAllByText('acme · GitHub').length).toBe(2)
        expect(screen.getByText('Public')).toBeDefined()
        expect(screen.queryByText('TypeScript')).toBeNull()
        // GitHub is connected and GitLab too: one outline button, no GitLab connect
        expect(screen.getByRole('button', { name: 'Add from GitHub' })).toBeDefined()
        expect(screen.queryByRole('button', { name: 'Connect GitLab' })).toBeNull()
    })

    test('a repository link that is not https is not a link', async () => {
        gitlabStatus({ available: false, connected: false })
        spyOn(profileAPI, 'getGithubRepos').mockImplementation(async () =>
            list([repo({ htmlUrl: 'javascript:alert(1)' })])
        )
        const { container } = renderPage({ isGithubConnected: true })
        await screen.findByText('web')
        expect(container.querySelector('a')).toBeNull()
    })

    test('a search with no match says so (B2)', async () => {
        gitlabStatus({ available: false, connected: false })
        spyOn(profileAPI, 'getGithubRepos').mockImplementation(async () => list([repo({})]))
        renderPage({ isGithubConnected: true })
        await screen.findByText('web')
        typeInto(screen.getByPlaceholderText('Search repositories'), 'zzz')
        expect(await screen.findByText('No repositories match')).toBeDefined()
    })

    test('one host failing keeps the other host and says what is missing (B3, L5-A)', async () => {
        gitlabStatus({ available: true, connected: true })
        spyOn(profileAPI, 'getGithubRepos').mockImplementation(async () => list([repo({})]))
        spyOn(profileAPI, 'getGitlabRepos').mockImplementation(async () => {
            throw new ApiError('GitLab repositories could not load', 502)
        })
        renderPage({ isGithubConnected: true })
        expect(await screen.findByText('GitLab repositories could not load.')).toBeDefined()
        expect(screen.getByText('web')).toBeDefined()
        expect(screen.getByRole('button', { name: 'Try again' })).toBeDefined()
    })

    test('a refused GitHub token asks to reconnect (B9, E5)', async () => {
        gitlabStatus({ available: false, connected: false })
        spyOn(profileAPI, 'getGithubRepos').mockImplementation(async () => {
            throw new ApiError('GitHub needs to be connected again', 409)
        })
        const { onConnectGithub } = renderPage({ isGithubConnected: true })
        expect(await screen.findByText('GitHub needs to be connected again')).toBeDefined()
        fireEvent.click(screen.getByRole('button', { name: 'Reconnect GitHub' }))
        expect(onConnectGithub).toHaveBeenCalled()
    })

    test('every host failing shows the cloud drawing and Try again (E4)', async () => {
        gitlabStatus({ available: false, connected: false })
        spyOn(profileAPI, 'getGithubRepos').mockImplementation(async () => {
            throw new ApiError('GitHub repositories could not load', 502)
        })
        renderPage({ isGithubConnected: true })
        expect(await screen.findByText('Could not load repositories')).toBeDefined()
        expect(screen.getByRole('button', { name: 'Try again' })).toBeDefined()
    })

    test('names installs that could not load and a list over 1,000 (B12, S8)', async () => {
        gitlabStatus({ available: false, connected: false })
        spyOn(profileAPI, 'getGithubRepos').mockImplementation(async () =>
            list([repo({})], { unavailable: ['acme-org'], truncated: true })
        )
        renderPage({ isGithubConnected: true })
        expect(await screen.findByText('Repositories of acme-org could not load.')).toBeDefined()
        expect(screen.getByText('Showing the first 1,000 repositories.')).toBeDefined()
    })

    test('connected with no repositories shows the book drawing (E3)', async () => {
        gitlabStatus({ available: false, connected: false })
        spyOn(profileAPI, 'getGithubRepos').mockImplementation(async () => list([]))
        renderPage({ isGithubConnected: true })
        expect(await screen.findByText('No repositories yet')).toBeDefined()
        expect(screen.getAllByRole('button', { name: 'Add from GitHub' }).length).toBe(2)
    })

    test('an old cached plain array still reads as a list', async () => {
        gitlabStatus({ available: false, connected: false })
        spyOn(profileAPI, 'getGithubRepos').mockImplementation(
            async () => [repo({ name: 'cached' })] as unknown as RepoList
        )
        renderPage({ isGithubConnected: true })
        expect(await screen.findByText('cached')).toBeDefined()
    })

    test('an owner approval request is a grey note, and the address is cleaned (B6)', async () => {
        gitlabStatus({ available: false, connected: false })
        spyOn(profileAPI, 'getGithubRepos').mockImplementation(async () => list([repo({})]))
        renderPage({ isGithubConnected: true, path: '/settings/repositories?github=requested' })
        const note = await screen.findByText(
            'GitHub sent your request to the organization owner to approve.'
        )
        expect(note.getAttribute('role')).toBeNull()
        await screen.findByText('web')
        expect(lastSearch).toBe('')
    })

    test('a failed connect is a red alert once', async () => {
        gitlabStatus({ available: false, connected: false })
        spyOn(profileAPI, 'getGithubRepos').mockImplementation(async () => list([repo({})]))
        renderPage({ isGithubConnected: true, path: '/settings/repositories?github=in_use' })
        const alert = await screen.findByRole('alert')
        expect(alert.textContent).toBe(
            'This GitHub install is connected to another December account.'
        )
        await screen.findByText('web')
        expect(lastSearch).toBe('')
    })
})
