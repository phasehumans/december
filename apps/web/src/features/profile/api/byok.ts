import { apiRequest } from '@/shared/api/client'

export type ByokProvider = {
    id: string
    name: string
    keyUrl: string
    keyHint?: string
}

/** a saved key. The key itself never comes back from the server, only its last 4 characters. */
export type ByokCredential = {
    provider: string
    keyHint: string
    models: string[]
    defaultModel: string
    verifiedAt: string
    lastUsedAt: string | null
}

export type ByokList = {
    providers: ByokProvider[]
    credentials: ByokCredential[]
}

const list = () => apiRequest<ByokList>('/byok')

const save = (provider: string, apiKey: string) =>
    apiRequest<{ credential: ByokCredential }>(`/byok/${encodeURIComponent(provider)}`, {
        method: 'PUT',
        body: JSON.stringify({ apiKey }),
    })

const refresh = (provider: string) =>
    apiRequest<{ credential: ByokCredential }>(`/byok/${encodeURIComponent(provider)}/refresh`, {
        method: 'POST',
    })

const remove = (provider: string) =>
    apiRequest<null>(`/byok/${encodeURIComponent(provider)}`, { method: 'DELETE' })

export const byokAPI = {
    list,
    save,
    refresh,
    remove,
}
