import crypto from 'node:crypto'

// AES-256-GCM with a 12-byte iv. Stored as `iv:authTag:ciphertext` (hex), the
// format the server has always used for user secrets.
const ALGORITHM = 'aes-256-gcm'
const IV_BYTES = 12
const AUTH_TAG_BYTES = 16

export class EncryptedTextError extends Error {
    constructor(message = 'Invalid encrypted text') {
        super(message)
        this.name = 'EncryptedTextError'
    }
}

const toKey = (keyHex: string): Buffer => {
    const key = Buffer.from(keyHex, 'hex')
    if (key.length !== 32) {
        throw new Error('encryption key must be 32 bytes (64 hex characters)')
    }
    return key
}

export const encryptText = (data: { text: string; keyHex: string }): string => {
    const { text, keyHex } = data
    const iv = crypto.randomBytes(IV_BYTES)
    const cipher = crypto.createCipheriv(ALGORITHM, toKey(keyHex), iv)
    let encrypted = cipher.update(text, 'utf8', 'hex')
    encrypted += cipher.final('hex')
    const authTag = cipher.getAuthTag().toString('hex')
    return `${iv.toString('hex')}:${authTag}:${encrypted}`
}

export const decryptText = (data: { encryptedText: string; keyHex: string }): string => {
    const { encryptedText, keyHex } = data
    const [ivHex, authTagHex, contentHex] = encryptedText.split(':')
    if (!ivHex || !authTagHex || !contentHex) throw new EncryptedTextError()
    const iv = Buffer.from(ivHex, 'hex')
    const authTag = Buffer.from(authTagHex, 'hex')
    // GCM takes a short tag too, and a short tag is easier to forge: only the full 16 bytes
    // that encryptText writes are good
    if (iv.length !== IV_BYTES || authTag.length !== AUTH_TAG_BYTES) throw new EncryptedTextError()
    const decipher = crypto.createDecipheriv(ALGORITHM, toKey(keyHex), iv, {
        authTagLength: AUTH_TAG_BYTES,
    })
    decipher.setAuthTag(authTag)
    let decrypted = decipher.update(contentHex, 'hex', 'utf8')
    decrypted += decipher.final('utf8')
    return decrypted
}
