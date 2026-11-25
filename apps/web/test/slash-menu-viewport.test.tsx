import { GlobalRegistrator } from '@happy-dom/global-registrator'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, describe, expect, test } from 'bun:test'
import React from 'react'

if (!globalThis.document) {
    GlobalRegistrator.register()
}

const { render, screen, fireEvent, cleanup, act } = await import('@testing-library/react')
const { MemoryRouter } = await import('react-router-dom')
const { PromptInput } = await import('../src/features/home/components/PromptInput')

const HomeBox: React.FC = () => {
    const [value, setValue] = React.useState('')
    return (
        <PromptInput
            value={value}
            onChange={setValue}
            onSubmit={() => {}}
            isLoading={false}
            isAuthenticated
            mode="agent"
        />
    )
}

const savedViewport = Object.getOwnPropertyDescriptor(window, 'visualViewport')

afterEach(() => {
    cleanup()
    if (savedViewport) Object.defineProperty(window, 'visualViewport', savedViewport)
})

// #634: the slash menu on a phone stays above the keyboard
describe('slash menu and the phone keyboard', () => {
    test('the menu is as tall as the visible part allows, and follows the keyboard', () => {
        const listeners: Record<string, () => void> = {}
        const viewport = {
            offsetTop: 0,
            height: 400,
            addEventListener: (event: string, listener: () => void) => {
                listeners[event] = listener
            },
            removeEventListener: () => {},
        }
        Object.defineProperty(window, 'visualViewport', { value: viewport, configurable: true })

        const client = new QueryClient({
            defaultOptions: { queries: { retry: false, staleTime: Infinity } },
        })
        client.setQueryData(['byok'], { providers: [], credentials: [] })
        client.setQueryData(['connections', 'prompt-box'], { skills: [], plugins: [], mcps: [] })
        render(
            <QueryClientProvider client={client}>
                <MemoryRouter>
                    <HomeBox />
                </MemoryRouter>
            </QueryClientProvider>
        )
        const box = document.querySelector('textarea') as HTMLTextAreaElement
        fireEvent.change(box, { target: { value: '/' } })
        box.setSelectionRange(1, 1)
        fireEvent.keyUp(box)

        // the test dom puts the box at the top (0): 400 - 48 - 8
        const menu = screen.getByRole('listbox').parentElement as HTMLElement
        expect(menu.style.maxHeight).toBe('344px')

        // the keyboard opens
        viewport.height = 250
        act(() => listeners.resize())
        expect(menu.style.maxHeight).toBe('194px')
    })
})
