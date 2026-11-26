import { decryptText, encryptText } from '@december/shared/crypto'
import { Secret, TOTP } from 'otpauth'

import { env } from '../../env'

const TOTP_PERIOD_SECONDS = 30
export const TOTP_MAX_FAILURES = 5
export const TOTP_LOCK_MS = 15 * 60 * 1000

const keyHex = () => process.env.SECRETS_ENC_KEY ?? env.SECRETS_ENC_KEY

export const encryptTotpSecret = (base32: string): string =>
    encryptText({ text: base32, keyHex: keyHex() })

export const decryptTotpSecret = (encrypted: string): string =>
    decryptText({ encryptedText: encrypted, keyHex: keyHex() })

/** A new random 160-bit secret, as base32 (what authenticator apps take). */
export const createTotpSecret = (): string => new Secret({ size: 20 }).base32

export const buildTotp = (data: { base32: string; email: string }) => {
    const { base32, email } = data
    return new TOTP({
        issuer: 'December',
        label: `December admin (${email})`,
        algorithm: 'SHA1',
        digits: 6,
        period: TOTP_PERIOD_SECONDS,
        secret: Secret.fromBase32(base32),
    })
}

/** The 30-second step a code belongs to, or null when the code is wrong. One step of drift either way is accepted (T9). */
export const matchTotpStep = (data: {
    base32: string
    email: string
    code: string
    now?: number
}) => {
    const { base32, email, code, now = Date.now() } = data
    const delta = buildTotp({ base32, email }).validate({ token: code, timestamp: now, window: 1 })
    if (delta === null) return null
    return Math.floor(now / 1000 / TOTP_PERIOD_SECONDS) + delta
}

/** "JBSWY3DPEHPK3PXP" as "JBSW Y3DP EHPK 3PXP", easier to type by hand. */
export const groupSecret = (base32: string): string => base32.replace(/(.{4})(?=.)/g, '$1 ')
