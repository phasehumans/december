import { GlobalRegistrator } from '@happy-dom/global-registrator'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, beforeEach, describe, expect, mock, spyOn, test } from 'bun:test'
import React from 'react'
import { MemoryRouter } from 'react-router-dom'

if (!globalThis.document) {
    GlobalRegistrator.register()
}

const { render, screen, cleanup, fireEvent, waitFor, within, act } =
    await import('@testing-library/react')

const { profileAPI } = await import('../src/features/profile/api/profile')
const { secretsAPI, SECRETS_MENTION_KEY } = await import('../src/features/profile/api/secrets')
const { ProfileSecretsSettings } =
    await import('../src/features/profile/components/ProfileSecretsSettings')
const { SettingsTopBarContext } = await import('../src/features/profile/lib/settingsTopBar')
const { ChatPromptInput } = await import('../src/features/chat/components/ChatPromptInput')
const { setSkeletonPreview } = await import('../src/shared/lib/skeletonPreview')

import type {
    BulkCreateSecretsInput,
    CreateSecretInput,
    SecretSummary,
} from '../src/features/profile/api/secrets'
import type { SettingsTopBarAction } from '../src/features/profile/lib/settingsTopBar'

const row = (
    id: string,
    name: string,
    repoFullName: string | null = null,
    note: string | null = null
): SecretSummary => ({
    id,
    name,
    note,
    repoFullName,
    createdAt: '2026-11-25T12:00:00.000Z',
    updatedAt: '2026-11-25T12:00:00.000Z',
})

const deferred = <T,>() => {
    let resolve!: (value: T) => void
    let reject!: (error: unknown) => void
    const promise = new Promise<T>((res, rej) => {
        resolve = res
        reject = rej
    })
    return { promise, resolve, reject }
}

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

let queryClient: QueryClient
let topBar: SettingsTopBarAction | null

const wrap = () => {
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    return render(
        <QueryClientProvider client={queryClient}>
            <SettingsTopBarContext.Provider
                value={(action) => {
                    topBar = action
                }}
            >
                <ProfileSecretsSettings />
            </SettingsTopBarContext.Provider>
        </QueryClientProvider>
    )
}

/** the element of one secret row (the phone and the desktop parts) */
const rowOf = (id: string) => {
    const element = document.querySelector(`[data-secret-row="${id}"]`)
    if (!element) throw new Error(`no row ${id}`)
    return element as HTMLElement
}

const openAdd = async () => {
    fireEvent.click(await screen.findByRole('button', { name: 'Add secret' }))
    return (await screen.findByPlaceholderText('SERVICE_USERNAME')).closest(
        'form'
    ) as HTMLFormElement
}

const openBulk = async () => {
    fireEvent.click(await screen.findByRole('button', { name: 'Bulk add' }))
    const textarea = await screen.findByRole('textbox', { name: 'Secrets' })
    return { textarea, form: textarea.closest('form') as HTMLFormElement }
}

/** the open Delete secret dialog (the Modal has no dialog role) */
const deleteDialog = async () => {
    const heading = await screen.findByRole('heading', { name: 'Delete secret' })
    return heading.parentElement!.parentElement as HTMLElement
}

/** an item of the open ⋯ menu of a row (the desktop icon buttons have an aria-label) */
const menuItem = (id: string, label: string) => {
    const item = within(rowOf(id))
        .getAllByRole('button', { name: label })
        .find((button) => !button.getAttribute('aria-label'))
    if (!item) throw new Error(`no menu item ${label}`)
    return item
}

const submitButton = (form: HTMLFormElement) =>
    within(form)
        .getAllByRole('button')
        .find((b) => b.getAttribute('type') === 'submit')!

describe('secrets settings page', () => {
    let secrets: SecretSummary[]
    let repos: Array<{ id: number; fullName: string; defaultBranch: string }>
    let created: CreateSecretInput[]
    let bulk: BulkCreateSecretsInput[]
    let deleted: Array<[string, string | null | undefined]>
    let read: Array<[string, string | null | undefined]>
    let getSecretsCalls: number

    beforeEach(() => {
        cleanup()
        topBar = null
        secrets = [
            row('sec-all', 'API_URL', null, 'Main api'),
            row('sec-web', 'API_URL', 'acme/web'),
            row('sec-db', 'DATABASE_URL', null, 'Postgres'),
        ]
        repos = [
            { id: 1, fullName: 'Acme/Web', defaultBranch: 'main' },
            { id: 2, fullName: 'acme/api', defaultBranch: 'main' },
        ]
        created = []
        bulk = []
        deleted = []
        read = []
        getSecretsCalls = 0
        spyOn(profileAPI, 'getProfile').mockImplementation(
            async () => ({ id: 'user-1', githubConnected: true }) as any
        )
        spyOn(profileAPI, 'getGithubRepos').mockImplementation(
            async () => ({ repos, unavailable: [], truncated: false }) as any
        )
        spyOn(profileAPI, 'getGitlabStatus').mockImplementation(async () => ({
            available: false,
            connected: false,
            username: null,
        }))
        spyOn(secretsAPI, 'getSecrets').mockImplementation(async () => {
            getSecretsCalls++
            return { secrets: [...secrets] }
        })
        spyOn(secretsAPI, 'createSecret').mockImplementation(async (data) => {
            created.push(data)
            const saved = row(`sec-${created.length}-new`, data.name, data.repoFullName ?? null)
            secrets = [saved, ...secrets]
            return { secret: saved }
        })
        spyOn(secretsAPI, 'bulkCreateSecrets').mockImplementation(async (data) => {
            bulk.push(data)
            return { created: data.secrets.length, updated: 0, saved: data.secrets.length }
        })
        spyOn(secretsAPI, 'deleteSecret').mockImplementation(async (name, repoFullName) => {
            deleted.push([name, repoFullName])
            secrets = secrets.filter(
                (s) => !(s.name === name && (s.repoFullName ?? null) === (repoFullName ?? null))
            )
            return null
        })
        spyOn(secretsAPI, 'getSecretValue').mockImplementation(async (name, repoFullName) => {
            read.push([name, repoFullName])
            return {
                secret: {
                    ...row('x', name, repoFullName ?? null),
                    value: `value-of-${name}-${repoFullName ?? 'all'}`,
                },
            }
        })
    })

    afterEach(() => {
        cleanup()
        setSkeletonPreview(null)
        mock.restore()
    })

    describe('the list', () => {
        test('shows the heading, and a skeleton while the list loads', async () => {
            const pending = deferred<{ secrets: SecretSummary[] }>()
            spyOn(secretsAPI, 'getSecrets').mockImplementation(() => pending.promise)
            wrap()
            expect(screen.getByRole('heading', { name: 'Secrets' })).not.toBeNull()
            expect(screen.getByText('$NAME')).not.toBeNull()
            expect(screen.queryByText('No secrets yet')).toBeNull()
            expect(screen.queryByLabelText('Next page')).toBeNull()

            await act(async () => pending.resolve({ secrets: [row('a', 'ONE')] }))
            expect((await screen.findAllByText('$ONE')).length).toBeGreaterThan(0)
        })

        test('shows each secret with where it is used, its note and its date, and no value', async () => {
            wrap()
            await screen.findAllByText('$DATABASE_URL')

            const all = rowOf('sec-all')
            expect(within(all).getAllByText('$API_URL').length).toBeGreaterThan(0)
            expect(within(all).getByText('All')).not.toBeNull()
            expect(within(all).getByText('Main api')).not.toBeNull()
            expect(within(all).getByText('All repositories · Main api')).not.toBeNull()
            expect(within(all).getAllByText('Nov 25, 2026').length).toBeGreaterThan(0)

            // the repository shows with the letter case of the repository list
            await waitFor(() =>
                expect(within(rowOf('sec-web')).getAllByText('Acme/Web').length).toBeGreaterThan(0)
            )
            expect(document.body.textContent).not.toContain('value-of')
            expect(read).toEqual([])
        })

        test('shows the stored repository name when it is not in the repository list', async () => {
            secrets = [row('sec-x', 'TOKEN', 'other/repo')]
            wrap()
            await screen.findAllByText('$TOKEN')
            expect(within(rowOf('sec-x')).getAllByText('other/repo').length).toBeGreaterThan(0)
        })

        test('shows one line when there are no secrets, and no pager', async () => {
            secrets = []
            wrap()
            const title = await screen.findByRole('heading', { name: 'No secrets yet' })
            // the padlock drawing and an Add secret button in the empty box
            expect(title.parentElement!.querySelector('svg')).not.toBeNull()
            const adds = screen.getAllByRole('button', { name: 'Add secret' })
            expect(adds.length).toBe(2)
            expect(screen.queryByText('1 of 1')).toBeNull()
            expect(screen.queryByRole('button', { name: 'Rows per page' })).toBeNull()
            fireEvent.click(adds[1]!)
            expect(await screen.findByPlaceholderText('SERVICE_USERNAME')).not.toBeNull()
        })

        test('says when the list did not load, not "No secrets yet", and tries again', async () => {
            let fail = true
            spyOn(secretsAPI, 'getSecrets').mockImplementation(async () => {
                if (fail) throw new Error('Network down')
                return { secrets: [row('a', 'BACK')] }
            })
            wrap()
            expect(await screen.findByText('Secrets did not load.')).not.toBeNull()
            expect(screen.queryByText('No secrets yet')).toBeNull()

            fail = false
            fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
            expect((await screen.findAllByText('$BACK')).length).toBeGreaterThan(0)
            expect(screen.queryByText('Secrets did not load.')).toBeNull()
        })

        test('the skeleton preview shows the skeleton over the rows', async () => {
            setSkeletonPreview(true)
            wrap()
            await waitFor(() => expect(getSecretsCalls).toBe(1))
            expect(screen.queryByText('$API_URL')).toBeNull()
        })
    })

    describe('search', () => {
        test('finds by name, by note and by repository, and says when nothing matches', async () => {
            wrap()
            await screen.findAllByText('$DATABASE_URL')
            const search = screen.getByRole('textbox', { name: 'Search secrets' })

            typeInto(search, 'database')
            await waitFor(() => expect(screen.queryByText('$API_URL')).toBeNull())
            expect(screen.getAllByText('$DATABASE_URL').length).toBeGreaterThan(0)

            typeInto(search, 'main api')
            await waitFor(() => expect(screen.queryByText('$DATABASE_URL')).toBeNull())
            expect(() => rowOf('sec-all')).not.toThrow()
            expect(() => rowOf('sec-web')).toThrow()

            typeInto(search, 'acme/web')
            await waitFor(() => expect(() => rowOf('sec-web')).not.toThrow())
            expect(() => rowOf('sec-all')).toThrow()

            typeInto(search, 'nothing like this')
            const noMatch = await screen.findByRole('heading', { name: 'No secrets match' })
            // a search with no match has no Add button in the box
            expect(within(noMatch.parentElement!).queryByRole('button')).toBeNull()
        })

        test('a search starts at the first page', async () => {
            secrets = Array.from({ length: 15 }, (_, i) => row(`s${i}`, `KEY_${i + 1}`))
            wrap()
            await screen.findAllByText('$KEY_1')
            fireEvent.click(screen.getByLabelText('Next page'))
            expect(await screen.findByText('2 of 2')).not.toBeNull()

            typeInto(screen.getByRole('textbox', { name: 'Search secrets' }), 'KEY_1')
            // KEY_1 and KEY_10 to KEY_15: 7 rows, one page
            expect(await screen.findByText('1 of 1')).not.toBeNull()
        })
    })

    describe('pages', () => {
        beforeEach(() => {
            secrets = Array.from({ length: 25 }, (_, i) => row(`s${i}`, `KEY_${i + 1}`))
        })

        test('shows 10 rows a page and moves between pages', async () => {
            wrap()
            await screen.findAllByText('$KEY_1')
            expect(screen.getAllByText('$KEY_10').length).toBeGreaterThan(0)
            expect(screen.queryByText('$KEY_11')).toBeNull()
            expect(screen.getByText('1 of 3')).not.toBeNull()
            expect((screen.getByLabelText('Previous page') as HTMLButtonElement).disabled).toBe(
                true
            )

            fireEvent.click(screen.getByLabelText('Next page'))
            expect((await screen.findAllByText('$KEY_11')).length).toBeGreaterThan(0)
            expect(screen.getByText('2 of 3')).not.toBeNull()
            fireEvent.click(screen.getByLabelText('Next page'))
            expect(await screen.findByText('3 of 3')).not.toBeNull()
            expect((screen.getByLabelText('Next page') as HTMLButtonElement).disabled).toBe(true)

            fireEvent.click(screen.getByLabelText('Previous page'))
            expect(await screen.findByText('2 of 3')).not.toBeNull()
        })

        test('the rows per page dropdown sets the page size and goes back to page 1', async () => {
            wrap()
            await screen.findAllByText('$KEY_1')
            fireEvent.click(screen.getByLabelText('Next page'))
            await screen.findByText('2 of 3')

            const trigger = screen.getByRole('button', { name: 'Rows per page' })
            expect(trigger.textContent).toContain('10')
            fireEvent.click(trigger)
            expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual([
                '10',
                '20',
                '30',
            ])
            fireEvent.click(screen.getByRole('option', { name: '30' }))

            expect(await screen.findByText('1 of 1')).not.toBeNull()
            expect(screen.getAllByText('$KEY_25').length).toBeGreaterThan(0)
            expect(screen.getByRole('button', { name: 'Rows per page' }).textContent).toContain(
                '30'
            )
        })

        test('after the last row of the last page is deleted, the page before shows', async () => {
            secrets = Array.from({ length: 11 }, (_, i) => row(`s${i}`, `KEY_${i + 1}`))
            wrap()
            await screen.findAllByText('$KEY_1')
            fireEvent.click(screen.getByLabelText('Next page'))
            await screen.findByText('2 of 2')

            fireEvent.click(within(rowOf('s10')).getByRole('button', { name: 'Delete secret' }))
            const dialog = await deleteDialog()
            fireEvent.click(within(dialog).getByRole('button', { name: 'Delete secret' }))

            await waitFor(() => expect(deleted).toEqual([['KEY_11', null]]))
            await waitFor(() => expect(screen.getAllByText('$KEY_1').length).toBeGreaterThan(0))
            expect(screen.queryByText('2 of 2')).toBeNull()
        })
    })

    describe('add one secret', () => {
        test('puts the name in capitals as it is typed and sends the secret', async () => {
            wrap()
            await screen.findAllByText('$API_URL')
            const form = await openAdd()

            const name = screen.getByPlaceholderText('SERVICE_USERNAME') as HTMLInputElement
            typeInto(name, 'stripe key')
            expect(name.value).toBe('STRIPE_KEY')
            typeInto(screen.getByPlaceholderText('Key or token'), '  sk_test_1  ')
            typeInto(screen.getByPlaceholderText('Optional'), '  billing ')
            fireEvent.submit(form)

            await waitFor(() => expect(created).toHaveLength(1))
            expect(created[0]).toEqual({
                name: 'STRIPE_KEY',
                value: 'sk_test_1',
                note: 'billing',
                repoFullName: null,
            })
            // the dialog closes and the list is read again
            await waitFor(() =>
                expect(screen.queryByPlaceholderText('SERVICE_USERNAME')).toBeNull()
            )
            expect((await screen.findAllByText('$STRIPE_KEY')).length).toBeGreaterThan(0)
        })

        test('sends no note when the note is empty', async () => {
            wrap()
            const form = await openAdd()
            typeInto(screen.getByPlaceholderText('SERVICE_USERNAME'), 'REGION')
            typeInto(screen.getByPlaceholderText('Key or token'), 'eu')
            fireEvent.submit(form)
            await waitFor(() => expect(created).toHaveLength(1))
            expect(created[0]!.note).toBeNull()
        })

        test('refreshes the @secrets: list of the prompt box after a save', async () => {
            wrap()
            await screen.findAllByText('$API_URL')
            queryClient.setQueryData(SECRETS_MENTION_KEY, { secrets: [] })
            const form = await openAdd()
            typeInto(screen.getByPlaceholderText('SERVICE_USERNAME'), 'NEW_ONE')
            typeInto(screen.getByPlaceholderText('Key or token'), 'v')
            fireEvent.submit(form)
            await waitFor(() => expect(created).toHaveLength(1))
            await waitFor(() =>
                expect(queryClient.getQueryState(SECRETS_MENTION_KEY)?.isInvalidated).toBe(true)
            )
        })

        test('says why a name is refused and does not send it', async () => {
            wrap()
            const form = await openAdd()
            typeInto(screen.getByPlaceholderText('Key or token'), 'v')

            typeInto(screen.getByPlaceholderText('SERVICE_USERNAME'), 'path')
            expect(
                await screen.findByText('PATH is a system name. Use a different name.')
            ).not.toBeNull()
            expect((submitButton(form) as HTMLButtonElement).disabled).toBe(true)

            typeInto(screen.getByPlaceholderText('SERVICE_USERNAME'), 'ld_preload')
            expect(
                await screen.findByText('LD_PRELOAD is a system name. Use a different name.')
            ).not.toBeNull()

            typeInto(screen.getByPlaceholderText('SERVICE_USERNAME'), '2FA')
            expect(await screen.findByText('Start the name with a letter or _.')).not.toBeNull()

            fireEvent.submit(form)
            await new Promise((resolve) => setTimeout(resolve, 20))
            expect(created).toEqual([])

            typeInto(screen.getByPlaceholderText('SERVICE_USERNAME'), 'TWO_FA')
            await waitFor(() =>
                expect(screen.queryByText('Start the name with a letter or _.')).toBeNull()
            )
            expect((submitButton(form) as HTMLButtonElement).disabled).toBe(false)
        })

        test('says when the value is too long', async () => {
            wrap()
            const form = await openAdd()
            typeInto(screen.getByPlaceholderText('SERVICE_USERNAME'), 'BIG')
            typeInto(screen.getByPlaceholderText('Key or token'), 'a'.repeat(16 * 1024 + 1))
            expect(await screen.findByText('Use 16,384 characters or fewer.')).not.toBeNull()
            expect((submitButton(form) as HTMLButtonElement).disabled).toBe(true)
        })

        test('says "Replace secret" for a name that is there for the picked repository', async () => {
            wrap()
            await screen.findAllByText('$API_URL')
            const form = await openAdd()
            typeInto(screen.getByPlaceholderText('SERVICE_USERNAME'), 'DATABASE_URL')
            expect(submitButton(form).textContent).toBe('Replace secret')
            typeInto(screen.getByPlaceholderText('SERVICE_USERNAME'), 'NEW_NAME')
            expect(submitButton(form).textContent).toBe('Add secret')
        })

        test('keeps the dialog open with the server error, then saves on a second try', async () => {
            let fail = true
            spyOn(secretsAPI, 'createSecret').mockImplementation(async (data) => {
                if (fail)
                    throw new Error('You can keep up to 100 secrets. Delete one to add another.')
                created.push(data)
                return { secret: row('n', data.name) }
            })
            wrap()
            const form = await openAdd()
            typeInto(screen.getByPlaceholderText('SERVICE_USERNAME'), 'ONE_MORE')
            typeInto(screen.getByPlaceholderText('Key or token'), 'v')
            fireEvent.submit(form)

            expect(
                await screen.findByText(
                    'You can keep up to 100 secrets. Delete one to add another.'
                )
            ).not.toBeNull()
            expect((screen.getByPlaceholderText('Key or token') as HTMLInputElement).value).toBe(
                'v'
            )

            fail = false
            fireEvent.submit(form)
            await waitFor(() => expect(created).toHaveLength(1))
        })

        test('sends one save for a double submit', async () => {
            const pending = deferred<{ secret: SecretSummary }>()
            let calls = 0
            spyOn(secretsAPI, 'createSecret').mockImplementation(() => {
                calls++
                return pending.promise
            })
            wrap()
            const form = await openAdd()
            typeInto(screen.getByPlaceholderText('SERVICE_USERNAME'), 'ONCE')
            typeInto(screen.getByPlaceholderText('Key or token'), 'v')
            fireEvent.submit(form)
            fireEvent.submit(form)
            await act(async () => pending.resolve({ secret: row('o', 'ONCE') }))
            expect(calls).toBe(1)
        })

        test('the value field hides the value, and has no autofill or spell check', async () => {
            wrap()
            await openAdd()
            const value = screen.getByPlaceholderText('Key or token') as HTMLInputElement
            expect(value.type).toBe('password')
            expect(value.getAttribute('autocomplete')).toBe('off')
            expect(value.getAttribute('spellcheck')).toBe('false')
            fireEvent.click(screen.getByLabelText('Show secret value'))
            expect(value.type).toBe('text')
            fireEvent.click(screen.getByLabelText('Hide secret value'))
            expect(value.type).toBe('password')
        })

        test('cancel closes the dialog, and it opens empty again', async () => {
            wrap()
            await openAdd()
            typeInto(screen.getByPlaceholderText('SERVICE_USERNAME'), 'DRAFT')
            fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
            await waitFor(() =>
                expect(screen.queryByPlaceholderText('SERVICE_USERNAME')).toBeNull()
            )
            await openAdd()
            expect(
                (screen.getByPlaceholderText('SERVICE_USERNAME') as HTMLInputElement).value
            ).toBe('')
        })

        test('"Paste a .env file" opens the bulk dialog', async () => {
            wrap()
            await openAdd()
            fireEvent.click(screen.getByRole('button', { name: 'Paste a .env file' }))
            expect(await screen.findByRole('textbox', { name: 'Secrets' })).not.toBeNull()
            expect(screen.queryByPlaceholderText('SERVICE_USERNAME')).toBeNull()
        })

        test('phones: the + of the top bar opens the dialog', async () => {
            wrap()
            await waitFor(() => expect(topBar?.label).toBe('Add secret'))
            act(() => topBar!.onClick())
            expect(await screen.findByPlaceholderText('SERVICE_USERNAME')).not.toBeNull()
        })
    })

    describe('use in', () => {
        test('offers the repositories of the user and sends the one picked', async () => {
            wrap()
            await screen.findAllByText('$API_URL')
            const form = await openAdd()

            const trigger = await screen.findByRole('button', { name: 'Use in' })
            expect(trigger.textContent).toContain('All repositories')
            fireEvent.click(trigger)
            expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual([
                'All repositories',
                'Acme/Web',
                'acme/api',
            ])
            fireEvent.click(screen.getByRole('option', { name: 'acme/api' }))
            expect(screen.getByRole('button', { name: 'Use in' }).textContent).toContain('acme/api')

            typeInto(screen.getByPlaceholderText('SERVICE_USERNAME'), 'KEY')
            typeInto(screen.getByPlaceholderText('Key or token'), 'v')
            fireEvent.submit(form)
            await waitFor(() => expect(created).toHaveLength(1))
            expect(created[0]!.repoFullName).toBe('acme/api')
        })

        test('is not there when the user has no repository to pick', async () => {
            repos = []
            wrap()
            await screen.findAllByText('$API_URL')
            await openAdd()
            await new Promise((resolve) => setTimeout(resolve, 20))
            expect(screen.queryByRole('button', { name: 'Use in' })).toBeNull()
        })

        test('"Replace secret" looks at the repository picked', async () => {
            wrap()
            await screen.findAllByText('$API_URL')
            const form = await openAdd()
            typeInto(screen.getByPlaceholderText('SERVICE_USERNAME'), 'API_URL')
            expect(submitButton(form).textContent).toBe('Replace secret')
            fireEvent.click(await screen.findByRole('button', { name: 'Use in' }))
            fireEvent.click(screen.getByRole('option', { name: 'acme/api' }))
            expect(submitButton(form).textContent).toBe('Add secret')
            fireEvent.click(screen.getByRole('button', { name: 'Use in' }))
            fireEvent.click(screen.getByRole('option', { name: 'Acme/Web' }))
            expect(submitButton(form).textContent).toBe('Replace secret')
        })
    })

    describe('bulk add', () => {
        test('reads a pasted .env file and sends its secrets, with no note', async () => {
            wrap()
            await screen.findAllByText('$API_URL')
            const { textarea, form } = await openBulk()
            typeInto(
                textarea,
                [
                    '# keys',
                    'export STRIPE_KEY=sk_test_1',
                    'DATABASE_URL="postgres://u:p@h/db"',
                    "QUOTED='a # b'",
                    'PLAIN=value # comment',
                    'EMPTY=',
                    'my-key=1',
                    'PLAIN=last',
                ].join('\n')
            )
            expect(await screen.findByText('5 secrets')).not.toBeNull()
            fireEvent.submit(form)

            await waitFor(() => expect(bulk).toHaveLength(1))
            expect(bulk[0]).toEqual({
                secrets: [
                    { name: 'STRIPE_KEY', value: 'sk_test_1' },
                    { name: 'DATABASE_URL', value: 'postgres://u:p@h/db' },
                    { name: 'QUOTED', value: 'a # b' },
                    { name: 'PLAIN', value: 'last' },
                    { name: 'MY_KEY', value: '1' },
                ],
                repoFullName: null,
            })
            await waitFor(() =>
                expect(screen.queryByRole('textbox', { name: 'Secrets' })).toBeNull()
            )
            await waitFor(() => expect(getSecretsCalls).toBe(2))
        })

        test('says "1 secret" for one line', async () => {
            wrap()
            const { textarea } = await openBulk()
            typeInto(textarea, 'A=1')
            expect(await screen.findByText('1 secret')).not.toBeNull()
        })

        test('shows the first line that cannot be read and sends nothing', async () => {
            wrap()
            const { textarea, form } = await openBulk()
            typeInto(textarea, 'GOOD=1\nPATH=/bin\nno equals here')
            expect(
                await screen.findByText('Line 2: PATH is a system name. Use a different name.')
            ).not.toBeNull()
            expect((submitButton(form) as HTMLButtonElement).disabled).toBe(true)
            fireEvent.submit(form)
            await new Promise((resolve) => setTimeout(resolve, 20))
            expect(bulk).toEqual([])

            typeInto(textarea, 'A="open')
            expect(await screen.findByText('Line 1: Close the quote of the value.')).not.toBeNull()
        })

        test('refuses more than 100 secrets at a time', async () => {
            wrap()
            const { textarea, form } = await openBulk()
            typeInto(textarea, Array.from({ length: 101 }, (_, i) => `K_${i}=v`).join('\n'))
            expect(await screen.findByText('Add up to 100 secrets at a time.')).not.toBeNull()
            expect((submitButton(form) as HTMLButtonElement).disabled).toBe(true)
        })

        test('sends the repository picked', async () => {
            wrap()
            await screen.findAllByText('$API_URL')
            const { textarea, form } = await openBulk()
            typeInto(textarea, 'A=1\nB=2')
            fireEvent.click(await screen.findByRole('button', { name: 'Use in' }))
            fireEvent.click(screen.getByRole('option', { name: 'acme/api' }))
            fireEvent.submit(form)
            await waitFor(() => expect(bulk).toHaveLength(1))
            expect(bulk[0]).toEqual({
                secrets: [
                    { name: 'A', value: '1' },
                    { name: 'B', value: '2' },
                ],
                repoFullName: 'acme/api',
            })
        })

        test('keeps the dialog and the text open with the server error', async () => {
            spyOn(secretsAPI, 'bulkCreateSecrets').mockImplementation(async () => {
                throw new Error('A is in the list more than one time.')
            })
            wrap()
            const { textarea, form } = await openBulk()
            typeInto(textarea, 'A=1')
            fireEvent.submit(form)
            expect(await screen.findByText('A is in the list more than one time.')).not.toBeNull()
            expect((textarea as HTMLTextAreaElement).value).toBe('A=1')
        })

        test('the text box has no spell check and no autofill', async () => {
            wrap()
            const { textarea } = await openBulk()
            expect(textarea.getAttribute('spellcheck')).toBe('false')
            expect(textarea.getAttribute('autocomplete')).toBe('off')
        })
    })

    describe('show and copy a value', () => {
        test('shows the value of the right row, and hides it again', async () => {
            wrap()
            await screen.findAllByText('Acme/Web')
            fireEvent.click(within(rowOf('sec-web')).getByRole('button', { name: 'Show value' }))

            await waitFor(() => expect(read).toEqual([['API_URL', 'acme/web']]))
            expect(
                (await within(rowOf('sec-web')).findAllByText('value-of-API_URL-acme/web')).length
            ).toBeGreaterThan(0)
            // the row for all repositories still shows its name, not a value
            expect(within(rowOf('sec-all')).getAllByText('$API_URL').length).toBeGreaterThan(0)

            fireEvent.click(within(rowOf('sec-web')).getByRole('button', { name: 'Hide value' }))
            await waitFor(() => expect(screen.queryByText('value-of-API_URL-acme/web')).toBeNull())

            // a hidden value is not kept: a second show reads it again
            fireEvent.click(within(rowOf('sec-web')).getByRole('button', { name: 'Show value' }))
            await waitFor(() => expect(read).toHaveLength(2))
        })

        test('says when the value did not load', async () => {
            spyOn(secretsAPI, 'getSecretValue').mockImplementation(async () => {
                throw new Error('Too many secret reads. Try again in 15 minutes.')
            })
            wrap()
            await screen.findAllByText('$DATABASE_URL')
            fireEvent.click(within(rowOf('sec-db')).getByRole('button', { name: 'Show value' }))
            expect(
                await screen.findByText('Too many secret reads. Try again in 15 minutes.')
            ).not.toBeNull()
            expect(screen.queryByText(/value-of/)).toBeNull()
        })

        test('copies the value and says so', async () => {
            const copied: string[] = []
            Object.defineProperty(navigator, 'clipboard', {
                configurable: true,
                value: { writeText: async (text: string) => void copied.push(text) },
            })
            wrap()
            await screen.findAllByText('$DATABASE_URL')
            fireEvent.click(within(rowOf('sec-db')).getByRole('button', { name: 'Copy value' }))

            await waitFor(() => expect(copied).toEqual(['value-of-DATABASE_URL-all']))
            expect(read).toEqual([['DATABASE_URL', null]])
            expect(within(rowOf('sec-db')).getByRole('button', { name: 'Copied' })).not.toBeNull()
            // the phone row says it in place of the date
            expect(within(rowOf('sec-db')).getAllByText('Copied').length).toBeGreaterThan(0)
            // a copy does not show the value on the screen
            expect(screen.queryByText('value-of-DATABASE_URL-all')).toBeNull()
        })

        test('says when the browser did not let the value be copied', async () => {
            Object.defineProperty(navigator, 'clipboard', {
                configurable: true,
                value: {
                    writeText: async () => {
                        throw new Error('The value was not copied.')
                    },
                },
            })
            wrap()
            await screen.findAllByText('$DATABASE_URL')
            fireEvent.click(within(rowOf('sec-db')).getByRole('button', { name: 'Copy value' }))
            expect(await screen.findByText('The value was not copied.')).not.toBeNull()
        })

        test('phones: the ⋯ menu shows, copies and deletes', async () => {
            const copied: string[] = []
            Object.defineProperty(navigator, 'clipboard', {
                configurable: true,
                value: { writeText: async (text: string) => void copied.push(text) },
            })
            wrap()
            await screen.findAllByText('$DATABASE_URL')
            const menu = () =>
                within(rowOf('sec-db')).getByRole('button', { name: 'Options for DATABASE_URL' })

            fireEvent.click(menu())
            expect(menuItem('sec-db', 'Show value')).not.toBeNull()
            expect(menuItem('sec-db', 'Copy value')).not.toBeNull()
            expect(menuItem('sec-db', 'Delete')).not.toBeNull()
            fireEvent.click(menuItem('sec-db', 'Show value'))
            expect(
                (await screen.findAllByText('value-of-DATABASE_URL-all')).length
            ).toBeGreaterThan(0)

            fireEvent.click(menu())
            expect(menuItem('sec-db', 'Hide value')).not.toBeNull()
            fireEvent.click(menuItem('sec-db', 'Copy value'))
            await waitFor(() => expect(copied).toEqual(['value-of-DATABASE_URL-all']))
            // the value was on the screen: the copy used it and did not read it again
            expect(read).toHaveLength(1)

            fireEvent.click(menu())
            fireEvent.click(menuItem('sec-db', 'Delete'))
            expect(await deleteDialog()).not.toBeNull()
        })
    })

    describe('delete', () => {
        test('asks first, and cancel deletes nothing', async () => {
            wrap()
            await screen.findAllByText('$DATABASE_URL')
            fireEvent.click(within(rowOf('sec-db')).getByRole('button', { name: 'Delete secret' }))
            const dialog = await deleteDialog()
            expect(
                within(dialog).getByText('New sessions do not get $DATABASE_URL.')
            ).not.toBeNull()
            fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }))
            await waitFor(() =>
                expect(screen.queryByRole('heading', { name: 'Delete secret' })).toBeNull()
            )
            expect(deleted).toEqual([])
        })

        test('deletes the row of the repository when a name is there two times', async () => {
            wrap()
            await screen.findAllByText('Acme/Web')
            fireEvent.click(within(rowOf('sec-web')).getByRole('button', { name: 'Delete secret' }))
            const dialog = await deleteDialog()
            expect(
                within(dialog).getByText('New sessions do not get $API_URL in Acme/Web.')
            ).not.toBeNull()
            fireEvent.click(within(dialog).getByRole('button', { name: 'Delete secret' }))

            await waitFor(() => expect(deleted).toEqual([['API_URL', 'acme/web']]))
            await waitFor(() => expect(() => rowOf('sec-web')).toThrow())
            // the row for all repositories stays in the list
            expect(() => rowOf('sec-all')).not.toThrow()
        })

        test('keeps the row and shows the error when the delete fails', async () => {
            spyOn(secretsAPI, 'deleteSecret').mockImplementation(async () => {
                throw new Error('Secret not found')
            })
            wrap()
            await screen.findAllByText('$DATABASE_URL')
            fireEvent.click(within(rowOf('sec-db')).getByRole('button', { name: 'Delete secret' }))
            const dialog = await deleteDialog()
            fireEvent.click(within(dialog).getByRole('button', { name: 'Delete secret' }))
            expect(await within(dialog).findByText('Secret not found')).not.toBeNull()
            expect(() => rowOf('sec-db')).not.toThrow()
        })

        test('a deleted row that was shown leaves no value behind', async () => {
            wrap()
            await screen.findAllByText('$DATABASE_URL')
            fireEvent.click(within(rowOf('sec-db')).getByRole('button', { name: 'Show value' }))
            await screen.findAllByText('value-of-DATABASE_URL-all')
            fireEvent.click(within(rowOf('sec-db')).getByRole('button', { name: 'Delete secret' }))
            const dialog = await deleteDialog()
            fireEvent.click(within(dialog).getByRole('button', { name: 'Delete secret' }))
            await waitFor(() => expect(screen.queryByText('value-of-DATABASE_URL-all')).toBeNull())
        })
    })
})

// the prompt box reads the same list for its @secrets: menu
describe('the @secrets: menu of the prompt box', () => {
    let queryClient: QueryClient

    beforeEach(() => {
        cleanup()
        queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    })

    afterEach(() => {
        cleanup()
        mock.restore()
    })

    // a name can exist for all repositories and for one repository: the menu lists it once
    test('the @secrets: menu shows a name once when two secrets have it', async () => {
        const at = new Date().toISOString()
        spyOn(secretsAPI, 'getSecrets').mockImplementation(async () => ({
            secrets: [
                {
                    id: 'a',
                    name: 'API_KEY',
                    note: null,
                    repoFullName: null,
                    createdAt: at,
                    updatedAt: at,
                },
                {
                    id: 'b',
                    name: 'API_KEY',
                    note: null,
                    repoFullName: 'acme/web',
                    createdAt: at,
                    updatedAt: at,
                },
                {
                    id: 'c',
                    name: 'DB_URL',
                    note: null,
                    repoFullName: null,
                    createdAt: at,
                    updatedAt: at,
                },
            ],
        }))

        render(
            <QueryClientProvider client={queryClient}>
                <MemoryRouter>
                    <ChatPromptInput
                        value="@secrets:"
                        onChange={() => {}}
                        onSubmit={() => {}}
                        isAuthenticated={true}
                    />
                </MemoryRouter>
            </QueryClientProvider>
        )

        expect(await screen.findByText('DB_URL')).not.toBeNull()
        expect(screen.getAllByText('API_KEY')).toHaveLength(1)
    })

    test('ChatPromptInput supports @secrets: mention dropdown and secret selection', async () => {
        spyOn(secretsAPI, 'getSecrets').mockImplementation(async () => ({
            secrets: [
                {
                    id: 'sec-1',
                    name: 'GITHUB_TOKEN',
                    note: 'Github Personal Access Token',
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                },
            ],
        }))

        let promptVal = '@secrets:'
        const setPromptVal = (v: string) => {
            promptVal = v
        }

        render(
            <QueryClientProvider client={queryClient}>
                <MemoryRouter>
                    <ChatPromptInput
                        value={promptVal}
                        onChange={setPromptVal}
                        onSubmit={() => {}}
                        isAuthenticated={true}
                    />
                </MemoryRouter>
            </QueryClientProvider>
        )

        // Dropdown appears with GITHUB_TOKEN
        expect(await screen.findByText('GITHUB_TOKEN')).not.toBeNull()
        expect(screen.getByText('Github Personal Access Token')).not.toBeNull()

        // Click secret
        fireEvent.click(screen.getByText('GITHUB_TOKEN'))
        expect(promptVal).toBe('@secret:GITHUB_TOKEN ')
    })
})

describe('secrets api client: the repository of a named secret', () => {
    test('sends the repository as ?repo= and nothing for all repositories', async () => {
        // the real client, not the stand-ins of the tests above
        mock.restore()
        const urls: string[] = []
        const bodies: unknown[] = []
        const savedFetch = globalThis.fetch
        globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
            const url = String(input instanceof Request ? input.url : input)
            urls.push(`${init?.method ?? 'GET'} ${url}`)
            if (init?.body) bodies.push(JSON.parse(String(init.body)))
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
            await secretsAPI.getSecretValue('ODD NAME/x')
            await secretsAPI.getSecrets()
            await secretsAPI.createSecret({ name: 'A', value: 'v', repoFullName: null })
            await secretsAPI.bulkCreateSecrets({ secrets: [{ name: 'B', value: 'w' }] })
        } finally {
            globalThis.fetch = savedFetch
        }
        const paths = urls.map((url) => url.replace(/^(\w+) .*\/secrets/, '$1 /secrets'))
        expect(paths).toEqual([
            'DELETE /secrets/API_URL?repo=acme%2Fweb',
            'DELETE /secrets/API_URL',
            'GET /secrets/API_URL/value?repo=acme%2Fweb',
            'GET /secrets/API_URL/value',
            // a name is one part of the path, whatever it holds
            'GET /secrets/ODD%20NAME%2Fx/value',
            'GET /secrets',
            'POST /secrets',
            'POST /secrets/bulk',
        ])
        expect(bodies).toEqual([
            { name: 'A', value: 'v', repoFullName: null },
            { secrets: [{ name: 'B', value: 'w' }] },
        ])
    })
})
