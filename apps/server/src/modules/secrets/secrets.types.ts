export type SecretSummary = {
    id: string
    name: string
    note: string | null
    /** `owner/name`, or null for a secret used in all repositories */
    repoFullName: string | null
    createdAt: Date
    updatedAt: Date
}

export type SecretWithDecryptedValue = {
    id: string
    name: string
    value: string
    note: string | null
    repoFullName: string | null
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
    note?: string
    /** `owner/name`. null, '' or no field: all repositories */
    repoFullName?: string | null
}

export type BulkCreateSecretItem = {
    name: string
    value: string
    note?: string
    repoFullName?: string | null
}

export type BulkCreateSecrets = {
    userId: string
    secrets: BulkCreateSecretItem[]
    /** the repository of every item that names none */
    repoFullName?: string | null
}

export type BulkUpsertSecretItem = {
    name: string
    encryptedValue: string
    note?: string
    /** as the database keeps it: lower case, '' for all repositories */
    repoFullName?: string
}

export type GetSecrets = {
    userId: string
}

export type GetSecretValue = {
    userId: string
    name: string
    repoFullName?: string | null
}

export type DeleteSecret = {
    userId: string
    name: string
    repoFullName?: string | null
}

export type DecryptedSecretItem = {
    key: string
    value: string
}

export type GetAllDecryptedSecrets = {
    userId: string
    /** the repository of the session, as `owner/name`. none: only "all repositories" secrets */
    repoFullName?: string | null
    /** used when no repository is given: the repository is read from this session of the user */
    sessionId?: string | null
}

/** the part of a secret row that the merge rule reads */
export type SecretRepoRow = {
    name: string
    repoFullName?: string | null
}

/** the columns of a session that name its repository */
export type SessionRepoRow = {
    githubRepoOwner: string | null
    githubRepoName: string | null
    repoUrl: string | null
    githubRepoUrl: string | null
}
