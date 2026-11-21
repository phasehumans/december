import http from 'node:http'
import https from 'node:https'

import { loadConfig, saveConfig } from '../config'

import { isNewerVersion } from './semver'

const DEFAULT_REGISTRY = 'https://registry.npmjs.org/'

/**
 * Registry URL for the dist-tag lookup. Respects npm_config_registry so users on a
 * mirror or private registry query the same place `npm install` will use.
 */
export function getRegistryUrl(env: Record<string, string | undefined> = process.env): string {
    const configured = env.npm_config_registry || env.NPM_CONFIG_REGISTRY || DEFAULT_REGISTRY
    const base = configured.endsWith('/') ? configured : `${configured}/`
    return `${base}@trydecember%2fcli/latest`
}

export const CHECK_TTL_MS = 4 * 60 * 60 * 1000 // 4 hours in milliseconds

export { isNewerVersion }

export interface CheckVersionOptions {
    bypassCache?: boolean
}

export async function checkForLatestVersion(
    currentVersion: string,
    options?: CheckVersionOptions
): Promise<string | null> {
    try {
        const config = await loadConfig()
        const now = Date.now()

        // 1. Check local config cache if bypassCache is not requested (4-hour TTL)
        if (!options?.bypassCache && config.versionCheckCache) {
            const { latestVersion, checkedAt } = config.versionCheckCache
            if (now - checkedAt < CHECK_TTL_MS) {
                if (latestVersion && isNewerVersion(currentVersion, latestVersion)) {
                    return latestVersion
                }
                return null
            }
        }

        // 2. Fetch fresh version from registry
        const freshLatest = await fetchLatestFromNpm()
        if (freshLatest) {
            config.versionCheckCache = {
                latestVersion: freshLatest,
                checkedAt: now,
            }
            await saveConfig(config).catch(() => {
                // Intentionally swallowed: config save failure should not block check
            })

            if (isNewerVersion(currentVersion, freshLatest)) {
                return freshLatest
            }
        }
    } catch {
        // Fallback gracefully on config read or network error
    }

    return null
}

export function fetchLatestFromNpm(): Promise<string | null> {
    return new Promise((resolve) => {
        const url = getRegistryUrl()
        const client = url.startsWith('http:') ? http : https
        const req = client.get(
            url,
            { timeout: 5000, headers: { accept: 'application/json' } },
            (res) => {
                if (res.statusCode !== 200) {
                    resolve(null)
                    return
                }
                let data = ''
                res.on('data', (chunk) => {
                    data += chunk
                })
                res.on('end', () => {
                    try {
                        const parsed = JSON.parse(data)
                        const latest = parsed.version
                        if (latest && typeof latest === 'string') {
                            resolve(latest)
                        } else {
                            resolve(null)
                        }
                    } catch {
                        resolve(null)
                    }
                })
            }
        )

        req.on('error', () => resolve(null))
        req.on('timeout', () => {
            req.destroy()
            resolve(null)
        })
    })
}

export async function clearVersionCheckCache(): Promise<void> {
    try {
        const config = await loadConfig()
        if (config.versionCheckCache) {
            delete config.versionCheckCache
            await saveConfig(config)
        }
    } catch {
        // Intentionally swallowed: a stale cache only delays the update notice
    }
}
