import { BYOK_PROVIDERS, ByokError, normalizeByokKey } from '@december/providers'
import { decryptText, encryptText } from '@december/shared/crypto'

import { env } from '../../env'
import { AppError } from '../../shared/appError'
import { auditService } from '../audit/audit.service'

import { byokRepository } from './byok.repository'
import {
    buildKeyHint,
    byokUtils,
    cleanModelIds,
    providerName,
    redactKey,
    toCredentialSummary,
    verifyFailureMessage,
} from './byok.utils'

import type {
    AssertOwnKeyUsable,
    CheckKey,
    DeleteCredential,
    ListCredentials,
    RefreshCredential,
    SaveCredential,
} from './byok.types'

// asks the provider whether the key works and which models it serves. every message that
// leaves here has the key taken out, as some providers repeat it in their errors
const checkKey = async (data: CheckKey) => {
    const { provider, apiKey } = data
    let result
    try {
        result = await byokUtils.verifyKey({ provider, apiKey })
    } catch (error) {
        if (error instanceof ByokError) {
            throw new AppError(redactKey({ text: error.message, apiKey }), 400)
        }
        // an unknown failure: do not pass its text on, it may hold the request
        console.error('[BYOK] key check failed:', error instanceof Error ? error.name : 'error')
        throw new AppError(
            `December could not reach ${providerName(provider)} to check the key. Try again.`,
            502
        )
    }
    if (!result.ok) {
        throw new AppError(
            verifyFailureMessage({
                providerName: providerName(provider),
                reason: result.reason,
                ...(result.message ? { message: redactKey({ text: result.message, apiKey }) } : {}),
            }),
            400
        )
    }
    const models = cleanModelIds(result.models)
    const defaultModel = models.includes(result.defaultModel) ? result.defaultModel : models[0]
    if (!defaultModel) {
        throw new AppError(
            verifyFailureMessage({ providerName: providerName(provider), reason: 'no_endpoint' }),
            400
        )
    }
    return { models, defaultModel }
}

const listCredentials = async (data: ListCredentials) => {
    const { userId } = data
    const rows = await byokRepository.findCredentialsByUser(userId)
    return { providers: BYOK_PROVIDERS, credentials: rows.map(toCredentialSummary) }
}

const saveCredential = async (data: SaveCredential) => {
    const { userId, provider, apiKey } = data

    let key: string
    try {
        key = normalizeByokKey({ provider, apiKey })
    } catch (error) {
        if (error instanceof ByokError)
            throw new AppError(redactKey({ text: error.message, apiKey }), 400)
        throw error
    }

    const verified = await checkKey({ provider, apiKey: key })
    const row = await byokRepository.upsertCredential({
        userId,
        provider,
        encryptedKey: encryptText({ text: key, keyHex: env.SECRETS_ENC_KEY }),
        keyHint: buildKeyHint(provider, key),
        models: verified.models,
        defaultModel: verified.defaultModel,
        verifiedAt: new Date(),
    })
    await auditService.recordForUser({ userId, action: 'key.created', target: provider })
    return toCredentialSummary(row)
}

const refreshCredential = async (data: RefreshCredential) => {
    const { userId, provider } = data
    const stored = await byokRepository.findCredentialWithKey(userId, provider)
    if (!stored) throw new AppError(`no ${providerName(provider)} key saved`, 404)

    let key: string
    try {
        key = decryptText({ encryptedText: stored.encryptedKey, keyHex: env.SECRETS_ENC_KEY })
    } catch {
        // a rotated SECRETS_ENC_KEY or a damaged row: the only fix is to save the key again
        throw new AppError(
            `your saved ${providerName(provider)} key cannot be read. add it again`,
            400
        )
    }
    const verified = await checkKey({ provider, apiKey: key })
    const verifiedAt = new Date()
    const isSaved = await byokRepository.updateVerification({
        userId,
        provider,
        encryptedKey: stored.encryptedKey,
        models: verified.models,
        defaultModel: verified.defaultModel,
        verifiedAt,
    })
    if (isSaved) {
        return toCredentialSummary({
            ...stored,
            models: verified.models,
            defaultModel: verified.defaultModel,
            verifiedAt,
        })
    }

    // the key was replaced or removed during the check: show what is saved now
    const current = await byokRepository.findCredentialSummary(userId, provider)
    if (!current) throw new AppError(`no ${providerName(provider)} key saved`, 404)
    return toCredentialSummary(current)
}

const deleteCredential = async (data: DeleteCredential) => {
    const { userId, provider } = data
    const deleted = await byokRepository.deleteCredential(userId, provider)
    if (deleted === 0) throw new AppError(`no ${providerName(provider)} key saved`, 404)
    await auditService.recordForUser({ userId, action: 'key.deleted', target: provider })
}

// gate for cloud runs that pay with the user's own key: a key must be saved for the
// provider and the model must be one that key serves
const assertOwnKeyUsable = async (data: AssertOwnKeyUsable) => {
    const { userId, provider, model } = data
    if (!provider) throw new AppError('choose a provider for your own key', 400)
    const credential = await byokRepository.findCredentialSummary(userId, provider)
    if (!credential) {
        throw new AppError(`add your ${providerName(provider)} key in settings first`, 400)
    }
    const summary = toCredentialSummary(credential)
    if (model && !summary.models.includes(model)) {
        throw new AppError(
            `${model} is not available with your ${providerName(provider)} key. Refresh the key or pick another model.`,
            400
        )
    }
    return summary
}

export const byokService = {
    listCredentials,
    saveCredential,
    refreshCredential,
    deleteCredential,
    assertOwnKeyUsable,
}
