export type UploadAttachment = {
    userId: string
    sessionId: string
    /** the file name as the browser sent it; it is made safe before it is stored */
    name: string
    content: Buffer
}

export type RemoveAttachment = {
    userId: string
    sessionId: string
    attachmentId: string
}

export type AttachToPrompt = {
    /** empty for a socket that is not signed in: nothing is attached */
    userId?: string
    sessionId: string
    /** the ids the client sent with the prompt */
    attachmentIds: string[]
    /** the saved user message of this prompt; null when it could not be saved */
    sequence: number | null
}

/** one file of a prompt, as the worker reads it from the `run_agent` job */
export type PromptAttachment = {
    id: string
    name: string
    /** the place of the bytes in the file store */
    key: string
    contentType: string
    sizeBytes: number
}

export type GetSessionAttachments = {
    sessionId: string
}

export type DeleteSessionFiles = {
    sessionIds: string[]
}

export type PurgeExpiredSessionFiles = {
    /** sessions last changed before this date are about to be deleted */
    before: Date
}

export type ResolveAttachmentType = {
    /** the safe name */
    name: string
    content: Uint8Array
}
