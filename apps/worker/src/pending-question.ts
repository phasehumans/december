import { prisma } from '@december/database'

import type Redis from 'ioredis'

// the server marks a session as "needs answer" when the agent asks (AskQuestionPrompt).
// the worker clears it when the wait ends without the server (timeout) and when the run
// ends, then sends QuestionSettled so the server clears the cached sessions list too
export const clearPendingQuestion = async (
    sessionId: string,
    redis?: Pick<Redis, 'publish'> | null
) => {
    try {
        const result = await prisma.session.updateMany({
            // a session that asks about a spend limit keeps waiting: the limit stop ends its
            // run, and only the user's answer ends that question (#638)
            where: { id: sessionId, pendingQuestionAt: { not: null }, limitQuestionKind: null },
            data: { pendingQuestionAt: null },
        })
        if (result.count === 0 || !redis) return
        await redis.publish(
            `session_events:${sessionId}`,
            JSON.stringify({ type: 'QuestionSettled', sessionId })
        )
    } catch (error) {
        console.error('[WORKER] could not clear the pending question', error)
    }
}
