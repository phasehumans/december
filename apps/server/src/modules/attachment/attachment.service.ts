import { randomUUID } from 'node:crypto'

import {
    ATTACHMENT_MAX_BYTES,
    ATTACHMENT_MAX_FILES,
    ATTACHMENT_SESSION_MAX_BYTES,
    safeAttachmentName,
} from '@december/shared'

import { AppError } from '../../shared/appError'
import { deleteObject, deletePrefix, putBinaryFile } from '../../shared/project-storage'

import { attachmentRepository } from './attachment.repository'
import { attachmentFileKey, attachmentPrefix, resolveAttachmentType } from './attachment.utils'

import type {
    AttachToPrompt,
    DeleteSessionFiles,
    GetSessionAttachments,
    PromptAttachment,
    RemoveAttachment,
    UploadAttachment,
} from './attachment.types'
import type { AttachmentInfo } from '@december/shared'

/**
 * Stores one file for a session of the user. The file waits there until a prompt names
 * its id. The size and the type are checked here from the bytes and the name.
 */
const uploadAttachment = async (data: UploadAttachment): Promise<AttachmentInfo> => {
    const { userId, sessionId, name, content } = data

    const session = await attachmentRepository.findOwnedSession(sessionId, userId)
    if (!session) throw new AppError('Session not found', 404)

    if (content.length === 0) throw new AppError('the file is empty', 400)
    if (content.length > ATTACHMENT_MAX_BYTES) {
        throw new AppError('the file is larger than 5 MB', 413)
    }

    const safeName = safeAttachmentName(name)
    const contentType = resolveAttachmentType({ name: safeName, content })
    if (!contentType) {
        throw new AppError('this file type is not allowed. send an image or a text file', 415)
    }

    const usedBytes = await attachmentRepository.sumSessionBytes(sessionId)
    if (usedBytes + content.length > ATTACHMENT_SESSION_MAX_BYTES) {
        throw new AppError('this session has no room for more files (50 MB for each session)', 413)
    }

    const id = randomUUID()
    const fileKey = attachmentFileKey(sessionId, id, safeName)
    await putBinaryFile({ key: fileKey, content, contentType })
    try {
        const row = await attachmentRepository.createAttachment({
            id,
            sessionId,
            name: safeName,
            contentType,
            sizeBytes: content.length,
            fileKey,
        })
        return {
            id: row.id,
            name: row.name,
            contentType: row.contentType,
            sizeBytes: row.sizeBytes,
        }
    } catch (error) {
        // no row points at the stored bytes, so they go again
        await deleteObject(fileKey).catch((cleanupError: unknown) => {
            console.warn('[Attachment] could not remove a file with no row:', cleanupError)
        })
        throw error
    }
}

/**
 * Removes a file that waits for a prompt, so its bytes no longer count to the session
 * cap. A file that a sent message has stays.
 */
const removeAttachment = async (data: RemoveAttachment) => {
    const { userId, sessionId, attachmentId } = data

    const attachment = await attachmentRepository.findOwnedAttachment({
        sessionId,
        userId,
        attachmentId,
    })
    if (!attachment) throw new AppError('Attachment not found', 404)
    if (attachment.messageId) throw new AppError('this file is part of a sent message', 409)

    const removed = await attachmentRepository.deleteWaitingAttachment({ sessionId, attachmentId })
    // a prompt took the file between the two queries
    if (removed === 0) throw new AppError('this file is part of a sent message', 409)

    // the row is gone. bytes that stay go with the session, so this never fails the request
    await deleteObject(attachment.fileKey).catch((error: unknown) => {
        console.warn('[Attachment] could not remove the bytes of a removed file:', error)
    })
}

/**
 * Ties the files a prompt names to its saved user message, and gives what the worker
 * needs to put them in the sandbox. An id that is not a waiting file of this session of
 * this user is left out.
 */
const attachToPrompt = async (data: AttachToPrompt): Promise<PromptAttachment[]> => {
    const { userId, sessionId, attachmentIds, sequence } = data
    if (!userId || !sequence || attachmentIds.length === 0) return []

    const message = await attachmentRepository.findOwnedUserMessage({ sessionId, userId, sequence })
    if (!message) return []

    const ids = [...new Set(attachmentIds)].slice(0, ATTACHMENT_MAX_FILES)
    const rows = await attachmentRepository.claimForMessage({
        sessionId,
        ids,
        messageId: message.id,
    })
    return rows.map((row) => ({
        id: row.id,
        name: row.name,
        key: row.fileKey,
        contentType: row.contentType,
        sizeBytes: row.sizeBytes,
    }))
}

/** the files of each message of a session, by message id. the caller checks the owner */
const getSessionAttachments = async (
    data: GetSessionAttachments
): Promise<Record<string, AttachmentInfo[]>> => {
    const { sessionId } = data
    const rows = await attachmentRepository.findSentBySession(sessionId)
    const byMessage: Record<string, AttachmentInfo[]> = {}
    for (const row of rows) {
        if (!row.messageId) continue
        const files = (byMessage[row.messageId] ??= [])
        files.push({
            id: row.id,
            name: row.name,
            contentType: row.contentType,
            sizeBytes: row.sizeBytes,
        })
    }
    return byMessage
}

/**
 * Removes the stored files of sessions that are deleted. The rows go with the session.
 * It never fails the delete: the session wipe job removes the same prefix again.
 */
const deleteSessionFiles = async (data: DeleteSessionFiles) => {
    const { sessionIds } = data
    for (const sessionId of sessionIds) {
        await deletePrefix(attachmentPrefix(sessionId)).catch((error: unknown) => {
            console.warn(`[Attachment] could not remove the files of session ${sessionId}:`, error)
        })
    }
}

export const attachmentService = {
    uploadAttachment,
    removeAttachment,
    attachToPrompt,
    getSessionAttachments,
    deleteSessionFiles,
}
