import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import { openUrl } from '../../../utils/open'

import type { SubscriptionAdapter, SubscriptionTokenBundle } from '../types'

const DEFAULT_REGION = 'us-east-1'
const DEFAULT_ENDPOINT = 'https://q.us-east-1.amazonaws.com'

export const amazonQAdapter: SubscriptionAdapter = {
    provider: 'amazon-q',
    displayName: 'Amazon Q Developer',

    async detectLocal(): Promise<SubscriptionTokenBundle | null> {
        // 1. Check environment variables
        const envToken =
            process.env.AMAZON_Q_TOKEN ||
            process.env.AWS_SSO_ACCESS_TOKEN ||
            process.env.AWS_BEARER_TOKEN

        if (envToken) {
            return {
                provider: 'amazon-q',
                accessToken: envToken,
                subscriptionType: 'amazon_q_pro',
                source: 'env',
                updatedAt: Date.now(),
                endpoint: DEFAULT_ENDPOINT,
                extra: { region: process.env.AWS_REGION || DEFAULT_REGION },
            }
        }

        // 2. Scan AWS SSO token cache directory (~/.aws/sso/cache/*.json)
        const home = process.env.HOME || os.homedir()
        const cacheDir = path.join(home, '.aws', 'sso', 'cache')

        try {
            const files = await fs.readdir(cacheDir)
            for (const file of files) {
                if (!file.endsWith('.json')) continue
                const filePath = path.join(cacheDir, file)
                try {
                    const raw = await fs.readFile(filePath, 'utf-8')
                    const parsed = JSON.parse(raw)

                    if (parsed.accessToken) {
                        let expiresAt: number | undefined
                        if (parsed.expiresAt) {
                            expiresAt = new Date(parsed.expiresAt).getTime()
                        }

                        return {
                            provider: 'amazon-q',
                            accessToken: parsed.accessToken,
                            refreshToken: parsed.refreshToken,
                            expiresAt,
                            subscriptionType: parsed.startUrl?.includes('awsapps.com')
                                ? 'amazon_q_pro'
                                : 'amazon_q_free',
                            source: 'local_import',
                            updatedAt: Date.now(),
                            endpoint: DEFAULT_ENDPOINT,
                            extra: {
                                filePath,
                                region: parsed.region || DEFAULT_REGION,
                                startUrl: parsed.startUrl,
                                clientId: parsed.clientId,
                                clientSecret: parsed.clientSecret,
                            },
                        }
                    }
                } catch {
                    // Intentionally swallowed: corrupt or unreadable cache file
                }
            }
        } catch {
            // Intentionally swallowed: AWS SSO cache directory does not exist
        }

        return null
    },

    async refreshToken(bundle: SubscriptionTokenBundle): Promise<SubscriptionTokenBundle> {
        if (!bundle.refreshToken) {
            return bundle
        }

        const region = bundle.extra?.region || DEFAULT_REGION
        const tokenUrl = `https://oidc.${region}.amazonaws.com/token`
        const clientId = bundle.extra?.clientId
        const clientSecret = bundle.extra?.clientSecret

        try {
            const bodyPayload: Record<string, string> = {
                grantType: 'refresh_token',
                refreshToken: bundle.refreshToken,
            }
            if (clientId) bodyPayload.clientId = clientId
            if (clientSecret) bodyPayload.clientSecret = clientSecret

            const res = await fetch(tokenUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(bodyPayload),
            })

            if (res.ok) {
                const data = (await res.json()) as any
                const newAccessToken = data.accessToken || data.access_token
                const newRefreshToken =
                    data.refreshToken || data.refresh_token || bundle.refreshToken
                const expiresIn = data.expiresIn || data.expires_in || 28800

                return {
                    ...bundle,
                    accessToken: newAccessToken,
                    refreshToken: newRefreshToken,
                    expiresAt: Date.now() + expiresIn * 1000,
                    updatedAt: Date.now(),
                }
            }
        } catch {
            // Intentionally swallowed: fallback to current token if refresh fails
        }

        return bundle
    },

    async loginOAuth(
        onCode?: (code: string, uri: string) => void
    ): Promise<SubscriptionTokenBundle> {
        const region = process.env.AWS_REGION || DEFAULT_REGION
        const startUrl = process.env.AWS_SSO_START_URL || 'https://view.awsapps.com/start'
        const oidcBase = `https://oidc.${region}.amazonaws.com`

        // 1. Register client
        const regRes = await fetch(`${oidcBase}/client/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                clientName: 'december-cli',
                clientType: 'public',
            }),
        })

        if (!regRes.ok) {
            const errText = await regRes.text().catch(() => '')
            throw new Error(`AWS SSO client registration failed (${regRes.status}): ${errText}`)
        }

        const regData = (await regRes.json()) as any
        const clientId = regData.clientId
        const clientSecret = regData.clientSecret

        // 2. Start device authorization
        const authRes = await fetch(`${oidcBase}/device_authorization`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                clientId,
                clientSecret,
                startUrl,
            }),
        })

        if (!authRes.ok) {
            const errText = await authRes.text().catch(() => '')
            throw new Error(`AWS SSO device authorization failed (${authRes.status}): ${errText}`)
        }

        const authData = (await authRes.json()) as any
        const deviceCode = authData.deviceCode
        const userCode = authData.userCode
        const verificationUri = authData.verificationUri
        const verificationUriComplete =
            authData.verificationUriComplete || `${verificationUri}?user_code=${userCode}`
        const intervalMs = Math.max((authData.interval || 1) * 1000, 50)
        const expiresInSec = authData.expiresIn || 600

        if (onCode) {
            onCode(userCode, verificationUriComplete)
        } else {
            try {
                await openUrl(verificationUriComplete)
            } catch {
                // Intentionally swallowed: browser launch fallback handled
            }
        }

        // 3. Poll token endpoint
        const deadline = Date.now() + expiresInSec * 1000
        while (Date.now() < deadline) {
            await new Promise((r) => setTimeout(r, intervalMs))

            try {
                const tokenRes = await fetch(`${oidcBase}/token`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        grantType: 'urn:ietf:params:oauth:grant-type:device_code',
                        deviceCode,
                        clientId,
                        clientSecret,
                    }),
                })

                if (tokenRes.ok) {
                    const tokenData = (await tokenRes.json()) as any
                    const accessToken = tokenData.accessToken || tokenData.access_token
                    const refreshToken = tokenData.refreshToken || tokenData.refresh_token
                    const expiresIn = tokenData.expiresIn || tokenData.expires_in || 28800

                    return {
                        provider: 'amazon-q',
                        accessToken,
                        refreshToken,
                        expiresAt: Date.now() + expiresIn * 1000,
                        subscriptionType: startUrl.includes('awsapps.com')
                            ? 'amazon_q_pro'
                            : 'amazon_q_free',
                        source: 'oauth_login',
                        updatedAt: Date.now(),
                        endpoint: DEFAULT_ENDPOINT,
                        extra: {
                            region,
                            startUrl,
                            clientId,
                            clientSecret,
                        },
                    }
                }

                const errJson = (await tokenRes.json().catch(() => ({}))) as any
                const errType = errJson.error || ''
                if (errType === 'authorization_pending') {
                    continue
                }
                if (errType === 'slow_down') {
                    await new Promise((r) => setTimeout(r, intervalMs))
                    continue
                }
                if (errType === 'expired_token' || errType === 'access_denied') {
                    throw new Error(`AWS SSO authorization failed: ${errType}`)
                }
            } catch (pollErr: any) {
                if (pollErr.message?.includes('AWS SSO authorization failed')) {
                    throw pollErr
                }
                // Intentionally swallowed: transient network retry during polling
            }
        }

        throw new Error('AWS SSO device authorization timed out.')
    },

    async verifyToken(bundle?: SubscriptionTokenBundle | null): Promise<boolean> {
        if (!bundle || !bundle.accessToken) return false
        if (bundle.expiresAt && bundle.expiresAt < Date.now() && !bundle.refreshToken) {
            return false
        }
        return true
    },
}
