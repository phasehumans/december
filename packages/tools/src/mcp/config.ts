import fsSync from 'node:fs'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import type { LoadMcpConfigOptions, McpServerConfig } from './types'

export function normalizeMcpServerConfig(name: string, raw: any): McpServerConfig | null {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
        return null
    }

    const disabled = Boolean(raw.disabled)
    const description = typeof raw.description === 'string' ? raw.description : undefined

    if (typeof raw.command === 'string' && raw.command.trim().length > 0) {
        const args = Array.isArray(raw.args) ? raw.args.map(String) : undefined
        const env =
            raw.env && typeof raw.env === 'object' && !Array.isArray(raw.env)
                ? Object.fromEntries(Object.entries(raw.env).map(([k, v]) => [k, String(v ?? '')]))
                : undefined
        const cwd = typeof raw.cwd === 'string' ? raw.cwd : undefined

        return {
            command: raw.command.trim(),
            ...(args ? { args } : {}),
            ...(env ? { env } : {}),
            ...(cwd ? { cwd } : {}),
            ...(disabled ? { disabled } : {}),
            ...(description ? { description } : {}),
        }
    }

    const urlCandidate = raw.url || raw.endpoint || raw.sse
    if (typeof urlCandidate === 'string' && urlCandidate.trim().length > 0) {
        const headers =
            raw.headers && typeof raw.headers === 'object' && !Array.isArray(raw.headers)
                ? Object.fromEntries(
                      Object.entries(raw.headers).map(([k, v]) => [k, String(v ?? '')])
                  )
                : undefined

        return {
            url: urlCandidate.trim(),
            ...(headers ? { headers } : {}),
            ...(disabled ? { disabled } : {}),
            ...(description ? { description } : {}),
        }
    }

    return null
}

function parseMcpJsonContent(content: string): Record<string, McpServerConfig> {
    try {
        const parsed = JSON.parse(content)
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
            return {}
        }

        const result: Record<string, McpServerConfig> = {}
        const serverSource =
            parsed.mcpServers &&
            typeof parsed.mcpServers === 'object' &&
            !Array.isArray(parsed.mcpServers)
                ? parsed.mcpServers
                : parsed

        for (const [key, val] of Object.entries(serverSource)) {
            const normalized = normalizeMcpServerConfig(key, val)
            if (normalized) {
                result[key] = normalized
            }
        }

        return result
    } catch {
        // Intentionally swallowed: malformed json is ignored gracefully
        return {}
    }
}

export async function loadMcpConfig(
    options?: LoadMcpConfigOptions
): Promise<Record<string, McpServerConfig>> {
    const home = options?.homeDir || process.env.HOME || process.env.USERPROFILE || os.homedir()
    const workspace = options?.workspaceDir || process.cwd()

    const merged: Record<string, McpServerConfig> = {}

    // 1. Load global config from ~/.december/config.json (or options.globalConfigPath)
    const globalConfigPath =
        options?.globalConfigPath ||
        (process.env.DECEMBER_CONFIG_DIR
            ? path.join(process.env.DECEMBER_CONFIG_DIR, 'config.json')
            : path.join(home, '.december', 'config.json'))

    try {
        const globalRaw = await fs.readFile(globalConfigPath, 'utf8')
        const globalJson = JSON.parse(globalRaw)
        const globalServers = globalJson?.mcpServers || globalJson?.mcp
        if (globalServers && typeof globalServers === 'object') {
            for (const [key, val] of Object.entries(globalServers)) {
                const norm = normalizeMcpServerConfig(key, val)
                if (norm) {
                    merged[key] = norm
                }
            }
        }
    } catch {
        // Intentionally swallowed: global config is optional
    }

    // 2. Load workspace config from <workspace>/.december/mcp.json
    const projectMcpPath = path.join(workspace, '.december', 'mcp.json')
    try {
        const projectRaw = await fs.readFile(projectMcpPath, 'utf8')
        const projectConfigs = parseMcpJsonContent(projectRaw)
        for (const [key, val] of Object.entries(projectConfigs)) {
            merged[key] = val
        }
    } catch {
        // Intentionally swallowed: project mcp.json is optional
    }

    // 3. Fallback: check <workspace>/.december/settings.json for mcpServers
    const projectSettingsPath = path.join(workspace, '.december', 'settings.json')
    try {
        const settingsRaw = await fs.readFile(projectSettingsPath, 'utf8')
        const settingsJson = JSON.parse(settingsRaw)
        if (settingsJson?.mcpServers && typeof settingsJson.mcpServers === 'object') {
            for (const [key, val] of Object.entries(settingsJson.mcpServers)) {
                const norm = normalizeMcpServerConfig(key, val)
                if (norm) {
                    merged[key] = norm
                }
            }
        }
    } catch {
        // Intentionally swallowed: settings.json is optional
    }

    return merged
}

export function loadMcpConfigSync(options?: LoadMcpConfigOptions): Record<string, McpServerConfig> {
    const home = options?.homeDir || process.env.HOME || process.env.USERPROFILE || os.homedir()
    const workspace = options?.workspaceDir || process.cwd()

    const merged: Record<string, McpServerConfig> = {}

    const globalConfigPath =
        options?.globalConfigPath ||
        (process.env.DECEMBER_CONFIG_DIR
            ? path.join(process.env.DECEMBER_CONFIG_DIR, 'config.json')
            : path.join(home, '.december', 'config.json'))

    try {
        if (fsSync.existsSync(globalConfigPath)) {
            const globalRaw = fsSync.readFileSync(globalConfigPath, 'utf8')
            const globalJson = JSON.parse(globalRaw)
            const globalServers = globalJson?.mcpServers || globalJson?.mcp
            if (globalServers && typeof globalServers === 'object') {
                for (const [key, val] of Object.entries(globalServers)) {
                    const norm = normalizeMcpServerConfig(key, val)
                    if (norm) {
                        merged[key] = norm
                    }
                }
            }
        }
    } catch {
        // Intentionally swallowed: global config is optional
    }

    const projectMcpPath = path.join(workspace, '.december', 'mcp.json')
    try {
        if (fsSync.existsSync(projectMcpPath)) {
            const projectRaw = fsSync.readFileSync(projectMcpPath, 'utf8')
            const projectConfigs = parseMcpJsonContent(projectRaw)
            for (const [key, val] of Object.entries(projectConfigs)) {
                merged[key] = val
            }
        }
    } catch {
        // Intentionally swallowed: project mcp.json is optional
    }

    const projectSettingsPath = path.join(workspace, '.december', 'settings.json')
    try {
        if (fsSync.existsSync(projectSettingsPath)) {
            const settingsRaw = fsSync.readFileSync(projectSettingsPath, 'utf8')
            const settingsJson = JSON.parse(settingsRaw)
            if (settingsJson?.mcpServers && typeof settingsJson.mcpServers === 'object') {
                for (const [key, val] of Object.entries(settingsJson.mcpServers)) {
                    const norm = normalizeMcpServerConfig(key, val)
                    if (norm) {
                        merged[key] = norm
                    }
                }
            }
        }
    } catch {
        // Intentionally swallowed: settings.json is optional
    }

    return merged
}
