import { decryptText, encryptText } from '@december/shared/crypto'
import { SECRETS_PER_USER_MAX, isSandboxSecretName } from '@december/shared/secrets'

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
    SecretSummary,
    SecretWithDecryptedValue,
} from './secrets.types'

const UNREADABLE_SECRET = 'This secret could not be read. Save it again.'

const TOO_MANY_SECRETS = `You can keep up to ${SECRETS_PER_USER_MAX} secrets. Delete one to add another.`

const encrypt = (data: EncryptData): string => {
    const { text } = data
    return encryptText({ text, keyHex: env.SECRETS_ENC_KEY })
}

/**
 * The plain value of a stored secret. A row that does not open (a changed SECRETS_ENC_KEY,
 * a damaged row) is a fault of the server, not of the request, and the only fix is to save
 * the secret again. The error never holds a part of the row.
 */
const decrypt = (data: DecryptData): string => {
    const { encryptedText } = data
    try {
        return decryptText({ encryptedText, keyHex: env.SECRETS_ENC_KEY })
    } catch {
        // a bad format (EncryptedTextError) or a tag that does not match: the same answer
        throw new AppError(UNREADABLE_SECRET, 500)
    }
}

const createSecret = async (data: CreateSecret): Promise<SecretSummary> => {
    const { userId, name, value, note, repoFullName } = data
    const repo = toStoredRepo(repoFullName)
    const encryptedValue = encrypt({ text: value })
    // a secret with this name in this repository is there already: the save is an update
    const existing = await secretsRepository.findSecretByName(userId, name, repo)
    if (!existing) {
        const count = await secretsRepository.countSecretsByUser(userId)
        if (count >= SECRETS_PER_USER_MAX) throw new AppError(TOO_MANY_SECRETS, 400)
    }
    const secret = await secretsRepository.upsertSecret(userId, name, encryptedValue, note, repo)
    await auditService.recordForUser({
        userId,
        action: existing ? 'secret.updated' : 'secret.created',
        target: name,
        metadata: { repo: toApiRepo(repo) },
    })
    return { ...secret, repoFullName: toApiRepo(secret.repoFullName ?? '') }
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
    const keyOf = (item: { name: string; repoFullName: string }) =>
        `${item.repoFullName}\n${item.name}`

    // one name two times for one repository: which value wins is not clear, so refuse it
    const inList = new Set<string>()
    for (const item of itemsToUpsert) {
        if (inList.has(keyOf(item))) {
            throw new AppError(`${item.name} is in the list more than one time.`, 400)
        }
        inList.add(keyOf(item))
    }

    // the secrets that are there already: their save is an update, the others are new
    const before = await secretsRepository.findSecretsByUser(userId)
    const known = new Set(before.map(keyOf))
    const isKnown = (item: { name: string; repoFullName: string }) => known.has(keyOf(item))
    const created = itemsToUpsert.filter((item) => !isKnown(item))
    const updated = itemsToUpsert.filter(isKnown)
    if (before.length + created.length > SECRETS_PER_USER_MAX) {
        throw new AppError(TOO_MANY_SECRETS, 400)
    }

    // one transaction: every secret of the list is saved, or none is
    const saved = await secretsRepository.bulkUpsertSecrets(userId, itemsToUpsert)
    for (const [action, items] of [
        ['secret.created', created],
        ['secret.updated', updated],
    ] as const) {
        if (items.length === 0) continue
        const target = items.map((item) => item.name).join(', ')
        await auditService.recordForUser({ userId, action, target })
    }
    return { created: created.length, updated: updated.length, saved: saved.length }
}

const getSecrets = async (data: GetSecrets): Promise<SecretSummary[]> => {
    const { userId } = data
    const secrets = await secretsRepository.findSecretsByUser(userId)
    return secrets.map((secret) => ({
        ...secret,
        repoFullName: toApiRepo(secret.repoFullName ?? ''),
    }))
}

/** the plain value of one secret of the user. each read is kept in the audit log */
const getSecretValue = async (data: GetSecretValue): Promise<SecretWithDecryptedValue> => {
    const { userId, name, repoFullName, ip } = data
    const repo = toStoredRepo(repoFullName)
    const secret = await secretsRepository.findSecretByName(userId, name, repo)
    if (!secret) throw new AppError('Secret not found', 404)
    const decryptedValue = decrypt({ encryptedText: secret.value })
    await auditService.recordForUser({
        userId,
        action: 'secret.revealed',
        target: name,
        ip,
        metadata: { repo: toApiRepo(repo) },
    })
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
    // one query: a second delete of the same row finds nothing and gets a 404, not a 500
    const deleted = await secretsRepository.deleteSecret(userId, name, repo)
    if (deleted === 0) throw new AppError('Secret not found', 404)
    await auditService.recordForUser({
        userId,
        action: 'secret.deleted',
        target: name,
        metadata: { repo: toApiRepo(repo) },
    })
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
    // "all repositories" rows plus the rows of this repository; the repository value wins.
    // a row saved before the name rules with a system name (PATH) never reaches a sandbox
    const secrets = pickSecretsForRepository(rows, repo).filter((row) =>
        isSandboxSecretName(row.name)
    )
    const result: DecryptedSecretItem[] = []

    for (const item of secrets) {
        try {
            const decryptedValue = decrypt({ encryptedText: item.value })
            result.push({
                key: item.name,
                value: decryptedValue,
            })
        } catch {
            // Intentionally swallowed: a row that does not open is left out of the run, so
            // one damaged row does not stop the session. its name only is logged
            console.warn(`[Secrets] could not open the secret ${item.name}; it is left out`)
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
