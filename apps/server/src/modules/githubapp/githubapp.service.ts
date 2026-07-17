import crypto from 'crypto'

import { prisma } from '@december/database'

export async function processInstallation(installationId: string, userId: string) {
    return prisma.githubAppInstallation.upsert({
        where: { installationId },
        update: { userId },
        create: {
            installationId,
            userId,
        },
    })
}

export async function processUninstallation(installationId: string) {
    return prisma.githubAppInstallation.delete({
        where: { installationId },
    })
}

export function verifySignature(payload: string, signature: string) {
    const secret = process.env.GITHUB_APP_WEBHOOK_SECRET || 'secret'
    const hmac = crypto.createHmac('sha256', secret)
    hmac.update(payload)
    const expected = `sha256=${hmac.digest('hex')}`
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))
}
