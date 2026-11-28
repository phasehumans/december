import { GlobalRegistrator } from '@happy-dom/global-registrator'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, beforeEach, describe, expect, it, spyOn } from 'bun:test'
import React from 'react'
import { MemoryRouter } from 'react-router-dom'

if (!globalThis.document) {
    GlobalRegistrator.register()
}

const { render, fireEvent, screen, cleanup, waitFor, act } = await import('@testing-library/react')
const { ProfileModelKeysSettings } =
    await import('../src/features/profile/components/ProfileModelKeysSettings')
const { byokAPI } = await import('../src/features/profile/api/byok')
const { SettingsTopBarContext } = await import('../src/features/profile/lib/settingsTopBar')

import type { ByokCredential, ByokList } from '../src/features/profile/api/byok'
import type { SettingsTopBarAction } from '../src/features/profile/lib/settingsTopBar'

const PROVIDERS = [
    { id: 'groq', name: 'Groq', keyUrl: 'https://console.groq.com/keys' },
    { id: 'openai', name: 'OpenAI', keyUrl: 'https://platform.openai.com/api-keys' },
    {
        id: 'watsonx',
        name: 'watsonx.ai',
        keyUrl: 'https://cloud.ibm.com/iam/apikeys',
        keyHint: 'Enter it as API_KEY:PROJECT_ID',
    },
]

const GROQ: ByokCredential = {
    provider: 'groq',
    keyHint: 'abcd',
    models: ['llama-3.3-70b-versatile', 'qwen-qwq-32b'],
    defaultModel: 'llama-3.3-70b-versatile',
    verifiedAt: '2026-11-22T12:00:00.000Z',
    lastUsedAt: null,
}
const OPENAI: ByokCredential = {
    provider: 'openai',
    keyHint: 'wxyz',
    models: ['gpt-5'],
    defaultModel: 'gpt-5',
    verifiedAt: '2026-11-20T12:00:00.000Z',
    lastUsedAt: '2026-11-25T12:00:00.000Z',
}

// under happy-dom, input events inside a react portal (the Modal) never reach react,
// while clicks do. call the onChange handler react attached to the element instead.
const typeInto = (input: HTMLInputElement, value: string) => {
    const propsKey = Object.keys(input).find((key) => key.startsWith('__reactProps'))
    if (!propsKey) throw new Error('not a react-managed input')
    input.value = value
    ;(input as any)[propsKey].onChange({ target: input, currentTarget: input })
}

// a promise a test settles by hand, to look at the page while a request runs
const deferred = <T,>() => {
    let resolve!: (value: T) => void
    let reject!: (error: unknown) => void
    const promise = new Promise<T>((res, rej) => {
        resolve = res
        reject = rej
    })
    return { promise, resolve, reject }
}

const setPhone = (isPhone: boolean) => {
    window.matchMedia = ((query: string) => ({
        matches: isPhone && query.includes('max-width'),
        media: query,
        onchange: null,
        addEventListener: () => {},
        removeEventListener: () => {},
        addListener: () => {},
        removeListener: () => {},
        dispatchEvent: () => false,
    })) as any
}

let topBarAction: SettingsTopBarAction | null = null

const renderPage = () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const result = render(
        <MemoryRouter>
            <SettingsTopBarContext.Provider value={(action) => (topBarAction = action)}>
                <QueryClientProvider client={queryClient}>
                    <ProfileModelKeysSettings />
                </QueryClientProvider>
            </SettingsTopBarContext.Provider>
        </MemoryRouter>
    )
    return { ...result, queryClient }
}

const spies: Array<{ mockRestore: () => void }> = []
let saved: ByokCredential[]
const originalMatchMedia = window.matchMedia

const mockList = (impl?: () => Promise<ByokList>) => {
    const spy = spyOn(byokAPI, 'list').mockImplementation(
        impl ?? (async () => ({ providers: PROVIDERS, credentials: [...saved] }))
    )
    spies.push(spy)
    return spy
}

const dialogForm = () => {
    const input = screen.getByLabelText('API key') as HTMLInputElement
    const form = input.closest('form') as HTMLFormElement
    return { input, form }
}

// types a key and waits until the page has it, so a submit right after sends it
const typeKey = async (value: string) => {
    const { input, form } = dialogForm()
    typeInto(input, value)
    await waitFor(() => expect(input.value).toBe(value))
    const submit = form.querySelector('button[type="submit"]') as HTMLButtonElement
    if (value.trim()) await waitFor(() => expect(submit.disabled).toBe(false))
    return { input, form }
}

const openAddFor = async (providerName: RegExp) => {
    fireEvent.click(await screen.findByRole('button', { name: 'Add key' }))
    fireEvent.click(await screen.findByRole('button', { name: providerName }))
    return dialogForm()
}

beforeEach(() => {
    saved = [GROQ]
    topBarAction = null
    setPhone(false)
})

afterEach(() => {
    cleanup()
    while (spies.length) spies.pop()!.mockRestore()
    window.matchMedia = originalMatchMedia
})

describe('API keys page: the list', () => {
    it('has the page heading, one section and no model source section', async () => {
        mockList()
        renderPage()
        expect(screen.getByText('API keys')).toBeDefined()
        expect(screen.getByText('Saved keys')).toBeDefined()
        await screen.findByTestId('byok-row-groq')
        expect(screen.queryByText('Model source')).toBeNull()
        expect(screen.queryByRole('radio')).toBeNull()
    })

    it('shows each saved key by its last 4 characters only, with its models and dates', async () => {
        saved = [GROQ, OPENAI]
        mockList()
        renderPage()
        const groq = await screen.findByTestId('byok-row-groq')
        expect(groq.textContent).toContain('Groq')
        expect(groq.textContent).toContain('••••abcd')
        expect(groq.textContent).toContain('2 models')
        expect(groq.textContent).toContain('checked')
        expect(groq.textContent).not.toContain('last used')

        const openai = screen.getByTestId('byok-row-openai')
        expect(openai.textContent).toContain('••••wxyz')
        expect(openai.textContent).toContain('1 model')
        expect(openai.textContent).not.toContain('1 models')
        expect(openai.textContent).toContain('last used')
    })

    it('shows dots alone for a key with no hint', async () => {
        saved = [{ ...GROQ, keyHint: '' }]
        mockList()
        renderPage()
        const row = await screen.findByTestId('byok-row-groq')
        expect(row.textContent).toContain('•••• · 2 models')
    })

    it('shows the provider id when the provider list does not have it', async () => {
        saved = [{ ...GROQ, provider: 'mystery' }]
        mockList()
        renderPage()
        const row = await screen.findByTestId('byok-row-mystery')
        expect(row.textContent).toContain('mystery')
    })

    it('shows a loading state while the list loads', async () => {
        const pending = deferred<ByokList>()
        mockList(() => pending.promise)
        renderPage()
        expect(screen.getByLabelText('Loading keys')).toBeDefined()
        await act(async () => pending.resolve({ providers: PROVIDERS, credentials: [] }))
        expect(await screen.findByText('No keys yet')).toBeDefined()
        expect(screen.queryByLabelText('Loading keys')).toBeNull()
    })

    it('shows the empty state with no keys', async () => {
        saved = []
        mockList()
        renderPage()
        expect(await screen.findByText('No keys yet')).toBeDefined()
    })

    it('shows the error when the list does not load', async () => {
        mockList(async () => {
            throw new Error('December could not load your keys.')
        })
        renderPage()
        const alert = await screen.findByRole('alert')
        expect(alert.textContent).toContain('December could not load your keys.')
        expect(screen.queryByText('No keys yet')).toBeNull()
    })
})

describe('API keys page: add a key', () => {
    it('opens the provider list from the Add key button, with search', async () => {
        mockList()
        renderPage()
        fireEvent.click(await screen.findByRole('button', { name: 'Add key' }))
        expect(await screen.findByRole('button', { name: /^OpenAI$/ })).toBeDefined()
        // a saved provider says so; picking it replaces the key
        expect(screen.getByRole('button', { name: /^Groq\s*Saved$/ })).toBeDefined()

        typeInto(screen.getByLabelText('Search providers') as HTMLInputElement, 'open')
        await waitFor(() =>
            expect(screen.queryByRole('button', { name: /^Groq\s*Saved$/ })).toBeNull()
        )
        expect(screen.getByRole('button', { name: /^OpenAI$/ })).toBeDefined()

        typeInto(screen.getByLabelText('Search providers') as HTMLInputElement, 'nothing-like')
        expect(await screen.findByText('No provider matches')).toBeDefined()
    })

    it('the phone top bar + opens the same dialog', async () => {
        mockList()
        renderPage()
        await screen.findByTestId('byok-row-groq')
        expect(topBarAction?.label).toBe('Add key')
        act(() => topBarAction!.onClick())
        expect(await screen.findByLabelText('Search providers')).toBeDefined()
    })

    it('shows the key page link and checks, saves and closes on success', async () => {
        saved = []
        mockList()
        const saveSpy = spyOn(byokAPI, 'save').mockImplementation(async (provider) => {
            const credential = { ...OPENAI, provider, lastUsedAt: null }
            saved = [credential]
            return { credential }
        })
        spies.push(saveSpy)
        renderPage()
        const { input, form } = await openAddFor(/^OpenAI$/)
        expect(screen.getByText('Add OpenAI key')).toBeDefined()
        const link = screen.getByRole('link', { name: /Get a OpenAI key/ })
        expect(link.getAttribute('href')).toBe('https://platform.openai.com/api-keys')
        expect(link.getAttribute('rel')).toContain('noopener')

        const submit = form.querySelector('button[type="submit"]') as HTMLButtonElement
        expect(submit.disabled).toBe(true)
        typeInto(input, '  sk-live-secret-wxyz  ')
        await waitFor(() => expect(submit.disabled).toBe(false))
        fireEvent.submit(form)

        await waitFor(() => expect(saveSpy).toHaveBeenCalledWith('openai', 'sk-live-secret-wxyz'))
        await waitFor(() => expect(screen.queryByLabelText('API key')).toBeNull())
        const row = await screen.findByTestId('byok-row-openai')
        expect(row.textContent).toContain('••••wxyz')
        expect(document.body.textContent).not.toContain('sk-live-secret-wxyz')
    })

    it('keeps the dialog open with the provider error when the check fails', async () => {
        saved = []
        mockList()
        const saveSpy = spyOn(byokAPI, 'save').mockImplementation(async () => {
            throw new Error('Groq rejected this key. Check that you copied the whole key.')
        })
        spies.push(saveSpy)
        renderPage()
        await openAddFor(/^Groq$/)
        const { form } = await typeKey('gsk_bad_key')
        fireEvent.submit(form)

        const alert = await screen.findByRole('alert')
        expect(alert.textContent).toContain('Groq rejected this key')
        expect(screen.getByLabelText('API key')).toBeDefined()
        expect(screen.queryByTestId('byok-row-groq')).toBeNull()
    })

    it('sends the key once when the form is submitted twice', async () => {
        saved = []
        mockList()
        const pending = deferred<{ credential: ByokCredential }>()
        const saveSpy = spyOn(byokAPI, 'save').mockImplementation(() => pending.promise)
        spies.push(saveSpy)
        renderPage()
        await openAddFor(/^Groq$/)
        const { form } = await typeKey('gsk_live_key_1234')
        fireEvent.submit(form)
        await waitFor(() => expect(saveSpy).toHaveBeenCalledTimes(1))
        fireEvent.submit(form)
        fireEvent.submit(form)
        // the key field and Change provider are locked while the check runs
        await waitFor(() => expect((screen.getByLabelText('API key') as any).disabled).toBe(true))
        expect(
            (screen.getByRole('button', { name: 'Change provider' }) as HTMLButtonElement).disabled
        ).toBe(true)
        expect(saveSpy).toHaveBeenCalledTimes(1)
        saved = [GROQ]
        await act(async () => pending.resolve({ credential: GROQ }))
        await waitFor(() => expect(screen.queryByLabelText('API key')).toBeNull())
    })

    it('does not send an empty or blank key', async () => {
        saved = []
        mockList()
        const saveSpy = spyOn(byokAPI, 'save').mockImplementation(async () => ({
            credential: GROQ,
        }))
        spies.push(saveSpy)
        renderPage()
        await openAddFor(/^Groq$/)
        const { form } = await typeKey('    ')
        fireEvent.submit(form)
        await new Promise((r) => setTimeout(r, 20))
        expect(saveSpy).not.toHaveBeenCalled()
    })

    it('Change provider goes back to the list and clears the key', async () => {
        saved = []
        mockList()
        renderPage()
        const { input } = await openAddFor(/^Groq$/)
        typeInto(input, 'gsk_typed')
        fireEvent.click(screen.getByRole('button', { name: 'Change provider' }))
        expect(await screen.findByLabelText('Search providers')).toBeDefined()
        fireEvent.click(screen.getByRole('button', { name: /^OpenAI$/ }))
        expect((screen.getByLabelText('API key') as HTMLInputElement).value).toBe('')
    })

    it('says Replace for a provider that has a key', async () => {
        mockList()
        renderPage()
        await screen.findByTestId('byok-row-groq')
        const { form } = await openAddFor(/^Groq\s*Saved$/)
        expect(screen.getByText('Replace Groq key')).toBeDefined()
        expect(form.querySelector('button[type="submit"]')!.textContent).toBe('Replace key')
    })

    it('explains the watsonx key format in the dialog line', async () => {
        saved = []
        mockList()
        renderPage()
        await openAddFor(/watsonx.ai/)
        expect(screen.getByText('Enter it as API_KEY:PROJECT_ID')).toBeDefined()
        expect(
            screen.queryByText('December checks the key with the provider before it saves it.')
        ).toBeNull()
    })

    it('hides the key until Show key, and limits its length', async () => {
        saved = []
        mockList()
        renderPage()
        const { input } = await openAddFor(/^Groq$/)
        expect(input.type).toBe('password')
        expect(input.getAttribute('autocomplete')).toBe('off')
        expect(input.maxLength).toBe(4096)
        fireEvent.click(screen.getByRole('button', { name: 'Show key' }))
        expect((screen.getByLabelText('API key') as HTMLInputElement).type).toBe('text')
        fireEvent.click(screen.getByRole('button', { name: 'Hide key' }))
        expect((screen.getByLabelText('API key') as HTMLInputElement).type).toBe('password')
    })

    it('Cancel closes the dialog and a new open starts empty', async () => {
        saved = []
        mockList()
        renderPage()
        const { input } = await openAddFor(/^Groq$/)
        typeInto(input, 'gsk_typed')
        fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
        await waitFor(() => expect(screen.queryByLabelText('API key')).toBeNull())
        // the header button (the empty state has one too)
        fireEvent.click(screen.getAllByRole('button', { name: 'Add key' })[0]!)
        expect(await screen.findByLabelText('Search providers')).toBeDefined()
    })

    it('with no keys, the empty state shows the key drawing and its Add key opens the dialog', async () => {
        saved = []
        mockList()
        renderPage()
        const title = await screen.findByRole('heading', { name: 'No keys yet' })
        const box = title.parentElement!
        expect(box.querySelector('svg')).not.toBeNull()
        const buttons = screen.getAllByRole('button', { name: 'Add key' })
        expect(buttons.length).toBe(2)
        fireEvent.click(buttons[1]!)
        expect(await screen.findByLabelText('Search providers')).toBeDefined()
    })
})

describe('API keys page: check again', () => {
    it('checks the key and shows the new model count', async () => {
        mockList()
        const pending = deferred<{ credential: ByokCredential }>()
        const refreshSpy = spyOn(byokAPI, 'refresh').mockImplementation(() => pending.promise)
        spies.push(refreshSpy)
        renderPage()
        await screen.findByTestId('byok-row-groq')
        fireEvent.click(screen.getByRole('button', { name: 'Check Groq key again' }))

        await waitFor(() => expect(refreshSpy).toHaveBeenCalledWith('groq'))
        await waitFor(() =>
            expect(screen.getByTestId('byok-row-groq').textContent).toContain('Checking...')
        )
        const checkButton = screen.getByRole('button', {
            name: 'Check Groq key again',
        }) as HTMLButtonElement
        expect(checkButton.disabled).toBe(true)
        // a second click while it runs sends nothing
        fireEvent.click(checkButton)
        expect(refreshSpy).toHaveBeenCalledTimes(1)
        expect(
            (screen.getByRole('button', { name: 'Remove Groq key' }) as HTMLButtonElement).disabled
        ).toBe(true)

        const refreshed = { ...GROQ, models: ['a', 'b', 'c'] }
        saved = [refreshed]
        await act(async () => pending.resolve({ credential: refreshed }))
        await waitFor(() =>
            expect(screen.getByTestId('byok-row-groq').textContent).toContain('3 models')
        )
    })

    it('shows the error of a failed check above the list', async () => {
        mockList()
        spies.push(
            spyOn(byokAPI, 'refresh').mockImplementation(async () => {
                throw new Error('Groq says this account has no credits.')
            })
        )
        renderPage()
        await screen.findByTestId('byok-row-groq')
        fireEvent.click(screen.getByRole('button', { name: 'Check Groq key again' }))
        expect(await screen.findByText('Groq says this account has no credits.')).toBeDefined()
        expect(
            (screen.getByRole('button', { name: 'Check Groq key again' }) as HTMLButtonElement)
                .disabled
        ).toBe(false)
    })

    it('loads the list again after a check fails, so a removed key goes away', async () => {
        const listSpy = mockList()
        spies.push(
            spyOn(byokAPI, 'refresh').mockImplementation(async () => {
                saved = []
                throw new Error('no Groq key saved')
            })
        )
        renderPage()
        await screen.findByTestId('byok-row-groq')
        const callsBefore = listSpy.mock.calls.length
        fireEvent.click(screen.getByRole('button', { name: 'Check Groq key again' }))
        await waitFor(() => expect(listSpy.mock.calls.length).toBeGreaterThan(callsBefore))
        await waitFor(() => expect(screen.queryByTestId('byok-row-groq')).toBeNull())
    })
})

describe('API keys page: remove a key', () => {
    it('asks first, and Cancel removes nothing', async () => {
        mockList()
        const removeSpy = spyOn(byokAPI, 'remove').mockImplementation(async () => null)
        spies.push(removeSpy)
        renderPage()
        await screen.findByTestId('byok-row-groq')
        fireEvent.click(screen.getByRole('button', { name: 'Remove Groq key' }))
        expect(await screen.findByText('Remove Groq key')).toBeDefined()
        expect(
            screen.getByText('December stops using this key. You can add it again later.')
        ).toBeDefined()
        fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
        await waitFor(() => expect(screen.queryByText('Remove Groq key')).toBeNull())
        expect(removeSpy).not.toHaveBeenCalled()
        expect(screen.getByTestId('byok-row-groq')).toBeDefined()
    })

    it('removes the key after the confirm', async () => {
        mockList()
        const removeSpy = spyOn(byokAPI, 'remove').mockImplementation(async () => {
            saved = []
            return null
        })
        spies.push(removeSpy)
        renderPage()
        await screen.findByTestId('byok-row-groq')
        fireEvent.click(screen.getByRole('button', { name: 'Remove Groq key' }))
        const submit = (await screen.findByRole('button', { name: 'Remove' })) as HTMLButtonElement
        fireEvent.submit(submit.closest('form')!)
        await waitFor(() => expect(removeSpy).toHaveBeenCalledWith('groq'))
        await waitFor(() => expect(screen.queryByTestId('byok-row-groq')).toBeNull())
        expect(screen.queryByText('Remove Groq key')).toBeNull()
        expect(await screen.findByText('No keys yet')).toBeDefined()
    })

    it('keeps the confirm open with the error when the remove fails, and sends once', async () => {
        mockList()
        const pending = deferred<null>()
        const removeSpy = spyOn(byokAPI, 'remove').mockImplementation(() => pending.promise)
        spies.push(removeSpy)
        renderPage()
        await screen.findByTestId('byok-row-groq')
        fireEvent.click(screen.getByRole('button', { name: 'Remove Groq key' }))
        const form = (await screen.findByRole('button', { name: 'Remove' })).closest('form')!
        fireEvent.submit(form)
        fireEvent.submit(form)
        await waitFor(() => expect(removeSpy).toHaveBeenCalledTimes(1))
        await act(async () => pending.reject(new Error('December could not remove this key.')))
        const alert = await screen.findByRole('alert')
        expect(alert.textContent).toContain('December could not remove this key.')
        // the confirm stays open, so the user can try again
        expect(screen.getByText('Remove Groq key')).toBeDefined()
        expect(screen.getByTestId('byok-row-groq')).toBeDefined()
    })
})

describe('API keys page on a phone', () => {
    it('keeps both row actions, and shows the confirm as a sheet with one full-width button', async () => {
        setPhone(true)
        mockList()
        renderPage()
        await screen.findByTestId('byok-row-groq')
        const check = screen.getByRole('button', { name: 'Check Groq key again' })
        const remove = screen.getByRole('button', { name: 'Remove Groq key' })
        // a larger tap area on phones
        expect(check.className).toContain('p-2')
        expect(remove.className).toContain('p-2')
        // the desktop Add key button is hidden on phones; the top bar + stands in
        expect(screen.getByRole('button', { name: 'Add key' }).className).toContain('hidden')
        expect(topBarAction?.label).toBe('Add key')

        fireEvent.click(remove)
        const submit = (await screen.findByRole('button', { name: 'Remove' })) as HTMLButtonElement
        expect(submit.className).toContain('w-full')
        expect(screen.queryByRole('button', { name: 'Cancel' })).toBeNull()
    })

    it('the add key form is a sheet with a full-width submit', async () => {
        setPhone(true)
        saved = []
        mockList()
        renderPage()
        await screen.findByText('No keys yet')
        act(() => topBarAction!.onClick())
        fireEvent.click(await screen.findByRole('button', { name: /^Groq$/ }))
        const { form } = dialogForm()
        const submit = form.querySelector('button[type="submit"]') as HTMLButtonElement
        expect(submit.className).toContain('w-full')
        expect(screen.getByRole('button', { name: 'Change provider' })).toBeDefined()
    })
})
