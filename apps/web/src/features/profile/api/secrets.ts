import { apiRequest } from '@/shared/api/client'

export type SecretSummary = {
    id: string
    name: string
    note: string | null
    /** `owner/name`, or null for a secret used in all repositories */
    repoFullName?: string | null
    createdAt: string
    updatedAt: string
}

export type SecretWithDecryptedValue = {
    id: string
    name: string
    value: string
    note: string | null
    /** `owner/name`, or null for a secret used in all repositories */
    repoFullName?: string | null
    createdAt: string
    updatedAt: string
}

export type CreateSecretInput = {
    name: string
    value: string
    note?: string
    /** `owner/name`. null or no field: all repositories */
    repoFullName?: string | null
}

export type BulkCreateSecretItem = {
    name: string
    value: string
    note?: string
    /** `owner/name`. null or no field: all repositories */
    repoFullName?: string | null
}

export type BulkCreateSecretsInput = {
    secrets: BulkCreateSecretItem[]
    /** the repository of every item that names none */
    repoFullName?: string | null
}

/** the list of secrets the prompt box mentions from (`@secrets:` and the + menu) */
export const SECRETS_MENTION_KEY = ['secrets', 'mention'] as const

/**
 * One row for each name. A name can exist for all repositories and for one repository,
 * and a mention names the secret only by its name.
 */
export const uniqueSecretNames = <T extends { name: string }>(secrets: T[]): T[] => {
    const seen = new Set<string>()
    return secrets.filter((secret) => {
        if (seen.has(secret.name)) return false
        seen.add(secret.name)
        return true
    })
}

// the routes that take a name read the "all repositories" row when no repository is sent
const repoQuery = (repoFullName?: string | null) =>
    repoFullName ? `?repo=${encodeURIComponent(repoFullName)}` : ''

const getSecrets = () => {
    return apiRequest<{ secrets: SecretSummary[] }>('/secrets')
}

const getSecretValue = (name: string, repoFullName?: string | null) => {
    return apiRequest<{ secret: SecretWithDecryptedValue }>(
        `/secrets/${encodeURIComponent(name)}/value${repoQuery(repoFullName)}`
    )
}

const createSecret = (data: CreateSecretInput) => {
    return apiRequest<{ secret: SecretSummary }>('/secrets', {
        method: 'POST',
        body: JSON.stringify(data),
    })
}

const bulkCreateSecrets = (data: BulkCreateSecretsInput) => {
    return apiRequest<null>('/secrets/bulk', {
        method: 'POST',
        body: JSON.stringify(data),
    })
}

const deleteSecret = (name: string, repoFullName?: string | null) => {
    return apiRequest<null>(`/secrets/${encodeURIComponent(name)}${repoQuery(repoFullName)}`, {
        method: 'DELETE',
    })
}

export const secretsAPI = {
    getSecrets,
    getSecretValue,
    createSecret,
    bulkCreateSecrets,
    deleteSecret,
}
