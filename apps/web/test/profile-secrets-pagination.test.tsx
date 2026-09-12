import { GlobalRegistrator } from '@happy-dom/global-registrator'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { describe, test, expect, spyOn, beforeEach, afterEach } from 'bun:test'
import React from 'react'
import { MemoryRouter } from 'react-router-dom'

if (!globalThis.document) {
    GlobalRegistrator.register()
}

const { render, screen, fireEvent, cleanup } = await import('@testing-library/react')

import { ChatPromptInput } from '../src/features/chat/components/ChatPromptInput'
import { secretsAPI } from '../src/features/profile/api/secrets'
import { ProfileSecretsSettings } from '../src/features/profile/components/ProfileSecretsSettings'

describe('ProfileSecretsSettings Pagination & Visibility', () => {
    let queryClient: QueryClient

    beforeEach(() => {
        queryClient = new QueryClient({
            defaultOptions: {
                queries: {
                    retry: false,
                },
            },
        })
    })

    afterEach(() => {
        cleanup()
    })

    test('renders only 10 secrets per page by default and navigates across pages', async () => {
        const mockSecrets = Array.from({ length: 15 }, (_, i) => ({
            id: `sec-${i + 1}`,
            name: `API_KEY_${i + 1}`,
            note: `Secret note ${i + 1}`,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        }))

        spyOn(secretsAPI, 'getSecrets').mockImplementation(async () => ({
            secrets: mockSecrets,
        }))

        render(
            <QueryClientProvider client={queryClient}>
                <MemoryRouter>
                    <ProfileSecretsSettings />
                </MemoryRouter>
            </QueryClientProvider>
        )

        // Wait for first 10 secrets to be visible (both mobile and desktop render the secret name)
        expect((await screen.findAllByText('$API_KEY_1')).length).toBeGreaterThan(0)
        expect(screen.getAllByText('$API_KEY_10').length).toBeGreaterThan(0)
        // 11th should not be visible on page 1
        expect(screen.queryByText('$API_KEY_11')).toBeNull()

        // Page info
        expect(screen.getByText('1 of 2')).not.toBeNull()

        // Click next page button
        const nextButton = screen.getByLabelText('Next page')
        fireEvent.click(nextButton)

        // Page 2 should now be visible
        expect((await screen.findAllByText('$API_KEY_11')).length).toBeGreaterThan(0)
        expect(screen.getAllByText('$API_KEY_15').length).toBeGreaterThan(0)
        expect(screen.queryByText('$API_KEY_1')).toBeNull()
        expect(screen.getByText('2 of 2')).not.toBeNull()
    })

    test('Add secret modal has visibility toggle for secret value', async () => {
        spyOn(secretsAPI, 'getSecrets').mockImplementation(async () => ({
            secrets: [],
        }))

        render(
            <QueryClientProvider client={queryClient}>
                <MemoryRouter>
                    <ProfileSecretsSettings />
                </MemoryRouter>
            </QueryClientProvider>
        )

        // Open Add Secret modal
        const addSecretBtn = await screen.findByText('Add secret')
        fireEvent.click(addSecretBtn)

        const valueInput = screen.getByPlaceholderText(
            'Enter key or token value...'
        ) as HTMLInputElement
        expect(valueInput.type).toBe('password')

        // Click eye toggle button
        const eyeButton = screen.getByLabelText('Show secret value')
        fireEvent.click(eyeButton)

        expect(valueInput.type).toBe('text')

        // Click again to hide
        const eyeOffButton = screen.getByLabelText('Hide secret value')
        fireEvent.click(eyeOffButton)

        expect(valueInput.type).toBe('password')
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
