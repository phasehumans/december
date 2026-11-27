import crypto from 'crypto'

import bcrypt from 'bcrypt'

import { redisClient } from '../../config/redis'
import { env } from '../../env'
import { AppError } from '../../shared/appError'
import { auditService } from '../audit/audit.service'
import { billingService } from '../billing/billing.service'
import { notificationService } from '../notification/notification.service'

import { sessionCache } from './auth.cache'
import { authRepository } from './auth.repository'
import {
    sendOTP,
    generateUserCode,
    generateAccessToken,
    verifyTokenIgnoringExpiry,
    hashRefreshToken,
    TOKEN_GRACE_PERIOD_MS,
    describeUserAgent,
} from './auth.utils'

import type {
    StartEmailAuth,
    VerifyEmailAuth,
    IssueSession,
    Google,
    Github,
    RefreshSession,
    Signout,
    SignoutAll,
    RemoveSignedOutPush,
    DeleteAccount,
    PollDeviceToken,
    VerifyUserCode,
    VerifyUserCodeResult,
    GetDeviceStatus,
    GetDeviceStatusResult,
    PurgeSessions,
    ListSignedInSessions,
    RevokeSignedInSession,
    SignedInSession,
    IsCurrentToken,
    EndSession,
    TokenPayload,
} from './auth.types'

const OTP_TTL_MS = 10 * 60 * 1000
const OTP_RESEND_COOLDOWN_MS = 30 * 1000
const OTP_MAX_ATTEMPTS = 5

const clearedOtp = { otpHash: null, otpExpiresAt: null, otpAttempts: 0 }
// an expired code is removed but its try count stays, so it cannot be reset by expiry
const expiredOtp = { otpHash: null, otpExpiresAt: null }

const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000

// a new account gets a welcome item in the inbox (no welcome email: inbox review E1-A)
const sendWelcomeNotice = async (userId: string) => {
    try {
        await notificationService.sendNotificationToUser({
            userId,
            title: 'Welcome to December',
            message: 'Start a session from the home page.',
            type: 'SUCCESS',
        })
    } catch (error) {
        console.error('failed to send welcome notification:', error)
    }
}

// an account older than this with no sign-in left (all signed out) still gets the notice
const NEW_ACCOUNT_MS = 10 * 60 * 1000

/**
 * N3, the "Security alerts" setting: a sign-in from a browser or a CLI that none of the
 * user's other sign-ins use puts "New sign-in: Chrome on Windows" in the inbox (no email).
 * The first sign-in of a new account is not news. Never blocks the sign-in.
 */
const noticeNewDevice = async (data: { userId: string; userAgent?: string }) => {
    const { userId, userAgent } = data
    try {
        const { label } = describeUserAgent(userAgent)
        const [others, user] = await Promise.all([
            authRepository.findSessionUserAgents(userId),
            authRepository.findUserById(userId),
        ])
        if (!user) return false
        const isNewAccount =
            others.length === 0 && Date.now() - user.createdAt.getTime() < NEW_ACCOUNT_MS
        if (isNewAccount) return false
        if (others.some((other) => describeUserAgent(other.userAgent).label === label)) {
            return false
        }
        await notificationService.sendNotificationToUser({
            userId,
            title: `New sign-in: ${label}`,
            message: 'If this was not you, sign out of that device in Settings.',
            type: 'WARNING',
            link: '/settings/account',
        })
        return true
    } catch (error) {
        console.error('[Auth] could not write the new sign-in notice:', error)
        return false
    }
}

// the token is only in the httpOnly cookie for the web: the controller decides what goes in the body
const issueSession = async (data: IssueSession) => {
    const { userId, method, userAgent, ipAddress } = data

    const sessionId = crypto.randomUUID()
    const accessToken = generateAccessToken({ userId, sessionId })
    const expiresAt = new Date(Date.now() + SESSION_TTL_MS)

    // before the new row, so the new sign-in is not compared with itself
    await noticeNewDevice({ userId, userAgent })

    await authRepository.createSession({
        id: sessionId,
        userId,
        refreshTokenHash: hashRefreshToken(accessToken),
        userAgent,
        ipAddress,
        expiresAt,
    })
    await auditService.recordSignIn({ userId, method, ip: ipAddress })

    await sessionCache.set(sessionId, {
        id: sessionId,
        userId,
        isRevoked: false,
        expiresAt,
        rotatedAt: null,
        user: {
            id: userId,
            isDeleted: false,
        },
    })

    return { accessToken }
}

// Email sign-in and sign-up are one flow: send a 6-digit code, create the user if they are new.
const startEmailAuth = async (data: StartEmailAuth) => {
    const { email } = data

    const existingUser = await authRepository.findUserByEmail(email)

    if (existingUser && (existingUser.deletedAt || existingUser.isDeleted)) {
        throw new AppError('account has been deleted', 403)
    }

    if (existingUser?.otpExpiresAt) {
        const sentAt = existingUser.otpExpiresAt.getTime() - OTP_TTL_MS
        if (Date.now() - sentAt < OTP_RESEND_COOLDOWN_MS) {
            throw new AppError('please wait a few seconds before requesting a new code', 429)
        }
    }

    const otp = crypto.randomInt(100000, 1000000).toString()
    const otpFields = {
        otpHash: await bcrypt.hash(otp, env.BCRYPT_SALT_ROUNDS),
        otpExpiresAt: new Date(Date.now() + OTP_TTL_MS),
        otpAttempts: 0,
    }

    if (existingUser) {
        await authRepository.updateUser(existingUser.id, otpFields)
    } else {
        try {
            await authRepository.createUser({
                name: email.split('@')[0]?.replace(/\d+/g, '') || 'User',
                email,
                emailVerified: false,
                ...otpFields,
            })
        } catch (error: any) {
            // two starts for a new email at once: the other one created the user and sent a code
            if (error?.code === 'P2002') {
                throw new AppError('please wait a few seconds before requesting a new code', 429)
            }
            throw error
        }
    }

    await sendOTP(email, otp, existingUser?.emailVerified ? 'login' : 'signup')

    return { message: 'otp sent successfully' }
}

const verifyEmailAuth = async (data: VerifyEmailAuth) => {
    const { email, otp, userAgent, ipAddress, referralCode } = data

    const user = await authRepository.findUserByEmail(email)

    if (user && (user.deletedAt || user.isDeleted)) {
        throw new AppError('account has been deleted', 403)
    }

    if (!user || !user.otpHash || !user.otpExpiresAt) {
        throw new AppError('invalid or expired code, request a new one', 401)
    }

    if (user.otpExpiresAt < new Date()) {
        await authRepository.updateUser(user.id, expiredOtp)
        throw new AppError('code expired, request a new one', 401)
    }

    // Count the guess before comparing. The count is tied to the code read above, so guesses
    // sent in parallel cannot get more than OTP_MAX_ATTEMPTS tries at one code.
    const hasAttemptLeft = await authRepository.claimOtpAttempt(
        user.id,
        user.otpHash,
        OTP_MAX_ATTEMPTS
    )
    if (!hasAttemptLeft) {
        throw new AppError('too many attempts, request a new code', 429)
    }

    const isValid = await bcrypt.compare(otp, user.otpHash)

    if (!isValid) {
        const isExhausted = await authRepository.clearExhaustedOtp(
            user.id,
            user.otpHash,
            OTP_MAX_ATTEMPTS
        )
        if (isExhausted) {
            throw new AppError('too many attempts, request a new code', 429)
        }
        throw new AppError('invalid code', 401)
    }

    const isNewUser = !user.emailVerified

    // A correct code still has to be the stored one: a code cleared by a lockout or used by
    // another request cannot sign in.
    const isConsumed = await authRepository.consumeOtp(user.id, user.otpHash)
    if (!isConsumed) {
        throw new AppError('invalid or expired code, request a new one', 401)
    }

    const { accessToken } = await issueSession({
        userId: user.id,
        method: 'email',
        userAgent,
        ipAddress,
    })

    if (isNewUser) {
        // a new account that came from an invite link (#638). an account that exists never gets one
        await billingService.attachReferral({
            inviteeId: user.id,
            inviteeEmail: user.email,
            code: referralCode,
        })

        await sendWelcomeNotice(user.id)
    }

    return { accessToken, isNewUser }
}

const google = async (data: Google) => {
    const { name, email, sub, userAgent, ipAddress, referralCode } = data
    const normalizedEmail = email.trim().toLowerCase()

    let user = await authRepository.findUserByEmail(normalizedEmail)

    if (!user) {
        user = await authRepository.createUser({
            email: normalizedEmail,
            emailVerified: true,
            googleId: sub,
            name: name,
        })
        await billingService.attachReferral({
            inviteeId: user.id,
            inviteeEmail: user.email,
            code: referralCode,
        })

        await sendWelcomeNotice(user.id)
    } else if (user.deletedAt || user.isDeleted) {
        throw new AppError('account has been deleted', 403)
    } else if (!user.googleId) {
        // a row with no verified email is an email sign-up that was started and not
        // finished: this is still a new account, so the invite code attaches (review C8)
        const startedWithEmail = !user.emailVerified
        user = await authRepository.updateUser(user.id, {
            googleId: sub,
            emailVerified: true,
            ...clearedOtp,
        })
        if (startedWithEmail) {
            await billingService.attachReferral({
                inviteeId: user.id,
                inviteeEmail: user.email,
                code: referralCode,
            })
        }
    } else if (user.googleId !== sub) {
        throw new AppError('google id mismatch', 400)
    }

    const { accessToken } = await issueSession({
        userId: user.id,
        method: 'google',
        userAgent,
        ipAddress,
    })

    return { accessToken }
}

const github = async (data: Github) => {
    const { name, email, sub, username: ghUsername, userAgent, ipAddress, referralCode } = data
    const normalizedEmail = email.trim().toLowerCase()

    // the github id is stable, the primary email is not: match on the id first
    let user =
        (await authRepository.findUserByGithubId(sub)) ??
        (await authRepository.findUserByEmail(normalizedEmail))

    // a row with no verified email is an email sign-up that was started and not
    // finished: this is still a new account (review C8)
    const startedWithEmail = Boolean(user && !user.emailVerified && !user.githubId)
    const isNewUser = !user || startedWithEmail

    if (!user) {
        user = await authRepository.createUser({
            email: normalizedEmail,
            emailVerified: true,
            githubId: sub,
            ...(ghUsername ? { githubUsername: ghUsername } : {}),
            name: name,
        })
        await billingService.attachReferral({
            inviteeId: user.id,
            inviteeEmail: user.email,
            code: referralCode,
        })

        await sendWelcomeNotice(user.id)
    } else if (user.deletedAt || user.isDeleted) {
        throw new AppError('account has been deleted', 403)
    } else if (!user.githubId) {
        user = await authRepository.updateUser(user.id, {
            githubId: sub,
            githubUsername: ghUsername || user.githubUsername,
            emailVerified: true,
            ...clearedOtp,
        })
        if (startedWithEmail) {
            await billingService.attachReferral({
                inviteeId: user.id,
                inviteeEmail: user.email,
                code: referralCode,
            })
        }
    } else if (user.githubId !== sub) {
        throw new AppError('github id mismatch', 400)
    } else if (ghUsername && user.githubUsername !== ghUsername) {
        user = await authRepository.updateUser(user.id, {
            githubUsername: ghUsername,
        })
    }

    const { accessToken } = await issueSession({
        userId: user.id,
        method: 'github',
        userAgent,
        ipAddress,
    })

    // never return the user row: it holds stored tokens
    return { accessToken, isNewUser }
}

const endSession = async (data: EndSession): Promise<never> => {
    const { sessionId, message } = data

    await authRepository.deleteSessionsBySessionId(sessionId)
    await sessionCache.invalidate(sessionId)
    throw new AppError(message, 401)
}

/**
 * A token is current when it was made at or after the last refresh of its session. A token
 * from before ms issue times (no iatMs) is current only if it is the stored one.
 */
const isCurrentToken = (data: IsCurrentToken) => {
    const { payload, incomingHash, session } = data
    if (!session.rotatedAt) return true
    if (typeof payload.iatMs !== 'number') return session.refreshTokenHash === incomingHash
    return payload.iatMs >= session.rotatedAt.getTime()
}

/**
 * Gives a new token for a session that is still signed in. The token sent may have expired:
 * the session row decides. A session is active for 30 days after its last use.
 */
const refreshSession = async (data: RefreshSession) => {
    const { refreshToken } = data

    if (!refreshToken) {
        throw new AppError('token is required', 401)
    }

    let payload: TokenPayload

    try {
        payload = verifyTokenIgnoringExpiry(refreshToken)
    } catch {
        throw new AppError('invalid or expired token', 401)
    }

    const { userId, sessionId } = payload

    if (!userId || !sessionId) {
        throw new AppError('invalid or expired token', 401)
    }

    let session = await authRepository.findSessionById(sessionId)

    if (!session) {
        throw new AppError('session not found', 401)
    }

    if (session.isRevoked) {
        throw new AppError('session revoked', 401)
    }

    if (session.userId !== userId) {
        return endSession({ sessionId: session.id, message: 'invalid session' })
    }

    if (session.expiresAt.getTime() <= Date.now()) {
        return endSession({ sessionId: session.id, message: 'session expired' })
    }

    const user = await authRepository.findUserById(userId)

    if (!user) {
        return endSession({ sessionId: session.id, message: 'user not found' })
    }

    if (user.deletedAt || user.isDeleted) {
        return endSession({ sessionId: session.id, message: 'account no longer exists' })
    }

    const incomingHash = hashRefreshToken(refreshToken)

    // 1. a current token (made at or after the last refresh): replace it. only one of two
    // refreshes sent at once can do this
    if (isCurrentToken({ payload, incomingHash, session })) {
        const rotatedAt = new Date()
        const newAccessToken = generateAccessToken(
            { userId: user.id, sessionId: session.id },
            { issuedAt: rotatedAt }
        )
        const expiresAt = new Date(rotatedAt.getTime() + SESSION_TTL_MS)

        const isRotated = await authRepository.rotateSessionToken({
            id: session.id,
            lastRotatedAt: session.rotatedAt,
            previousHash: session.refreshTokenHash,
            newHash: hashRefreshToken(newAccessToken),
            rotatedAt,
            expiresAt,
        })

        if (isRotated) {
            await sessionCache.set(session.id, {
                id: session.id,
                userId: user.id,
                isRevoked: false,
                expiresAt,
                rotatedAt,
                user: {
                    id: user.id,
                    isDeleted: false,
                },
            })

            return { accessToken: newAccessToken }
        }

        // another refresh replaced the token first: answer like the case below
        session = await authRepository.findSessionById(session.id)
        if (!session || session.isRevoked) {
            throw new AppError('session revoked', 401)
        }
    }

    // 2. a token the last refresh replaced, sent by another tab at about the same time
    const rotatedAtMs = session.rotatedAt?.getTime() ?? 0

    if (Date.now() - rotatedAtMs <= TOKEN_GRACE_PERIOD_MS) {
        // made at or after the refresh, so it counts as current and can refresh later
        const issuedAt = new Date(Math.max(Date.now(), rotatedAtMs))
        const concurrentAccessToken = generateAccessToken(
            { userId: user.id, sessionId: session.id },
            { issuedAt }
        )

        return { accessToken: concurrentAccessToken }
    }

    // 3. a replaced token used again after the grace period: it may be stolen, end the session
    await authRepository.revokeSession(session.id)
    await sessionCache.invalidate(session.id)
    throw new AppError('token reuse detected', 401)
}

/**
 * A signed-out browser gets no more push (#636): the browsers of one sign-in, or every
 * browser of the user when no sign-in is given. Sign out still works when this fails; a
 * revoked sign-in is not sent to in any case.
 */
const removeSignedOutPush = async (data: RemoveSignedOutPush) => {
    const { userId, sessionId } = data
    try {
        await notificationService.removePushOnSignOut({ userId, authSessionId: sessionId })
    } catch (error) {
        console.error('[Auth] could not remove the push of a signed-out browser:', error)
    }
}

const signout = async (data: Signout) => {
    const { userId, sessionId } = data

    const existingSession = await authRepository.findSessionById(sessionId)

    if (!existingSession || existingSession.userId !== userId) {
        return
    }

    await authRepository.revokeSession(sessionId)
    await sessionCache.invalidate(sessionId)
    await removeSignedOutPush({ userId, sessionId })
}

const signoutAll = async (data: SignoutAll) => {
    const { userId } = data

    await authRepository.revokeAllSessions(userId)
    await sessionCache.invalidateUser(userId)
    await removeSignedOutPush({ userId })
}

const listSignedInSessions = async (data: ListSignedInSessions): Promise<SignedInSession[]> => {
    const { userId, currentSessionId } = data

    const sessions = await authRepository.findActiveSessionsByUser(userId)

    const rows = sessions.map((session) => ({
        id: session.id,
        ...describeUserAgent(session.userAgent),
        lastActiveAt: session.rotatedAt ?? session.updatedAt,
        createdAt: session.createdAt,
        isCurrent: session.id === currentSessionId,
    }))

    // this device first, then the others by last use
    return rows.sort((a, b) => Number(b.isCurrent) - Number(a.isCurrent))
}

const revokeSignedInSession = async (data: RevokeSignedInSession) => {
    const { userId, currentSessionId, sessionId } = data

    const session = await authRepository.findSessionById(sessionId)

    // another user's session gets the same answer as a missing one
    if (!session || session.userId !== userId || session.isRevoked) {
        throw new AppError('session not found', 404)
    }

    await authRepository.revokeSession(sessionId)
    await sessionCache.invalidate(sessionId)
    await removeSignedOutPush({ userId, sessionId })

    return { id: sessionId, isCurrent: sessionId === currentSessionId }
}

const deleteAccount = async (data: DeleteAccount) => {
    const { userId } = data

    const user = await authRepository.findUserByIdForDeleteCheck(userId)

    if (!user) {
        throw new AppError('user not found', 404)
    }

    if (user.isDeleted) {
        throw new AppError('user account is already deleted', 409)
    }

    await authRepository.deleteAccount(userId)
    await sessionCache.invalidateUser(userId)
    await removeSignedOutPush({ userId })
}

const generateDeviceCode = async () => {
    const maxRetries = 3

    for (let attempt = 0; attempt < maxRetries; attempt++) {
        const deviceCode = crypto.randomBytes(32).toString('hex')
        const userCode = generateUserCode()
        const expiresIn = 900 // 15 minutes

        try {
            await authRepository.createDeviceCode({
                deviceCode,
                userCode,
                expiresAt: new Date(Date.now() + expiresIn * 1000),
                status: 'PENDING',
            })

            return {
                deviceCode,
                userCode,
                verificationUri: `${(env.APP_URL || 'https://app.trydecember.com').replace(/\/+$/, '')}/activate`,
                expiresIn,
                interval: 5,
            }
        } catch (error: any) {
            // prisma unique constraint violation - retry with a new code
            if (error?.code === 'P2002' && attempt < maxRetries - 1) {
                continue
            }
            throw error
        }
    }

    throw new AppError('failed to generate device code', 500)
}

const pollDeviceToken = async (data: PollDeviceToken) => {
    const { deviceCode, userAgent, ipAddress } = data

    const codeRecord = await authRepository.findDeviceCodeByDeviceCode(deviceCode)

    if (!codeRecord) {
        throw new AppError('invalid_client', 400)
    }

    if (codeRecord.expiresAt < new Date()) {
        await authRepository.updateDeviceCode(codeRecord.id, { status: 'EXPIRED' })
        throw new AppError('expired_token', 400)
    }

    if (codeRecord.status === 'PENDING') {
        throw new AppError('authorization_pending', 400)
    }

    if (codeRecord.status === 'APPROVED' && codeRecord.userId) {
        const user = await authRepository.findUserById(codeRecord.userId)

        if (!user) {
            throw new AppError('User not found', 404)
        }

        // the account was deleted after it approved this code: no sign-in for the CLI
        if (user.deletedAt || user.isDeleted) {
            await authRepository.deleteDeviceCode(codeRecord.id)
            throw new AppError('account has been deleted', 403)
        }

        const { accessToken } = await issueSession({
            userId: user.id,
            method: 'cli',
            userAgent: userAgent || 'device-cli',
            ipAddress: ipAddress || 'unknown',
        })

        consumedCodesFallback.set(codeRecord.userCode, Date.now() + 3600_000)
        if (redisClient && redisClient.status === 'ready') {
            redisClient.set(`device:consumed:${codeRecord.userCode}`, '1', 'EX', 3600).catch(() => {
                // Intentionally swallowed: fallback handled if redis is unavailable
            })
        }

        await authRepository.deleteDeviceCode(codeRecord.id)

        return {
            token: accessToken,
            email: user.email,
        }
    }

    throw new AppError('authorization_pending', 400)
}

const consumedCodesFallback = new Map<string, number>()

const isDeviceCodeConsumed = async (userCode: string): Promise<boolean> => {
    const memExpiry = consumedCodesFallback.get(userCode)
    if (memExpiry) {
        if (memExpiry > Date.now()) {
            return true
        }
        consumedCodesFallback.delete(userCode)
    }
    if (redisClient && redisClient.status === 'ready') {
        try {
            const consumed = await redisClient.get(`device:consumed:${userCode}`)
            if (consumed) {
                return true
            }
        } catch {
            // Intentionally swallowed: fallback handled if redis is unavailable
        }
    }
    return false
}

const verifyUserCode = async (data: VerifyUserCode): Promise<VerifyUserCodeResult> => {
    const { userCode, userId } = data

    const codeRecord = await authRepository.findDeviceCodeByUserCode(userCode)

    if (!codeRecord) {
        if (await isDeviceCodeConsumed(userCode)) {
            return { status: 'already_activated' }
        }
        throw new AppError('Invalid code', 404)
    }

    if (codeRecord.expiresAt < new Date()) {
        throw new AppError('This code has expired', 400)
    }

    if (codeRecord.status === 'APPROVED') {
        return { status: 'already_activated' }
    }

    if (codeRecord.status !== 'PENDING') {
        throw new AppError('This code is no longer pending', 400)
    }

    await authRepository.updateDeviceCode(codeRecord.id, {
        status: 'APPROVED',
        user: { connect: { id: userId } },
    })

    return { status: 'approved' }
}

const getDeviceStatus = async (data: GetDeviceStatus): Promise<GetDeviceStatusResult> => {
    const { userId, userCode } = data

    if (userCode) {
        const codeRecord = await authRepository.findDeviceCodeByUserCode(userCode)
        if (!codeRecord) {
            if (await isDeviceCodeConsumed(userCode)) {
                return { activated: true, status: 'already_activated' }
            }
            return { activated: false, status: 'invalid' }
        }

        if (codeRecord.status === 'APPROVED') {
            return { activated: true, status: 'already_activated' }
        }

        if (codeRecord.expiresAt < new Date()) {
            return { activated: false, status: 'expired' }
        }

        return { activated: false, status: 'pending' }
    }

    const activeSession = await authRepository.findActiveDeviceSession(userId)
    return {
        activated: Boolean(activeSession),
        status: activeSession ? 'already_activated' : 'idle',
    }
}

const purgeExpiredAndRevokedSessions = async (_data: PurgeSessions = {}) => {
    return authRepository.purgeExpiredAndRevokedSessions()
}

export const authService = {
    startEmailAuth,
    verifyEmailAuth,
    google,
    github,
    refreshSession,
    signout,
    signoutAll,
    listSignedInSessions,
    revokeSignedInSession,
    deleteAccount,
    generateDeviceCode,
    pollDeviceToken,
    verifyUserCode,
    getDeviceStatus,
    purgeExpiredAndRevokedSessions,
}
