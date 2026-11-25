import { GlobalRegistrator } from '@happy-dom/global-registrator'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, beforeEach, describe, expect, mock, spyOn, test } from 'bun:test'
import React from 'react'

if (!globalThis.document) {
    GlobalRegistrator.register()
}

const { render, screen, cleanup, fireEvent, waitFor } = await import('@testing-library/react')

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

    test('shows the real settings to everyone, without the opening section', async () => {
        wrap(<ProfilePullRequestSettings />)
        expect(
            await screen.findByRole('switch', { name: 'Work from GitHub comments' })
        ).toBeDefined()
        expect(screen.queryByText('Pull request settings are coming soon')).toBeNull()
        expect(screen.queryByRole('textbox', { name: 'Branch name starts with' })).toBeNull()
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

    test('the opening section shows with the preview on', async () => {
        setConnectionsDemo(true)
        wrap(<ProfilePullRequestSettings />)
        expect(
            await screen.findByRole('textbox', { name: 'Branch name starts with' })
        ).toBeDefined()
    })
})
