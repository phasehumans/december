import QRCode from 'qrcode'

import { ADMIN_CODE_VALID_MS } from '../../middleware/admin.middleware'
import { AppError } from '../../shared/appError'
import { adminRepository } from '../admin/admin.repository'
import { sessionCache } from '../auth/auth.cache'
import { notificationService } from '../notification/notification.service'

import { admintotpRepository } from './admintotp.repository'
import {
    TOTP_LOCK_MS,
    TOTP_MAX_FAILURES,
    buildTotp,
    createTotpSecret,
    decryptTotpSecret,
    encryptTotpSecret,
    groupSecret,
    matchTotpStep,
} from './admintotp.utils'

import type {
    CheckTotpCode,
    GetTotpStatus,
    StartTotpSetup,
    TotpStatus,
    ResetAuthenticator,
} from './admintotp.types'

const getEmail = async (userId: string) => {
    const user = await admintotpRepository.findUserEmail(userId)
    if (!user) throw new AppError('admin not found', 404)
    return user.email
}

/**
 * Tells the admin about the authenticator (T4-A, T7) in their December inbox (no email). A
 * failed inbox item must not block the action.
 */
const alertAdmin = async (data: { userId: string; title: string; message: string }) => {
    const { userId, title, message } = data
    try {
        await notificationService.sendNotificationToUser({
            userId,
            title,
            message,
            type: 'WARNING',
        })
    } catch (err) {
        console.error('[admin totp] inbox alert failed', err)
    }
}

const getStatus = async (data: GetTotpStatus): Promise<TotpStatus> => {
    const { userId, sessionId } = data
    const [row, session] = await Promise.all([
        admintotpRepository.findByUser(userId),
        admintotpRepository.findSessionVerifiedAt(sessionId),
    ])
    const verifiedAt = session?.adminVerifiedAt ?? null
    const verifiedUntil = verifiedAt ? new Date(verifiedAt.getTime() + ADMIN_CODE_VALID_MS) : null
    const isLocked = Boolean(row?.lockedUntil && row.lockedUntil.getTime() > Date.now())
    return {
        enabled: Boolean(row?.enabledAt),
        lockedUntil: isLocked ? row!.lockedUntil : null,
        verifiedAt,
        verifiedUntil: verifiedUntil && verifiedUntil.getTime() > Date.now() ? verifiedUntil : null,
    }
}

/** Step 1 of setup: a new secret as a QR code and a key to type. Only before the app is on (T11). */
const startSetup = async (data: StartTotpSetup) => {
    const { userId } = data
    const existing = await admintotpRepository.findByUser(userId)
    if (existing?.enabledAt) {
        throw new AppError(
            'the authenticator is already on. reset it on the server to change it',
            409
        )
    }

    const email = await getEmail(userId)
    const base32 = createTotpSecret()
    const saved = await admintotpRepository.savePendingSecret({
        userId,
        secretEncrypted: encryptTotpSecret(base32),
    })
    if (!saved) {
        throw new AppError(
            'the authenticator is already on. reset it on the server to change it',
            409
        )
    }
    const otpauthUrl = buildTotp({ base32, email }).toString()
    const qrDataUrl = await QRCode.toDataURL(otpauthUrl, { margin: 1, width: 220 })
    return { qrDataUrl, key: groupSecret(base32) }
}

/**
 * Checks a code against the saved secret: refuses while locked, counts wrong codes (5 lock
 * the app for 15 minutes and email the admin), and takes each code only once.
 */
const checkCode = async (data: { userId: string; code: string; enable: boolean }) => {
    const { userId, code, enable } = data
    const row = await admintotpRepository.findByUser(userId)
    if (!row) throw new AppError('set up the authenticator first', 400)
    if (enable && row.enabledAt) throw new AppError('the authenticator is already on', 409)
    if (!enable && !row.enabledAt) throw new AppError('set up the authenticator first', 400)

    const lockedMessage = (until: Date) =>
        `Too many wrong codes. Try again in ${Math.ceil((until.getTime() - Date.now()) / 60000)} min`
    if (row.lockedUntil && row.lockedUntil.getTime() > Date.now()) {
        throw new AppError(lockedMessage(row.lockedUntil), 429)
    }

    // count this attempt first, so parallel requests can't get more than 5 tries; the last
    // one sets the lock in the same update
    const attempt = await admintotpRepository.reserveAttempt({
        userId,
        maxAttempts: TOTP_MAX_FAILURES,
        lockMs: TOTP_LOCK_MS,
    })
    if (attempt === null) {
        throw new AppError('Too many wrong codes. Try again in a few minutes', 429)
    }

    const email = await getEmail(userId)
    const step = matchTotpStep({ base32: decryptTotpSecret(row.secretEncrypted), email, code })
    if (step === null) {
        // only the request that used the last attempt writes the audit row and the alert
        if (attempt.failedCount >= TOTP_MAX_FAILURES && attempt.lockedUntil) {
            await adminRepository.writeAuditLog({
                adminUserId: userId,
                action: 'admin.code_locked',
                targetType: 'admin',
                targetId: userId,
                metadata: { failures: attempt.failedCount },
            })
            await alertAdmin({
                userId,
                title: 'Authenticator locked',
                message: `Someone entered ${attempt.failedCount} wrong authenticator codes on your admin account. Codes are blocked for 15 minutes. If this was not you, sign out of every device from Settings.`,
            })
            throw new AppError(lockedMessage(new Date(attempt.lockedUntil)), 429)
        }
        throw new AppError('That code is not right', 400)
    }

    const claimed = await admintotpRepository.claimStep({ userId, step, enable })
    if (!claimed) throw new AppError('This code was already used. Wait for the next one', 400)
    return { email }
}

/** Step 2 of setup: the first right code turns the app on and verifies this sign-in. */
const enable = async (data: CheckTotpCode) => {
    const { userId, sessionId, code } = data
    const { email } = await checkCode({ userId, code, enable: true })
    await admintotpRepository.markSessionVerified(sessionId)
    await adminRepository.writeAuditLog({
        adminUserId: userId,
        action: 'admin.code_enabled',
        targetType: 'admin',
        targetId: userId,
        metadata: {},
    })
    await alertAdmin({
        userId,
        title: 'Authenticator turned on',
        message:
            'An authenticator app was connected to your admin account. If this was not you, reset it on the server right away and sign out of every device.',
    })
    return getStatus({ userId, sessionId })
}

/** Every later visit: a right code verifies this sign-in for 12 hours. */
const verify = async (data: CheckTotpCode) => {
    const { userId, sessionId, code } = data
    await checkCode({ userId, code, enable: false })
    await admintotpRepository.markSessionVerified(sessionId)
    return getStatus({ userId, sessionId })
}

/**
 * The reset script (T5, S2): removes the authenticator and signs the admin out everywhere,
 * including the session cache, so an old sign-in can't set up the next authenticator.
 */
const resetAuthenticator = async (data: ResetAuthenticator) => {
    const { userId } = data
    const ended = await admintotpRepository.resetForUser(userId)
    await Promise.all(ended.map((sessionId) => sessionCache.invalidate(sessionId)))
    return { endedSignIns: ended.length }
}

export const admintotpService = {
    resetAuthenticator,
    getStatus,
    startSetup,
    enable,
    verify,
}
