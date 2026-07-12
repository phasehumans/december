import { useState, useEffect } from 'react'
import type { AuthMode } from '@december/tui'
import { getProviderConfig } from '@december/agent'

export function useAuth({ initialAuth, userEmail, authMode: initialAuthMode }: any) {
    const [isAuthenticated, setIsAuthenticated] = useState(initialAuth)
    const [currentEmail, setCurrentEmail] = useState<string | undefined>(userEmail)
    const [authMode, setAuthMode] = useState<AuthMode>(initialAuthMode || 'none')

    const [logoutItems, setLogoutItems] = useState<{ label: string; value: string }[]>([])
    const [selectedProvider, setSelectedProvider] = useState<string>('')
    const [apiKey, setApiKey] = useState('')

    const FALLBACK_OPENROUTER_MODELS = [
        {
            label: '(free) meta-llama/llama-3-8b-instruct:free',
            value: 'meta-llama/llama-3-8b-instruct:free',
        },
        {
            label: '(free) mistralai/mistral-7b-instruct:free',
            value: 'mistralai/mistral-7b-instruct:free',
        },
        { label: 'anthropic/claude-3-haiku', value: 'anthropic/claude-3-haiku' },
        { label: 'anthropic/claude-3.5-sonnet', value: 'anthropic/claude-3.5-sonnet' },
        { label: 'google/gemini-flash-1.5', value: 'google/gemini-flash-1.5' },
        { label: 'google/gemini-pro-1.5', value: 'google/gemini-pro-1.5' },
        { label: 'meta-llama/llama-3-70b-instruct', value: 'meta-llama/llama-3-70b-instruct' },
        { label: 'openai/gpt-3.5-turbo', value: 'openai/gpt-3.5-turbo' },
        { label: 'openai/gpt-4o', value: 'openai/gpt-4o' },
    ]
    const [openRouterModels, setOpenRouterModels] = useState<
        { label: string; value: string }[] | null
    >(null)

    useEffect(() => {
        if (authMode === 'model_select' && selectedProvider === 'openrouter') {
            fetch('https://openrouter.ai/api/v1/models')
                .then((res) => res.json())
                .then((data) => {
                    const models = data.data.map((m: any) => {
                        const isFree = m.pricing?.prompt === '0' && m.pricing?.completion === '0'
                        return {
                            label: isFree ? `(free) ${m.name}` : m.name,
                            value: m.id,
                        }
                    })
                    models.sort((a: any, b: any) => {
                        if (a.label.startsWith('(free)') && !b.label.startsWith('(free)')) return -1
                        if (!a.label.startsWith('(free)') && b.label.startsWith('(free)')) return 1
                        return a.label.localeCompare(b.label)
                    })
                    setOpenRouterModels(models)
                })
                .catch(() => {
                    setOpenRouterModels(FALLBACK_OPENROUTER_MODELS)
                })
        }
    }, [authMode, selectedProvider])

    return {
        isAuthenticated,
        setIsAuthenticated,
        currentEmail,
        setCurrentEmail,
        authMode,
        setAuthMode,
        logoutItems,
        setLogoutItems,
        selectedProvider,
        setSelectedProvider,
        apiKey,
        setApiKey,
        openRouterModels,
        setOpenRouterModels,
    }
}
