import * as sessionRepository from './session.repository'

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
    if (!session) throw new Error('Session not found')
    return session
}

export async function createSession(
    userId: string,
    data: { title?: string; projectId?: string; type?: 'WEB' | 'CLI' | 'SEARCH' }
) {
    // const activeSessions = await sessionRepository.countActiveSessions(userId)
    // if (activeSessions >= 1) {
    //     throw new Error('You have reached the maximum number of concurrent sessions. Please stop an active session first.')
    // }

    return sessionRepository.createSession({
        userId,
        title: data.title,
        projectId: data.projectId,
        type: data.type || 'WEB',
        vmStatus: 'RUNNING', // Automatically marking as RUNNING on creation for constraints
    })
}

export async function updateSession(
    sessionId: string,
    userId: string,
    data: { title?: string; projectId?: string }
) {
    return sessionRepository.updateSession(sessionId, userId, data)
}
