import crypto from 'crypto'

import { env } from '../../env'
import { AppError } from '../../shared/appError'

import { secretsRepository } from './secrets.repository'
import type {
    EncryptData,
    DecryptData,
    CreateSecret,
    GetSecrets,
    DeleteSecret,
} from './secrets.types'

const ALGORITHM = 'aes-256-gcm'
const KEY = Buffer.from(env.SECRETS_ENC_KEY, 'hex')

const encrypt = (data: EncryptData): string => {
    const { text } = data
    const iv = crypto.randomBytes(12)
    const cipher = crypto.createCipheriv(ALGORITHM, KEY, iv)
    let encrypted = cipher.update(text, 'utf8', 'hex')
    encrypted += cipher.final('hex')
    const authTag = cipher.getAuthTag().toString('hex')
    return `${iv.toString('hex')}:${authTag}:${encrypted}`
}

const decrypt = (data: DecryptData): string => {
    const { encryptedText } = data
    const [ivHex, authTagHex, contentHex] = encryptedText.split(':')
    if (!ivHex || !authTagHex || !contentHex) throw new AppError('Invalid encrypted text', 400)
    const iv = Buffer.from(ivHex, 'hex')
    const authTag = Buffer.from(authTagHex, 'hex')
    const decipher = crypto.createDecipheriv(ALGORITHM, KEY, iv)
    decipher.setAuthTag(authTag)
    let decrypted = decipher.update(contentHex, 'hex', 'utf8')
    decrypted += decipher.final('utf8')
    return decrypted
}

const createSecret = async (data: CreateSecret) => {
    const { userId, name, value } = data
    const encryptedValue = encrypt({ text: value })
    return secretsRepository.upsertSecret(userId, name, encryptedValue)
}

const getSecrets = async (data: GetSecrets) => {
    const { userId } = data
    return secretsRepository.findSecretsByUser(userId)
}

const deleteSecret = async (data: DeleteSecret) => {
    const { userId, name } = data
    return secretsRepository.deleteSecret(userId, name)
}

export const secretsService = {
    encrypt,
    decrypt,
    createSecret,
    getSecrets,
    deleteSecret,
}
