import crypto from 'node:crypto'

import { describe, expect, it } from 'bun:test'

import { decryptText, encryptText, EncryptedTextError } from '../../src/crypto'

const KEY = 'a1'.repeat(32)
const OTHER_KEY = 'b2'.repeat(32)

describe('crypto', () => {
    it('round-trips text', () => {
        const encrypted = encryptText({ text: 'sk-user-key', keyHex: KEY })
        expect(encrypted).not.toContain('sk-user-key')
        expect(encrypted.split(':')).toHaveLength(3)
        expect(decryptText({ encryptedText: encrypted, keyHex: KEY })).toBe('sk-user-key')
    })

    it('uses a new iv for each encryption', () => {
        const a = encryptText({ text: 'same', keyHex: KEY })
        const b = encryptText({ text: 'same', keyHex: KEY })
        expect(a).not.toBe(b)
    })

    it('decrypts values written by the previous server implementation', () => {
        // the exact steps secrets.service.ts used before the helper moved here
        const iv = crypto.randomBytes(12)
        const cipher = crypto.createCipheriv('aes-256-gcm', Buffer.from(KEY, 'hex'), iv)
        let encrypted = cipher.update('legacy-secret', 'utf8', 'hex')
        encrypted += cipher.final('hex')
        const stored = `${iv.toString('hex')}:${cipher.getAuthTag().toString('hex')}:${encrypted}`
        expect(decryptText({ encryptedText: stored, keyHex: KEY })).toBe('legacy-secret')
    })

    it('rejects a malformed value', () => {
        expect(() => decryptText({ encryptedText: 'not-encrypted', keyHex: KEY })).toThrow(
            EncryptedTextError
        )
    })

    it('fails with the wrong key or a changed ciphertext', () => {
        const encrypted = encryptText({ text: 'secret', keyHex: KEY })
        expect(() => decryptText({ encryptedText: encrypted, keyHex: OTHER_KEY })).toThrow()
        const [iv, tag, body] = encrypted.split(':')
        const flipped = `${iv}:${tag}:${body!.slice(0, -2)}${body!.endsWith('00') ? '11' : '00'}`
        expect(() => decryptText({ encryptedText: flipped, keyHex: KEY })).toThrow()
    })

    it('rejects a short auth tag or iv, so a forged short tag never passes', () => {
        const encrypted = encryptText({ text: 'secret', keyHex: KEY })
        const [iv, tag, body] = encrypted.split(':')
        for (const changed of [
            `${iv}:${tag!.slice(0, 8)}:${body}`,
            `${iv}:${tag!.slice(0, 24)}:${body}`,
            `${iv!.slice(0, 16)}:${tag}:${body}`,
        ]) {
            expect(() => decryptText({ encryptedText: changed, keyHex: KEY })).toThrow(
                EncryptedTextError
            )
        }
    })

    it('rejects a key that is not 32 bytes', () => {
        expect(() => encryptText({ text: 'x', keyHex: 'abcd' })).toThrow(
            'encryption key must be 32 bytes'
        )
    })
})
