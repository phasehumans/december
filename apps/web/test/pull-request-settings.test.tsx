import { GlobalRegistrator } from '@happy-dom/global-registrator'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, beforeEach, describe, expect, mock, spyOn, test } from 'bun:test'
import React from 'react'

if (!globalThis.document) {
    GlobalRegistrator.register()
}

const { render, screen, cleanup, fireEvent, waitFor, within } =
    await import('@testing-library/react')

const { setConnectionsDemo } = await import('../src/features/connections/lib/connectionsDemo')
const { profileAPI } = await import('../src/features/profile/api/profile')
const { ProfilePullRequestSettings } =
    await import('../src/features/profile/components/ProfilePullRequestSettings')
const { resetPreviewValues } = await import('../src/features/profile/components/SettingsUi')

import type { PullRequestSettings } from '../src/features/profile/api/profile'

const defaults: PullRequestSettings = {
    branchPrefix: 'december/',
    prDraft: false,
    prAuthor: 'december',
    commitAuthor: 'both',
    githubCommentsEnabled: true,
    reviewReplies: 'mention',
    fixFailedChecks: true,
    autoReview: 'asked',
}

const wrap = (ui: React.ReactNode) =>
    render(
        <QueryClientProvider
            client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
        >
            {ui}
        </QueryClientProvider>
    )

const radio = (group: string, name: string) =>
    within(screen.getByRole('radiogroup', { name: group })).getByRole('radio', { name })

const checked = (group: string) =>
    screen.getByRole('radiogroup', { name: group }).querySelector('[aria-checked="true"]')
        ?.textContent

describe('pull requests settings page (#568, #637)', () => {
    let saved: Partial<PullRequestSettings>[]
    let current: PullRequestSettings

    beforeEach(() => {
        cleanup()
        resetPreviewValues()
        setConnectionsDemo(false)
        saved = []
        current = { ...defaults }
        spyOn(profileAPI, 'getPullRequestSettings').mockImplementation(async () => ({
            ...current,
        }))
        spyOn(profileAPI, 'updatePullRequestSettings').mockImplementation(async (patch) => {
            saved.push(patch)
            current = { ...current, ...patch }
            return { ...current }
        })
    })

    afterEach(() => {
        cleanup()
        setConnectionsDemo(null)
        mock.restore()
    })

    test('shows the eight settings and none of the removed ones', async () => {
        wrap(<ProfilePullRequestSettings />)
        expect(
            await screen.findByRole('switch', { name: 'Work from GitHub comments' })
        ).toBeDefined()
        for (const group of [
            'Open as',
            'Author',
            'Commit author',
            'Answer review comments',
            'Review pull requests',
        ]) {
            expect(screen.getByRole('radiogroup', { name: group })).toBeDefined()
        }
        expect(screen.getByRole('textbox', { name: 'Branch name starts with' })).toBeDefined()
        expect(
            screen.getByRole('switch', { name: 'Fix failed checks on December pull requests' })
        ).toBeDefined()

        // removed: in the prompt box, always on, or not needed
        expect(screen.queryByRole('radiogroup', { name: 'Create the pull request' })).toBeNull()
        expect(
            screen.queryByRole('switch', {
                name: 'Archive the session when the pull request merges',
            })
        ).toBeNull()
        expect(screen.queryByRole('switch', { name: 'Answer comments from bots' })).toBeNull()
        expect(screen.queryByRole('radiogroup', { name: 'Review again' })).toBeNull()
        expect(screen.queryByRole('combobox', { name: 'Repositories to review' })).toBeNull()
        // "All" review still does not show the removed rows
        fireEvent.click(radio('Review pull requests', 'All'))
        await waitFor(() => expect(saved).toEqual([{ autoReview: 'all' }]))
        expect(screen.queryByRole('radiogroup', { name: 'Review again' })).toBeNull()
    })

    test('shows the saved values', async () => {
        current = {
            ...defaults,
            branchPrefix: 'feat/ai-',
            prDraft: true,
            prAuthor: 'user',
            commitAuthor: 'december',
            reviewReplies: 'all',
            fixFailedChecks: false,
            autoReview: 'mine',
        }
        wrap(<ProfilePullRequestSettings />)

        const prefix = (await screen.findByRole('textbox', {
            name: 'Branch name starts with',
        })) as HTMLInputElement
        expect(prefix.value).toBe('feat/ai-')
        expect(checked('Open as')).toBe('Draft')
        expect(checked('Author')).toBe('You')
        expect(checked('Commit author')).toBe('December')
        expect(checked('Answer review comments')).toBe('All')
        expect(checked('Review pull requests')).toBe('My PRs')
        expect(
            screen
                .getByRole('switch', { name: 'Fix failed checks on December pull requests' })
                .getAttribute('aria-checked')
        ).toBe('false')
    })

    test('each change saves to the server', async () => {
        wrap(<ProfilePullRequestSettings />)

        fireEvent.click(await screen.findByRole('radio', { name: 'Draft' }))
        await waitFor(() => expect(saved).toEqual([{ prDraft: true }]))

        fireEvent.click(screen.getByRole('radio', { name: 'You' }))
        await waitFor(() => expect(saved[1]).toEqual({ prAuthor: 'user' }))

        fireEvent.click(
            within(screen.getByRole('radiogroup', { name: 'Commit author' })).getByRole('radio', {
                name: 'December',
            })
        )
        await waitFor(() => expect(saved[2]).toEqual({ commitAuthor: 'december' }))

        fireEvent.click(screen.getByRole('radio', { name: 'Off' }))
        await waitFor(() => expect(saved[3]).toEqual({ reviewReplies: 'off' }))

        fireEvent.click(
            screen.getByRole('switch', { name: 'Fix failed checks on December pull requests' })
        )
        await waitFor(() => expect(saved[4]).toEqual({ fixFailedChecks: false }))

        fireEvent.click(screen.getByRole('radio', { name: 'My PRs' }))
        await waitFor(() => expect(saved[5]).toEqual({ autoReview: 'mine' }))
    })

    test('paused: replies, check fixes and reviews cannot change, and the row says so', async () => {
        wrap(<ProfilePullRequestSettings />)
        fireEvent.click(await screen.findByRole('switch', { name: 'Work from GitHub comments' }))
        await waitFor(() => expect(saved).toEqual([{ githubCommentsEnabled: false }]))

        expect(await screen.findByText('Replies, reviews and check fixes are paused')).toBeDefined()
        const disabled = (el: HTMLElement) => (el as HTMLButtonElement).disabled
        expect(disabled(radio('Answer review comments', 'All'))).toBe(true)
        expect(disabled(radio('Review pull requests', 'All'))).toBe(true)
        expect(disabled(screen.getByRole('radio', { name: 'My PRs' }))).toBe(true)
        expect(
            disabled(
                screen.getByRole('switch', { name: 'Fix failed checks on December pull requests' })
            )
        ).toBe(true)
        // opening still works: it is for sessions, not for GitHub comments
        expect(disabled(screen.getByRole('radio', { name: 'Draft' }))).toBe(false)

        fireEvent.click(screen.getByRole('switch', { name: 'Work from GitHub comments' }))
        await waitFor(() => expect(saved[1]).toEqual({ githubCommentsEnabled: true }))
        await waitFor(() =>
            expect(screen.queryByText('Replies, reviews and check fixes are paused')).toBeNull()
        )
        expect(disabled(screen.getByRole('radio', { name: 'My PRs' }))).toBe(false)
    })

    test('the branch prefix saves when the field is left or on Enter, not on every key', async () => {
        wrap(<ProfilePullRequestSettings />)
        const prefix = await screen.findByRole('textbox', { name: 'Branch name starts with' })

        fireEvent.change(prefix, { target: { value: 'feat/' } })
        expect(saved).toEqual([])
        fireEvent.blur(prefix)
        await waitFor(() => expect(saved).toEqual([{ branchPrefix: 'feat/' }]))

        // no change, no request
        fireEvent.blur(prefix)
        expect(saved).toHaveLength(1)

        // an empty prefix is allowed: the branch is the session id
        fireEvent.change(prefix, { target: { value: '' } })
        fireEvent.blur(prefix)
        await waitFor(() => expect(saved[1]).toEqual({ branchPrefix: '' }))
    })

    test('a prefix git does not allow is not saved, and the text stays to fix', async () => {
        wrap(<ProfilePullRequestSettings />)
        const prefix = (await screen.findByRole('textbox', {
            name: 'Branch name starts with',
        })) as HTMLInputElement

        for (const bad of ['-x/', 'a..b/', '/feat', 'feat branch/', '.hidden/', 'a'.repeat(41)]) {
            fireEvent.change(prefix, { target: { value: bad } })
            fireEvent.blur(prefix)
            expect(screen.getByText('Git does not allow this branch name')).toBeDefined()
            expect(prefix.value).toBe(bad)
        }
        expect(saved).toEqual([])

        // typing clears the error
        fireEvent.change(prefix, { target: { value: 'fix/' } })
        expect(screen.queryByText('Git does not allow this branch name')).toBeNull()
        fireEvent.blur(prefix)
        await waitFor(() => expect(saved).toEqual([{ branchPrefix: 'fix/' }]))
    })

    test('a save that fails goes back and shows the error under its row', async () => {
        spyOn(profileAPI, 'updatePullRequestSettings').mockImplementation(async () => {
            throw new Error('Could not save the settings')
        })
        wrap(<ProfilePullRequestSettings />)

        fireEvent.click(await screen.findByRole('radio', { name: 'Draft' }))
        expect(await screen.findByText('Could not save the settings')).toBeDefined()
        await waitFor(() => expect(checked('Open as')).toBe('Ready'))
    })

    test('the server refusing a prefix shows its message under the row', async () => {
        spyOn(profileAPI, 'updatePullRequestSettings').mockImplementation(async () => {
            throw new Error('branchPrefix does not give a branch name git allows')
        })
        wrap(<ProfilePullRequestSettings />)
        const prefix = await screen.findByRole('textbox', { name: 'Branch name starts with' })

        fireEvent.change(prefix, { target: { value: 'ok/' } })
        fireEvent.blur(prefix)
        expect(
            await screen.findByText('branchPrefix does not give a branch name git allows')
        ).toBeDefined()
    })
})
