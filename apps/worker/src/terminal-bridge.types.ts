export interface TerminalResizePayload {
    cols: number
    rows: number
}

export interface TerminalPtySession {
    sessionId: string
    pid: number
    handle?: any
    cols: number
    rows: number
    attachedCount: number
    buffer: string
    isSpawning: boolean
    inputQueue: string[]
}

export interface HandleTerminalInputInput {
    sessionId: string
    data: string
}

export interface HandleTerminalResizeInput {
    sessionId: string
    cols: number
    rows: number
}

export interface HandleTerminalAttachInput {
    sessionId: string
    userId?: string
}

export interface HandleTerminalDetachInput {
    sessionId: string
    userId?: string
}

export interface DestroyPtySessionInput {
    sessionId: string
}

export interface OnSandboxReadyInput {
    sessionId: string
    sandbox: any
}

export interface EnsurePtySessionInput {
    sessionId: string
    cols?: number
    rows?: number
    sandbox?: any
}
