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
    prCreate: 'auto',
    prAuthor: 'december',
    commitAuthor: 'both',
    archiveOnMerge: true,
    githubCommentsEnabled: true,
    reviewReplies: 'mention',
    replyToBots: false,
    fixFailedChecks: true,
    autoReview: 'asked',
    reviewCadence: 'once',
    reviewRepos: [],
}

const wrap = (ui: React.ReactNode) =>
    render(
        <QueryClientProvider
            client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
        >
            {ui}
        </QueryClientProvider>
    )

describe('pull requests settings page (#568)', () => {
    let saved: Partial<PullRequestSettings>[]

    beforeEach(() => {
        cleanup()
        resetPreviewValues()
        setConnectionsDemo(false)
        saved = []
        spyOn(profileAPI, 'getPullRequestSettings').mockImplementation(async () => ({
            ...defaults,
        }))
        spyOn(profileAPI, 'getGithubRepos').mockImplementation(async () => [
            { fullName: 'acme/web' } as any,
        ])
        spyOn(profileAPI, 'updatePullRequestSettings').mockImplementation(async (patch) => {
            saved.push(patch)
            return { ...defaults, ...patch }
        })
    })

    afterEach(() => {
        cleanup()
        setConnectionsDemo(null)
        mock.restore()
    })

    test('shows the real settings to everyone', async () => {
        wrap(<ProfilePullRequestSettings />)
        expect(
            await screen.findByRole('switch', { name: 'Work from GitHub comments' })
        ).toBeDefined()
        expect(screen.queryByText('Pull request settings are coming soon')).toBeNull()
        expect(screen.getByRole('radio', { name: 'Only @trydecember' })).toBeDefined()
        expect(screen.getByRole('radio', { name: 'When asked' }).getAttribute('aria-checked')).toBe(
            'true'
        )
        // automatic review rows show only when the review is automatic
        expect(screen.queryByRole('radiogroup', { name: 'Review again' })).toBeNull()
    })

    test('the pause switch and the review choice save to the server', async () => {
        wrap(<ProfilePullRequestSettings />)
        fireEvent.click(await screen.findByRole('switch', { name: 'Work from GitHub comments' }))
        await waitFor(() => expect(saved).toEqual([{ githubCommentsEnabled: false }]))

        fireEvent.click(screen.getByRole('radio', { name: 'My PRs' }))
        await waitFor(() => expect(saved[1]).toEqual({ autoReview: 'mine' }))
        expect(await screen.findByRole('radiogroup', { name: 'Review again' })).toBeDefined()

        fireEvent.change(screen.getByRole('combobox', { name: 'Repositories to review' }), {
            target: { value: 'acme/web' },
        })
        await waitFor(() => expect(saved[2]).toEqual({ reviewRepos: ['acme/web'] }))
    })

    test('the opening section shows the saved values without the preview flag (#637)', async () => {
        spyOn(profileAPI, 'getPullRequestSettings').mockImplementation(async () => ({
            ...defaults,
            branchPrefix: 'feat/ai-',
            prDraft: true,
            prCreate: 'ask',
            prAuthor: 'user',
            commitAuthor: 'december',
            archiveOnMerge: false,
        }))
        wrap(<ProfilePullRequestSettings />)

        const prefix = (await screen.findByRole('textbox', {
            name: 'Branch name starts with',
        })) as HTMLInputElement
        expect(prefix.value).toBe('feat/ai-')
        const checked = (group: string) =>
            screen.getByRole('radiogroup', { name: group }).querySelector('[aria-checked="true"]')
                ?.textContent
        expect(checked('Open as')).toBe('Draft')
        expect(checked('Create the pull request')).toBe('When I ask')
        expect(checked('Author')).toBe('You')
        expect(checked('Commit author')).toBe('December')
        expect(
            screen
                .getByRole('switch', { name: 'Archive the session when the pull request merges' })
                .getAttribute('aria-checked')
        ).toBe('false')
    })

    test('a change in the opening section saves to the server (#637)', async () => {
        wrap(<ProfilePullRequestSettings />)

        fireEvent.click(await screen.findByRole('radio', { name: 'Draft' }))
        await waitFor(() => expect(saved).toEqual([{ prDraft: true }]))

        fireEvent.click(screen.getByRole('radio', { name: 'When I ask' }))
        await waitFor(() => expect(saved[1]).toEqual({ prCreate: 'ask' }))

        fireEvent.click(screen.getByRole('radio', { name: 'You' }))
        await waitFor(() => expect(saved[2]).toEqual({ prAuthor: 'user' }))

        fireEvent.click(
            within(screen.getByRole('radiogroup', { name: 'Commit author' })).getByRole('radio', {
                name: 'December',
            })
        )
        await waitFor(() => expect(saved[3]).toEqual({ commitAuthor: 'december' }))

        fireEvent.click(
            screen.getByRole('switch', { name: 'Archive the session when the pull request merges' })
        )
        await waitFor(() => expect(saved[4]).toEqual({ archiveOnMerge: false }))
    })

    test('the branch prefix saves when the field is left, not on every key (#637)', async () => {
        wrap(<ProfilePullRequestSettings />)
        const prefix = await screen.findByRole('textbox', { name: 'Branch name starts with' })

        fireEvent.change(prefix, { target: { value: 'feat/' } })
        expect(saved).toEqual([])
        fireEvent.blur(prefix)
        await waitFor(() => expect(saved).toEqual([{ branchPrefix: 'feat/' }]))

        // no change, no request
        fireEvent.blur(prefix)
        expect(saved).toHaveLength(1)
    })
})
