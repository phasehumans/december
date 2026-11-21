import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

export type ExtensionPreferenceKind = 'plugin' | 'skill'
export type ExtensionPreferenceScope = 'user' | 'project'

export interface ExtensionPreferences {
    plugins: Record<string, boolean>
    skills: Record<string, boolean>
}

export interface ExtensionPathOptions {
    homeDir?: string
    workspaceDir?: string
}

/**
 * The user-level December directory. An explicit home directory wins (tests and
 * embedders pass one), then DECEMBER_CONFIG_DIR, then ~/.december.
 */
export function getDecemberDir(homeDir?: string): string {
    if (homeDir) return path.join(homeDir, '.december')
    return process.env.DECEMBER_CONFIG_DIR || path.join(os.homedir(), '.december')
}

export function getUserConfigPath(homeDir?: string): string {
    return path.join(getDecemberDir(homeDir), 'config.json')
}

export function getProjectSettingsPath(workspaceDir: string = process.cwd()): string {
    return path.join(workspaceDir, '.december', 'settings.json')
}

function readJsonObjectSync(filePath: string): Record<string, any> {
    try {
        const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'))
        return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {}
    } catch {
        // Intentionally swallowed: a missing or malformed file means no preferences
        return {}
    }
}

function readEnabledMap(value: unknown): Record<string, boolean> {
    const result: Record<string, boolean> = {}
    if (!value || typeof value !== 'object' || Array.isArray(value)) return result
    for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
        if (typeof entry === 'boolean') {
            result[key] = entry
        } else if (entry && typeof entry === 'object' && 'enabled' in entry) {
            result[key] = Boolean((entry as { enabled: unknown }).enabled)
        }
    }
    return result
}

/**
 * On/off preferences for plugins and skills. User config is read first and the
 * project settings file overrides it, so a project can turn off its own items
 * without touching other repositories.
 */
export function readExtensionPreferences(options: ExtensionPathOptions = {}): ExtensionPreferences {
    const user = readJsonObjectSync(getUserConfigPath(options.homeDir))
    const project = options.workspaceDir
        ? readJsonObjectSync(getProjectSettingsPath(options.workspaceDir))
        : {}

    return {
        plugins: { ...readEnabledMap(user.plugins), ...readEnabledMap(project.plugins) },
        skills: { ...readEnabledMap(user.skills), ...readEnabledMap(project.skills) },
    }
}

export async function writeExtensionPreference(
    data: {
        kind: ExtensionPreferenceKind
        id: string
        enabled: boolean
        scope: ExtensionPreferenceScope
    } & ExtensionPathOptions
): Promise<void> {
    const { kind, id, enabled, scope, homeDir, workspaceDir } = data
    const filePath =
        scope === 'project'
            ? getProjectSettingsPath(workspaceDir || process.cwd())
            : getUserConfigPath(homeDir)
    const key = kind === 'plugin' ? 'plugins' : 'skills'

    const config = readJsonObjectSync(filePath)
    const section =
        config[key] && typeof config[key] === 'object' && !Array.isArray(config[key])
            ? config[key]
            : {}
    section[id] = { ...(typeof section[id] === 'object' ? section[id] : {}), enabled }
    config[key] = section

    await fs.promises.mkdir(path.dirname(filePath), { recursive: true })
    await fs.promises.writeFile(filePath, JSON.stringify(config, null, 2) + '\n', 'utf8')
}
