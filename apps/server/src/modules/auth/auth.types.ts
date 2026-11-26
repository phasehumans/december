export type TokenPayload = {
    userId: string
    sessionId: string
    iat?: number
    iatMs?: number
    exp?: number
}

export type StartEmailAuth = {
    email: string
}

export type VerifyEmailAuth = {
    email: string
    otp: string
    // the code of an invite link. it counts only when this sign-in makes the account
    referralCode?: string
    userAgent?: string
    ipAddress?: string
}

export type IssueSession = {
    userId: string
    method: 'email' | 'google' | 'github' | 'cli'
    userAgent?: string
    ipAddress?: string
}

export type Google = {
    name: string
    email: string
    sub: string
    referralCode?: string
    userAgent?: string
    ipAddress?: string
}

export type Github = {
    name: string
    email: string
    sub: string
    username?: string
    referralCode?: string
    userAgent?: string
    ipAddress?: string
}

export type EndSession = {
    sessionId: string
    message: string
}

export type IsCurrentToken = {
    payload: TokenPayload
    incomingHash: string
    session: { rotatedAt: Date | null; refreshTokenHash: string }
}

export type RefreshSession = {
    refreshToken?: string
}

export type Signout = {
    userId: string
    sessionId: string
}

export type SignoutAll = {
    userId: string
}

export type RemoveSignedOutPush = {
    userId: string
    // the sign-in that ended. with none, every sign-in of the user
    sessionId?: string
}

export type DeleteAccount = {
    userId: string
}

export type PollDeviceToken = {
    deviceCode: string
    userAgent?: string
    ipAddress?: string
}

export type VerifyUserCode = {
    userCode: string
    userId: string
}

export type DeviceActivationStatus =
    | 'already_activated'
    | 'approved'
    | 'expired'
    | 'pending'
    | 'idle'
    | 'invalid'

export type VerifyUserCodeResult = {
    status: 'approved' | 'already_activated'
}

export type GetDeviceStatus = {
    userId: string
    userCode?: string
}

export type GetDeviceStatusResult = {
    activated: boolean
    status: DeviceActivationStatus
}

export type CachedSessionData = {
    id: string
    userId: string
    isRevoked: boolean
    expiresAt: Date
    rotatedAt?: Date | null
    user: {
        id: string
        isDeleted: boolean
    } | null
}

export type PurgeSessions = Record<string, never>

export type ListSignedInSessions = {
    userId: string
    currentSessionId: string
}

export type RevokeSignedInSession = {
    userId: string
    currentSessionId: string
    sessionId: string
}

export type SignedInSessionKind = 'web' | 'cli'

/** one row of the devices list on the account page (#636) */
export type SignedInSession = {
    id: string
    label: string
    kind: SignedInSessionKind
    lastActiveAt: Date
    createdAt: Date
    isCurrent: boolean
}
