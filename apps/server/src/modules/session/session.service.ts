import crypto from 'crypto'
import { Queue } from 'bullmq'
import Redis from 'ioredis'
import { AppError } from '../../shared/appError'
import { getIO } from '../../socket'
import { publishEvent } from '@december/shared'
import { prisma } from '@december/database'

import {
    sessionPrefix,
    sessionWorkspacePrefix,
    listPrefix,
    getTextFile,
    copyObject,
    putTextFile,
} from '../../shared/project-storage'
import { hydrateCanvasDocument } from '../canvas/canvas.utils'
import * as sessionRepository from './session.repository'
import type {
    CreateSession,
    GetSession,
    UpdateSessionSettings,
    DeleteSession,
    DuplicateSession,
    GetCollaborators,
    AddCollaborator,
    RemoveCollaborator,
} from './session.types'

export const loadSessionFiles = async (sessionId: string) => {
    const prefix = sessionWorkspacePrefix(sessionId)
    const objects = await listPrefix(prefix)
    const files: Record<string, string> = {}

    await Promise.all(
        objects.map(async (obj) => {
            const key = obj.Key
            if (!key) return
            const relativePath = key.substring(prefix.length)

            if (!relativePath || relativePath.endsWith('/')) return

            const isBinary =
                relativePath.endsWith('.png') ||
                relativePath.endsWith('.jpg') ||
                relativePath.endsWith('.jpeg') ||
                relativePath.endsWith('.webp') ||
                relativePath.endsWith('.gif') ||
                relativePath.endsWith('.ico') ||
                relativePath.endsWith('.zip') ||
                relativePath.endsWith('.pdf')

            if (isBinary) {
                files[relativePath] = ''
                return
            }

            try {
                const content = await getTextFile(key)
                files[relativePath] = content ?? ''
            } catch (err) {
                console.error(`Failed to load file content for ${relativePath} (${key}):`, err)
                files[relativePath] = ''
            }
        })
    )

    return files
}

export async function getUserSessions(userId: string) {
    const sessions = await sessionRepository.findManySessions(userId)
    return sessions.map((session) => ({
        id: session.id,
        title:
            session.title ||
            (session.messages[0]
                ? session.messages[0].content.substring(0, 50) + '...'
                : 'New Chat'),
        type: session.type,
        createdAt: session.createdAt,
        updatedAt: session.updatedAt,
        projectId: session.projectId,
        projectName: session.project?.name,
        lastMessage: session.messages[0] ? session.messages[0].content : null,
    }))
}

export async function getSession(sessionId: string, userId: string) {
    const session = await sessionRepository.findSessionById(sessionId, userId)
    if (!session) throw new AppError('Session not found', 404)

    // Load generated files from S3
    const generatedFiles = await loadSessionFiles(sessionId)

    // Load canvas state from S3
    let canvasState = null
    try {
        const canvasContent = await getTextFile(`sessions/${sessionId}/canvas.json`)
        if (canvasContent) {
            canvasState = JSON.parse(canvasContent)
        }
    } catch (err) {
        console.error('Failed to load canvas state:', err)
    }

    const hydratedCanvas = await hydrateCanvasDocument(canvasState)

    return {
        session,
        chatMessages: session.messages.map((message) => ({
            id: message.id,
            role: message.role,
            content: message.content,
            status: message.status,
            sequence: message.sequence,
            createdAt: message.createdAt,
            updatedAt: message.updatedAt,
        })),
        generatedFiles,
        canvasState: hydratedCanvas,
    }
}

export async function createSession(data: CreateSession) {
    const { userId, title, projectId, type, prompt } = data

    // const activeSessions = await sessionRepository.countActiveSessions(userId)
    // if (activeSessions >= 3) {
    //     throw new AppError('Maximum concurrent active sessions limit reached', 400)
    // }

    const session = await sessionRepository.createSession({
        userId,
        title: title || 'New Session',
        projectId,
        type: type || 'WEB',
        vmStatus: 'RUNNING',
    })

    if (prompt) {
        await prisma.message.create({
            data: {
                sessionId: session.id,
                role: 'USER',
                content: prompt,
                sequence: 1,
            },
        })
    }

    return session
}

export async function updateSession(
    sessionId: string,
    userId: string,
    data: { title?: string; projectId?: string | null }
) {
    return sessionRepository.updateSession(sessionId, userId, data)
}

export async function updateSessionSettings(data: UpdateSessionSettings) {
    const { userId, sessionId, title, projectId, isPinned, isArchived, tags } = data

    const updateData: any = {}
    if (title !== undefined) updateData.title = title
    if (projectId !== undefined) updateData.projectId = projectId
    if (isPinned !== undefined) updateData.isPinned = isPinned
    if (isArchived !== undefined) updateData.isArchived = isArchived
    if (tags !== undefined) updateData.tags = tags

    return sessionRepository.updateSession(sessionId, userId, updateData)
}

export async function deleteSession(data: DeleteSession) {
    const { userId, sessionId } = data

    const owner = await sessionRepository.findSessionOwner(sessionId)
    if (!owner || owner.userId !== userId) {
        throw new AppError('Only the session creator can delete this session', 403)
    }

    // Cascade 1: Terminate running VM immediately
    await publishEvent(`session_events:${sessionId}`, { type: 'SIGKILL', data: {} })

    // Cascade 2: Disconnect WebSockets
    try {
        getIO().in(`session:${sessionId}`).disconnectSockets()
    } catch (e) {
        console.warn('Socket not connected or io not available', e)
    }

    // Cascade 3: Enqueue S3/MinIO wipe
    const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379')
    const minioWipeQueue = new Queue('minio_wipe', { connection: redis as any })
    await minioWipeQueue.add(
        'wipe',
        { prefix: sessionPrefix(sessionId) },
        { attempts: 3, backoff: { type: 'exponential', delay: 1000 } }
    )

    // Cascade 4: Delete database record
    await sessionRepository.deleteSession(sessionId)

    return { message: 'session deleted successfully' }
}

export async function duplicateSession(data: DuplicateSession) {
    const { userId, sessionId, title } = data

    const sourceSession = await sessionRepository.findSessionById(sessionId, userId)
    if (!sourceSession) {
        throw new AppError('Session not found', 404)
    }

    const newSession = await sessionRepository.createSession({
        userId,
        title: title || `Copy of ${sourceSession.title || 'Untitled Session'}`,
        projectId: sourceSession.projectId,
        type: sourceSession.type,
        vmStatus: 'RUNNING',
    })

    // Copy S3 files
    const prefix = sessionWorkspacePrefix(sessionId)
    const objects = await listPrefix(prefix)
    await Promise.all(
        objects.map(async (obj) => {
            const key = obj.Key
            if (!key) return
            const relativePath = key.substring(prefix.length)
            const destinationKey = `sessions/${newSession.id}/workspace/${relativePath}`
            await copyObject({ sourceKey: key, destinationKey })
        })
    )

    // Copy canvas.json if exists
    try {
        const sourceCanvasKey = `sessions/${sessionId}/canvas.json`
        const destinationCanvasKey = `sessions/${newSession.id}/canvas.json`
        await copyObject({
            sourceKey: sourceCanvasKey,
            destinationKey: destinationCanvasKey,
        }).catch(() => undefined)
    } catch (err) {
        // Silently skip if canvas doesn't exist
    }

    // Copy database messages
    if (sourceSession.messages.length > 0) {
        await prisma.message.createMany({
            data: sourceSession.messages.map((msg) => ({
                sessionId: newSession.id,
                role: msg.role,
                content: msg.content,
                status: msg.status,
                sequence: msg.sequence,
                createdAt: msg.createdAt,
            })),
        })
    }

    return newSession
}

export async function getCollaborators(data: GetCollaborators) {
    const { userId, sessionId } = data
    const session = await sessionRepository.findSessionById(sessionId, userId)
    if (!session) {
        throw new AppError('Session not found', 404)
    }
    return sessionRepository.findCollaboratorsBySessionId(sessionId)
}

export async function addCollaborator(data: AddCollaborator) {
    const { userId, sessionId, email } = data

    const owner = await sessionRepository.findSessionOwner(sessionId)
    if (!owner || owner.userId !== userId) {
        throw new AppError('Only the session creator can add collaborators', 403)
    }

    const targetUser = await sessionRepository.findUserByEmailOrUsername(email)
    if (!targetUser || targetUser.isDeleted) {
        throw new AppError('User not found', 404)
    }

    if (targetUser.id === userId) {
        throw new AppError('You cannot add yourself as a collaborator', 400)
    }

    const existingCollaborator = await sessionRepository.findCollaborator(
        sessionId,
        targetUser.email
    )
    if (existingCollaborator) {
        throw new AppError('User is already a collaborator on this session', 400)
    }

    const count = await sessionRepository.countCollaborators(sessionId)
    if (count >= 3) {
        throw new AppError('Maximum limit of 3 collaborators reached', 400)
    }

    return sessionRepository.addCollaborator(sessionId, targetUser.id, targetUser.email)
}

export async function removeCollaborator(data: RemoveCollaborator) {
    const { userId, sessionId, email } = data

    const owner = await sessionRepository.findSessionOwner(sessionId)
    if (!owner || owner.userId !== userId) {
        throw new AppError('Only the session creator can remove collaborators', 403)
    }

    const existingCollaborator = await sessionRepository.findCollaborator(sessionId, email)
    if (!existingCollaborator) {
        throw new AppError('Collaborator not found', 404)
    }

    await sessionRepository.removeCollaborator(sessionId, email)
    return { message: 'Collaborator removed successfully' }
}
