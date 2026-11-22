export type CredentialSummary = {
    provider: string
    keyHint: string
    models: string[]
    defaultModel: string
    verifiedAt: Date
    lastUsedAt: Date | null
}

export type CredentialRow = {
    provider: string
    keyHint: string
    models: unknown
    defaultModel: string
    verifiedAt: Date
    lastUsedAt: Date | null
}

export type CheckKey = {
    provider: string
    apiKey: string
}

export type ListCredentials = {
    userId: string
}

export type SaveCredential = {
    userId: string
    provider: string
    apiKey: string
}

export type RefreshCredential = {
    userId: string
    provider: string
}

export type DeleteCredential = {
    userId: string
    provider: string
}

export type AssertOwnKeyUsable = {
    userId: string
    provider?: string | null
    model?: string | null
}

export type UpsertCredentialData = {
    userId: string
    provider: string
    encryptedKey: string
    keyHint: string
    models: string[]
    defaultModel: string
    verifiedAt: Date
}

export type UpdateVerificationData = {
    userId: string
    provider: string
    models: string[]
    defaultModel: string
    verifiedAt: Date
}
