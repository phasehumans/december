import { prisma } from '@december/database'

import type Redis from 'ioredis'

type AgentQuestionNotice = {
    sessionId: string
    question: string
    redis?: Pick<Redis, 'publish'> | null
}

// "December needs your input": the agent asked a question and waits for an answer.
// one unread notice per session at a time, so a run of questions does not flood the inbox
export const notifyAgentQuestion = async (data: AgentQuestionNotice) => {
    const { sessionId, question, redis } = data

    const session = await prisma.session.findUnique({
        where: { id: sessionId },
        select: { userId: true, title: true },
    })
    if (!session?.userId) return null

    const link = `/sessions/${sessionId}`
    const title = 'December needs your input'
    const pending = await prisma.notification.findFirst({
        where: { userId: session.userId, link, title, isRead: false },
        select: { id: true },
    })
    if (pending) return null

    const text = question.replace(/\s+/g, ' ').trim()
    const message = session.title ? `${session.title}: ${text}` : text
    const notification = await prisma.notification.create({
        data: {
            userId: session.userId,
            title,
            message: message.length > 280 ? `${message.slice(0, 279)}…` : message,
            type: 'WARNING',
            category: 'GENERAL',
            link,
        },
        select: {
            id: true,
            title: true,
            message: true,
            isRead: true,
            type: true,
            category: true,
            link: true,
            createdAt: true,
        },
    })

    // the server relays user_notifications:* to the user's open tabs (badge + toast)
    if (redis) {
        await redis
            .publish(
                `user_notifications:${session.userId}`,
                JSON.stringify({ notification, toast: true })
            )
            .catch(() => {
                // Intentionally swallowed: the inbox refetches its unread count every 30s
            })
    }

    return notification
}
