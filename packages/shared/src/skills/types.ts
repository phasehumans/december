export interface SkillMetadata {
    name: string
    description: string
    argumentHint?: string
    license?: string
    tags?: string[]
    model?: {
        recommended?: string
        temperature?: number
    }
    disable?: boolean
    dependencies?: {
        bins?: string[]
        skills?: string[]
    }
    allowedTools?: string[]
}

export type SkillOrigin =
    | 'workspace'
    | 'declared'
    | 'workspace-plugin'
    | 'global'
    | 'global-plugin'
    | 'builtin'

export interface DiscoveredSkill {
    name: string
    metadata: SkillMetadata
    directoryPath: string
    entryFilePath: string // Absolute path to SKILL.md
    origin: SkillOrigin
    scripts: string[]
    references: string[]
    examples?: string[]
    resources?: string[]
    /** Folder name of the plugin that ships this skill, when it comes from a plugin */
    pluginId?: string
    /** False when the skill or its plugin is turned off. Only set by discovery. */
    enabled?: boolean
}

export interface SkillsConfigEntry {
    path: string
    include_only?: string[]
    exclude?: string[]
}

export interface SkillsConfigFile {
    inherits?: SkillsConfigEntry[]
    entries?: SkillsConfigEntry[]
}
