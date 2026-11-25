import { decryptText, encryptText, EncryptedTextError } from '@december/shared/crypto'

import { env } from '../../env'
import { AppError } from '../../shared/appError'
import { auditService } from '../audit/audit.service'

import { secretsRepository } from './secrets.repository'
import {
    pickSecretsForRepository,
    toApiRepo,
    toSessionRepoFullName,
    toStoredRepo,
} from './secrets.utils'

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
    const { userId, name, value, note, repoFullName } = data
    const encryptedValue = encrypt({ text: value })
    // a secret with this name in this repository is there already: the save is an update
    const existing = await secretsRepository.findSecretByName(
        userId,
        name,
        toStoredRepo(repoFullName)
    )
    const secret = await secretsRepository.upsertSecret(
        userId,
        name,
        encryptedValue,
        note,
        toStoredRepo(repoFullName)
    )
    await auditService.recordForUser({
        userId,
        action: existing ? 'secret.updated' : 'secret.created',
        target: name,
    })
    return secret
}

const bulkCreateSecrets = async (data: BulkCreateSecrets) => {
    const { userId, secrets, repoFullName } = data
    const itemsToUpsert = secrets.map((item) => ({
        name: item.name,
        encryptedValue: encrypt({ text: item.value }),
        note: item.note,
        // an item with no repository field takes the repository of the whole import
        repoFullName: toStoredRepo(
            item.repoFullName === undefined ? repoFullName : item.repoFullName
        ),
    }))
    // the secrets that are there already: their save is an update, the others are new
    const before = await secretsRepository.findSecretsByUser(userId)
    const known = new Set(before.map((row) => `${row.repoFullName}\n${row.name}`))
    const saved = await secretsRepository.bulkUpsertSecrets(userId, itemsToUpsert)
    const isKnown = (item: { name: string; repoFullName: string }) =>
        known.has(`${item.repoFullName}\n${item.name}`)
    for (const [action, items] of [
        ['secret.created', itemsToUpsert.filter((item) => !isKnown(item))],
        ['secret.updated', itemsToUpsert.filter(isKnown)],
    ] as const) {
        if (items.length === 0) continue
        const target = items.map((item) => item.name).join(', ')
        await auditService.recordForUser({ userId, action, target })
    }
    return saved
}

const getSecrets = async (data: GetSecrets) => {
    const { userId } = data
    const secrets = await secretsRepository.findSecretsByUser(userId)
    return secrets.map((secret) => ({
        ...secret,
        repoFullName: toApiRepo(secret.repoFullName ?? ''),
    }))
}

const getSecretValue = async (data: GetSecretValue) => {
    const { userId, name, repoFullName } = data
    const secret = await secretsRepository.findSecretByName(
        userId,
        name,
        toStoredRepo(repoFullName)
    )
    if (!secret) throw new AppError('Secret not found', 404)
    const decryptedValue = decrypt({ encryptedText: secret.value })
    return {
        id: secret.id,
        name: secret.name,
        value: decryptedValue,
        note: secret.note,
        repoFullName: toApiRepo(secret.repoFullName ?? ''),
        createdAt: secret.createdAt,
        updatedAt: secret.updatedAt,
    }
}

const deleteSecret = async (data: DeleteSecret) => {
    const { userId, name, repoFullName } = data
    const repo = toStoredRepo(repoFullName)
    const existing = await secretsRepository.findSecretByName(userId, name, repo)
    if (!existing) throw new AppError('Secret not found', 404)
    const deleted = await secretsRepository.deleteSecret(userId, name, repo)
    await auditService.recordForUser({ userId, action: 'secret.deleted', target: name })
    return deleted
}

const getAllDecryptedSecrets = async (
    data: GetAllDecryptedSecrets
): Promise<DecryptedSecretItem[]> => {
    const { userId, repoFullName, sessionId } = data
    // the repository of the run: the one given, or the one of the user's session
    const repo = toStoredRepo(
        repoFullName ||
            (sessionId
                ? toSessionRepoFullName(await secretsRepository.findSessionRepo(userId, sessionId))
                : null)
    )
    const rows = await secretsRepository.findSecretsWithValuesByUser(userId, repo)
    // "all repositories" rows plus the rows of this repository; the repository value wins
    const secrets = pickSecretsForRepository(rows, repo)
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
