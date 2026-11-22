import crypto from 'node:crypto'

// AES-256-GCM with a 12-byte iv. Stored as `iv:authTag:ciphertext` (hex), the
// format the server has always used for user secrets.
const ALGORITHM = 'aes-256-gcm'

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
    const iv = crypto.randomBytes(12)
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
    const decipher = crypto.createDecipheriv(ALGORITHM, toKey(keyHex), Buffer.from(ivHex, 'hex'))
    decipher.setAuthTag(Buffer.from(authTagHex, 'hex'))
    let decrypted = decipher.update(contentHex, 'hex', 'utf8')
    decrypted += decipher.final('utf8')
    return decrypted
}
