export type SecretSummary = {
    id: string
    name: string
    createdAt: Date
    updatedAt: Date
}

export type EncryptData = {
    text: string
}

export type DecryptData = {
    encryptedText: string
}

export type CreateSecret = {
    userId: string
    name: string
    value: string
}

export type GetSecrets = {
    userId: string
}

export type DeleteSecret = {
    userId: string
    name: string
}
