import { decryptText, encryptText, EncryptedTextError } from '@december/shared/crypto'

import { env } from '../../env'
import { AppError } from '../../shared/appError'

import { secretsRepository } from './secrets.repository'

import type {
    EncryptData,
    DecryptData,
    CreateSecret,
    BulkCreateSecrets,
    GetSecrets,
    GetSecretValue,
    DeleteSecret,
    GetAllDecryptedSecrets,
    DecryptedSecretItem,
} from './secrets.types'

const encrypt = (data: EncryptData): string => {
    const { text } = data
    return encryptText({ text, keyHex: env.SECRETS_ENC_KEY })
}

const decrypt = (data: DecryptData): string => {
    const { encryptedText } = data
    try {
        return decryptText({ encryptedText, keyHex: env.SECRETS_ENC_KEY })
    } catch (error) {
        if (error instanceof EncryptedTextError) throw new AppError('Invalid encrypted text', 400)
        throw error
    }
}

const createSecret = async (data: CreateSecret) => {
    const { userId, name, value, note } = data
    const encryptedValue = encrypt({ text: value })
    return secretsRepository.upsertSecret(userId, name, encryptedValue, note)
}

const bulkCreateSecrets = async (data: BulkCreateSecrets) => {
    const { userId, secrets } = data
    const itemsToUpsert = secrets.map((item) => ({
        name: item.name,
        encryptedValue: encrypt({ text: item.value }),
        note: item.note,
    }))
    return secretsRepository.bulkUpsertSecrets(userId, itemsToUpsert)
}

const getSecrets = async (data: GetSecrets) => {
    const { userId } = data
    return secretsRepository.findSecretsByUser(userId)
}

const getSecretValue = async (data: GetSecretValue) => {
    const { userId, name } = data
    const secret = await secretsRepository.findSecretByName(userId, name)
    if (!secret) throw new AppError('Secret not found', 404)
    const decryptedValue = decrypt({ encryptedText: secret.value })
    return {
        id: secret.id,
        name: secret.name,
        value: decryptedValue,
        note: secret.note,
        createdAt: secret.createdAt,
        updatedAt: secret.updatedAt,
    }
}

const deleteSecret = async (data: DeleteSecret) => {
    const { userId, name } = data
    const existing = await secretsRepository.findSecretByName(userId, name)
    if (!existing) throw new AppError('Secret not found', 404)
    return secretsRepository.deleteSecret(userId, name)
}

const getAllDecryptedSecrets = async (
    data: GetAllDecryptedSecrets
): Promise<DecryptedSecretItem[]> => {
    const { userId } = data
    const secrets = await secretsRepository.findSecretsWithValuesByUser(userId)
    const result: DecryptedSecretItem[] = []

    for (const item of secrets) {
        try {
            const decryptedValue = decrypt({ encryptedText: item.value })
            result.push({
                key: item.name,
                value: decryptedValue,
            })
        } catch {
            // Intentionally swallowed: Skip un-decryptable or corrupted secret
        }
    }

    return result
}

export const secretsService = {
    encrypt,
    decrypt,
    createSecret,
    bulkCreateSecrets,
    getSecrets,
    getSecretValue,
    deleteSecret,
    getAllDecryptedSecrets,
}
