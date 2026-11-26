import { prisma } from '@december/database'

/** C2: accounts made since a time, to set against the landing page visits. */
const countSignupsSince = async (since: Date) =>
    prisma.user.count({ where: { createdAt: { gte: since } } })

export const admincloudflareRepository = {
    countSignupsSince,
}
