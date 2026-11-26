export type TotpContext = {
    userId: string
    sessionId: string
}

export type GetTotpStatus = TotpContext

export type StartTotpSetup = {
    userId: string
}

export type CheckTotpCode = TotpContext & {
    code: string
}

export type TotpStatus = {
    enabled: boolean
    lockedUntil: Date | null
    verifiedAt: Date | null
    verifiedUntil: Date | null
}

export type ResetAuthenticator = {
    userId: string
}
