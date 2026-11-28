import { GlobalRegistrator } from '@happy-dom/global-registrator'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, beforeEach, describe, expect, mock, spyOn, test } from 'bun:test'
import React from 'react'

if (!globalThis.document) {
    GlobalRegistrator.register()
}

const { render, screen, cleanup, fireEvent, waitFor, within } =
    await import('@testing-library/react')

const { profileAPI } = await import('../src/features/profile/api/profile')
const { secretsAPI } = await import('../src/features/profile/api/secrets')
const { ProfileSecretsSettings } =
    await import('../src/features/profile/components/ProfileSecretsSettings')

import type { CreateSecretInput, SecretSummary } from '../src/features/profile/api/secrets'

const row = (id: string, name: string, repoFullName: string | null): SecretSummary => ({
    id,
    name,
    note: null,
    repoFullName,
    createdAt: '2026-11-25T00:00:00.000Z',
    updatedAt: '2026-11-25T00:00:00.000Z',
})

const wrap = () =>
    render(
        <QueryClientProvider
            client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
        >
            <ProfileSecretsSettings />
        </QueryClientProvider>
    )

/**
 * types into a controlled field. when another test file loaded react-dom before the
 * dom existed, react watches focus + key events instead of input events, so send those too.
 */
const typeInto = (el: HTMLElement, value: string) => {
    fireEvent.focusIn(el)
    fireEvent.change(el, { target: { value } })
    fireEvent.keyUp(el)
    fireEvent.focusOut(el)
}

// the desktop row of a secret: the grid row that holds the given "use in" text
const desktopRow = (useIn: string) => {
    const cell = screen
        .getAllByText(useIn)
        .find((element) => element.getAttribute('data-use-in') !== null)
    if (!cell?.parentElement) throw new Error(`no row for ${useIn}`)
    return cell.parentElement
}

// #637 section 5: a secret for all repositories, or for one repository
describe('secrets settings: a secret for one repository', () => {
    let secrets: SecretSummary[]
    let created: CreateSecretInput[]
    let deleted: Array<[string, string | null | undefined]>
    let read: Array<[string, string | null | undefined]>

    beforeEach(() => {
        cleanup()
        secrets = [row('sec-all', 'API_URL', null), row('sec-web', 'API_URL', 'acme/web')]
        created = []
        deleted = []
        read = []
        spyOn(profileAPI, 'getProfile').mockImplementation(
            async () => ({ id: 'user-1', githubConnected: true }) as any
        )
        spyOn(profileAPI, 'getGithubRepos').mockImplementation(async () => ({
            repos: [
                { id: 1, fullName: 'Acme/Web', defaultBranch: 'main' } as any,
                { id: 2, fullName: 'acme/api', defaultBranch: 'main' } as any,
            ],
            unavailable: [],
            truncated: false,
        }))
        spyOn(profileAPI, 'getGitlabStatus').mockImplementation(async () => ({
            available: false,
            connected: false,
            username: null,
        }))
        spyOn(secretsAPI, 'getSecrets').mockImplementation(async () => ({ secrets }))
        spyOn(secretsAPI, 'createSecret').mockImplementation(async (data) => {
            created.push(data)
            return { secret: row('sec-new', data.name, data.repoFullName ?? null) }
        })
        spyOn(secretsAPI, 'deleteSecret').mockImplementation(async (name, repoFullName) => {
            deleted.push([name, repoFullName])
            return null
        })
        spyOn(secretsAPI, 'getSecretValue').mockImplementation(async (name, repoFullName) => {
            read.push([name, repoFullName])
            return {
                secret: {
                    ...row('x', name, repoFullName ?? null),
                    value: repoFullName ? 'value-of-web' : 'value-of-all',
                },
            }
        })
    })

    afterEach(() => {
        cleanup()
    })

    test('the list shows where each secret is used, for every user', async () => {
        wrap()
        await screen.findAllByText('$API_URL')

        expect(screen.getAllByText('Use in').length).toBeGreaterThan(0)
        // the repository shows with the letter case of the repository list
        expect(await screen.findAllByText('Acme/Web')).not.toHaveLength(0)
        expect(screen.getAllByText('All').length).toBeGreaterThan(0)
    })

    test('the dialog offers the repositories of the user and sends the one picked', async () => {
        wrap()
        await screen.findAllByText('$API_URL')
        fireEvent.click(screen.getByText('Add secret'))

        const useIn = (await screen.findByRole('combobox', {
            name: 'Use in',
        })) as HTMLSelectElement
        await waitFor(() =>
            expect([...useIn.options].map((option) => option.textContent)).toEqual([
                'All repositories',
                'Acme/Web',
                'acme/api',
            ])
        )
        // no sample values
        expect(useIn.value).toBe('')

        typeInto(screen.getByPlaceholderText('SERVICE_USERNAME'), 'stripe key')
        typeInto(screen.getByPlaceholderText('Key or token'), 'sk_test_1')
        fireEvent.change(useIn, { target: { value: 'acme/api' } })
        fireEvent.submit(useIn.closest('form') as HTMLFormElement)

        await waitFor(() => expect(created).toHaveLength(1))
        expect(created[0]).toEqual({
            name: 'STRIPE_KEY',
            value: 'sk_test_1',
            note: undefined,
            repoFullName: 'acme/api',
        })
    })

    test('a secret for all repositories is sent with no repository', async () => {
        wrap()
        await screen.findAllByText('$API_URL')
        fireEvent.click(screen.getByText('Add secret'))

        const useIn = await screen.findByRole('combobox', { name: 'Use in' })
        typeInto(screen.getByPlaceholderText('SERVICE_USERNAME'), 'REGION')
        typeInto(screen.getByPlaceholderText('Key or token'), 'eu')
        fireEvent.submit(useIn.closest('form') as HTMLFormElement)

        await waitFor(() => expect(created).toHaveLength(1))
        expect(created[0].repoFullName).toBeNull()
    })

    test('the bulk dialog has the same "Use in" select and sends the repository picked', async () => {
        const bulk: Array<Parameters<typeof secretsAPI.bulkCreateSecrets>[0]> = []
        spyOn(secretsAPI, 'bulkCreateSecrets').mockImplementation(async (data) => {
            bulk.push(data)
            return null
        })
        wrap()
        await screen.findAllByText('$API_URL')
        fireEvent.click(screen.getByText('Bulk add'))

        const useIn = (await screen.findByRole('combobox', {
            name: 'Use in',
        })) as HTMLSelectElement
        await waitFor(() =>
            expect([...useIn.options].map((option) => option.textContent)).toEqual([
                'All repositories',
                'Acme/Web',
                'acme/api',
            ])
        )
        expect(useIn.value).toBe('')

        const form = useIn.closest('form') as HTMLFormElement
        typeInto(form.querySelector('textarea') as HTMLTextAreaElement, 'A=1\nB=2')
        fireEvent.change(useIn, { target: { value: 'acme/api' } })
        fireEvent.submit(form)

        await waitFor(() => expect(bulk).toHaveLength(1))
        expect(bulk[0]).toEqual({
            secrets: [
                { name: 'A', value: '1', note: 'Bulk imported secret' },
                { name: 'B', value: '2', note: 'Bulk imported secret' },
            ],
            repoFullName: 'acme/api',
        })
    })

    test('a bulk add for all repositories is sent with no repository', async () => {
        const bulk: Array<Parameters<typeof secretsAPI.bulkCreateSecrets>[0]> = []
        spyOn(secretsAPI, 'bulkCreateSecrets').mockImplementation(async (data) => {
            bulk.push(data)
            return null
        })
        wrap()
        await screen.findAllByText('$API_URL')
        fireEvent.click(screen.getByText('Bulk add'))

        const useIn = await screen.findByRole('combobox', { name: 'Use in' })
        const form = useIn.closest('form') as HTMLFormElement
        typeInto(form.querySelector('textarea') as HTMLTextAreaElement, 'A=1')
        fireEvent.submit(form)

        await waitFor(() => expect(bulk).toHaveLength(1))
        expect(bulk[0].repoFullName).toBeNull()
    })

    test('delete acts on the row of the repository when a name is there two times', async () => {
        wrap()
        await screen.findAllByText('Acme/Web')

        const buttons = within(desktopRow('Acme/Web')).getAllByRole('button')
        fireEvent.click(buttons[buttons.length - 1])

        await waitFor(() => expect(deleted).toEqual([['API_URL', 'acme/web']]))
        // the row for all repositories stays in the list
        await waitFor(() => expect(screen.queryByText('Acme/Web')).toBeNull())
        expect(screen.getAllByText('$API_URL').length).toBeGreaterThan(0)
    })

    test('reveal reads and shows the value of the right row', async () => {
        wrap()
        await screen.findAllByText('Acme/Web')

        fireEvent.click(within(desktopRow('Acme/Web')).getAllByRole('button')[0])

        await waitFor(() => expect(read).toEqual([['API_URL', 'acme/web']]))
        expect((await screen.findAllByText('value-of-web')).length).toBeGreaterThan(0)
        // the row for all repositories still shows its name, not a value
        expect(screen.queryByText('value-of-all')).toBeNull()
        expect(screen.getAllByText('$API_URL').length).toBeGreaterThan(0)
    })
})

describe('secrets api client: the repository of a named secret', () => {
    test('sends the repository as ?repo= and nothing for all repositories', async () => {
        // the real client, not the stand-ins of the tests above
        mock.restore()
        const urls: string[] = []
        const savedFetch = globalThis.fetch
        globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
            const url = String(input instanceof Request ? input.url : input)
            urls.push(`${init?.method ?? 'GET'} ${url}`)
            return new Response(JSON.stringify({ success: true, data: null }), {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
            })
        }) as typeof fetch
        try {
            await secretsAPI.deleteSecret('API_URL', 'acme/web')
            await secretsAPI.deleteSecret('API_URL')
            await secretsAPI.getSecretValue('API_URL', 'acme/web')
            await secretsAPI.getSecretValue('API_URL', null)
        } finally {
            globalThis.fetch = savedFetch
        }
        const paths = urls.map((url) => url.replace(/^(\w+) .*\/secrets/, '$1 /secrets'))
        expect(paths).toEqual([
            'DELETE /secrets/API_URL?repo=acme%2Fweb',
            'DELETE /secrets/API_URL',
            'GET /secrets/API_URL/value?repo=acme%2Fweb',
            'GET /secrets/API_URL/value',
        ])
    })
})
