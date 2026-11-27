import { prisma } from '@december/database'

import type { GitProviderName } from '@december/shared/git'

const PROVIDER_NAMES: Record<GitProviderName, string> = { GITHUB: 'GitHub', GITLAB: 'GitLab' }

/**
 * N5: the git host token could not be renewed, so the run works on a local branch only. One
 * "Reconnect GitLab" item in the inbox while it stays unread, not one per run. The same
 * title and link as the server's notice, so the two never stack.
 */
export const notifyReconnect = async (data: { userId: string; provider: GitProviderName }) => {
    const { userId, provider } = data
    const name = PROVIDER_NAMES[provider] ?? provider
    const title = `Reconnect ${name}`
    const link = '/settings/connections'

    const pending = await prisma.notification.findFirst({
        where: { userId, title, link, isRead: false },
        select: { id: true },
    })
    if (pending) return null

    return prisma.notification.create({
        data: {
            userId,
            title,
            message: `December could not renew your ${name} sign-in. Connect it again.`,
            type: 'WARNING',
            category: 'GENERAL',
            link,
        },
        select: { id: true },
    })
}
