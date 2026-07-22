import crypto from 'crypto'

import { githubAppRepository } from './githubapp.repository'

export async function processInstallation(installationId: string, userId: string) {
    return githubAppRepository.upsertInstallation(installationId, userId)
}

export async function processUninstallation(installationId: string) {
    return githubAppRepository.deleteInstallation(installationId)
}

export function verifySignature(payload: string, signature: string) {
    const secret = process.env.GITHUB_APP_WEBHOOK_SECRET || 'secret'
    const hmac = crypto.createHmac('sha256', secret)
    hmac.update(payload)
    const expected = `sha256=${hmac.digest('hex')}`
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))
}

export const githubAppService = {
    processInstallation,
    processUninstallation,
    verifySignature,
}
