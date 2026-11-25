import { createSign } from 'node:crypto'

import type { InstallationTokenParams } from './github'

const base64Url = (input: string | Buffer) =>
    Buffer.from(input).toString('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_')

// the private key comes from an env var: either PEM text with escaped newlines or base64 PEM
export const normalizeGithubAppPrivateKey = (privateKey: string): string =>
    privateKey.includes('-----BEGIN')
        ? privateKey.replace(/\\n/g, '\n')
        : Buffer.from(privateKey, 'base64').toString('utf8')

/**
 * The GitHub App's own JWT (RS256, 10 minutes), used only to ask GitHub for an
 * installation token. Server and worker both sign it, so it uses node:crypto only.
 */
export const createGithubAppJwt = (data: { appId: string; privateKey: string; now?: number }) => {
    const { appId, privateKey, now = Math.floor(Date.now() / 1000) } = data
    const header = base64Url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))
    const payload = base64Url(JSON.stringify({ iat: now - 60, exp: now + 10 * 60, iss: appId }))
    const signer = createSign('RSA-SHA256')
    signer.update(`${header}.${payload}`)
    const signature = base64Url(signer.sign(normalizeGithubAppPrivateKey(privateKey)))
    return `${header}.${payload}.${signature}`
}

// a token for one installation; it lasts one hour
export async function createInstallationToken(
    params: InstallationTokenParams
): Promise<{ token: string; expiresAt: string }> {
    const { appId, privateKey, installationId } = params
    const appJwt = createGithubAppJwt({ appId, privateKey })

    const response = await fetch(
        `https://api.github.com/app/installations/${installationId}/access_tokens`,
        {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${appJwt}`,
                Accept: 'application/vnd.github+json',
                'X-GitHub-Api-Version': '2022-11-28',
                'User-Agent': 'December-App',
            },
        }
    )

    if (!response.ok) {
        const errorText = await response.text()
        throw new Error(
            `Failed to create installation access token (${response.status}): ${errorText}`
        )
    }

    const json = (await response.json()) as { token: string; expires_at: string }
    return { token: json.token, expiresAt: json.expires_at }
}
