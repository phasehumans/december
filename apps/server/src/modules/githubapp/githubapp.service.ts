import crypto from 'crypto'

import { githubAppRepository } from './githubapp.repository'

import type { ProcessInstallation, ProcessUninstallation, VerifySignature } from './githubapp.types'

const processInstallation = async (data: ProcessInstallation) => {
    const { installationId, userId } = data
    return githubAppRepository.upsertInstallation(installationId, userId)
}

const processUninstallation = async (data: ProcessUninstallation) => {
    const { installationId } = data
    return githubAppRepository.deleteInstallation(installationId)
}

const verifySignature = (data: VerifySignature) => {
    const { payload, signature } = data
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
