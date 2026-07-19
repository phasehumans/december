import crypto from 'crypto'

import { prisma } from '@december/database'

import { env } from '../../env'

// aes-256-gcm settings
const ALGORITHM = 'aes-256-gcm'
const KEY = Buffer.from(env.SECRETS_ENC_KEY, 'hex')

export function encrypt(text: string): string {
    const iv = crypto.randomBytes(12)
    const cipher = crypto.createCipheriv(ALGORITHM, KEY, iv)
    let encrypted = cipher.update(text, 'utf8', 'hex')
    encrypted += cipher.final('hex')
    const authTag = cipher.getAuthTag().toString('hex')
    return `${iv.toString('hex')}:${authTag}:${encrypted}`
}

export function decrypt(encryptedText: string): string {
    const [ivHex, authTagHex, contentHex] = encryptedText.split(':')
    if (!ivHex || !authTagHex || !contentHex) throw new Error('Invalid encrypted text')
    const iv = Buffer.from(ivHex, 'hex')
    const authTag = Buffer.from(authTagHex, 'hex')
    const decipher = crypto.createDecipheriv(ALGORITHM, KEY, iv)
    decipher.setAuthTag(authTag)
    let decrypted = decipher.update(contentHex, 'hex', 'utf8')
    decrypted += decipher.final('utf8')
    return decrypted
}

export async function createSecret(userId: string, name: string, value: string) {
    const encryptedValue = encrypt(value)
    return prisma.secret.upsert({
        where: {
            userId_name: {
                userId,
                name,
            },
        },
        update: {
            value: encryptedValue,
        },
        create: {
            userId,
            name,
            value: encryptedValue,
        },
    })
}

export async function getSecrets(userId: string) {
    const secrets = await prisma.secret.findMany({
        where: { userId },
        select: { id: true, name: true, createdAt: true, updatedAt: true },
    })
    return secrets
}

export async function deleteSecret(userId: string, name: string) {
    return prisma.secret.delete({
        where: {
            userId_name: {
                userId,
                name,
            },
        },
    })
}
