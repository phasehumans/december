import fsSync from 'fs'
import fs from 'fs/promises'
import path from 'path'

import { getDecemberDir, getUserConfigPath } from '@december/shared'

import { BUILT_IN_MARKETPLACE, BUILT_IN_MARKETPLACE_NAME } from './catalog'
import { cloneToTemp, removeTempClone, resolveSource, runGit, cloneRepo } from './sources'

import type { MarketplaceInfo, MarketplaceManifest, MarketplacePluginEntry } from './types'

const MARKETPLACE_FILES = [
    'marketplace.json',
    path.join('.december-plugin', 'marketplace.json'),
    path.join('.claude-plugin', 'marketplace.json'),
]

const UPDATED_MARKER = '.december-updated'
const SAFE_NAME = /^[A-Za-z0-9][A-Za-z0-9._-]*$/

interface StoredMarketplace {
    source: string
    kind: 'local' | 'git'
    addedAt: string
}

export interface MarketplaceRegistryOptions {
    homeDir?: string
}

export function isSafeName(name: string): boolean {
    return SAFE_NAME.test(name) && !name.includes('..')
}

/** Reads and checks a marketplace.json from a folder */
export function readMarketplaceManifest(dir: string): MarketplaceManifest {
    for (const file of MARKETPLACE_FILES) {
        const filePath = path.join(dir, file)
        if (!fsSync.existsSync(filePath)) continue
        let data: any
        try {
            data = JSON.parse(fsSync.readFileSync(filePath, 'utf8'))
        } catch (err: any) {
            throw new Error(`${file} is not valid JSON: ${err?.message || err}`, { cause: err })
        }
        if (!data || typeof data.name !== 'string' || !isSafeName(data.name)) {
            throw new Error(`${file} needs a "name" made of letters, numbers, ".", "_" or "-".`)
        }
        if (!Array.isArray(data.plugins)) {
            throw new Error(`${file} needs a "plugins" list.`)
        }
        const plugins: MarketplacePluginEntry[] = data.plugins.filter(
            (p: any) => p && typeof p.name === 'string' && isSafeName(p.name)
        )
        return { ...data, plugins }
    }
    throw new Error('No marketplace.json found at the root of that source.')
}

export class MarketplaceRegistry {
    private homeDir?: string

    constructor(options?: MarketplaceRegistryOptions) {
        this.homeDir = options?.homeDir
    }

    private get configPath(): string {
        return getUserConfigPath(this.homeDir)
    }

    private get cacheRoot(): string {
        return path.join(getDecemberDir(this.homeDir), 'marketplaces')
    }

    private async readConfig(): Promise<Record<string, any>> {
        try {
            const data = JSON.parse(await fs.readFile(this.configPath, 'utf8'))
            return data && typeof data === 'object' && !Array.isArray(data) ? data : {}
        } catch {
            // Intentionally swallowed: no config yet
            return {}
        }
    }

    private async writeConfig(config: Record<string, any>): Promise<void> {
        await fs.mkdir(path.dirname(this.configPath), { recursive: true })
        await fs.writeFile(this.configPath, JSON.stringify(config, null, 2) + '\n', 'utf8')
    }

    private async readStored(): Promise<Record<string, StoredMarketplace>> {
        const config = await this.readConfig()
        const stored = config.marketplaces
        return stored && typeof stored === 'object' && !Array.isArray(stored) ? stored : {}
    }

    private dirFor(name: string, stored: StoredMarketplace): string {
        return stored.kind === 'local' ? stored.source : path.join(this.cacheRoot, name)
    }

    private async updatedAt(dir: string): Promise<number | undefined> {
        for (const candidate of [path.join(dir, UPDATED_MARKER), dir]) {
            try {
                return (await fs.stat(candidate)).mtimeMs
            } catch {
                // Intentionally swallowed: try the next candidate
            }
        }
        return undefined
    }

    private async touch(dir: string): Promise<void> {
        await fs.writeFile(path.join(dir, UPDATED_MARKER), new Date().toISOString(), 'utf8')
    }

    async list(): Promise<MarketplaceInfo[]> {
        const result: MarketplaceInfo[] = [
            {
                name: BUILT_IN_MARKETPLACE_NAME,
                source: 'built in',
                builtIn: true,
                plugins: BUILT_IN_MARKETPLACE.plugins,
            },
        ]

        const stored = await this.readStored()
        for (const [name, entry] of Object.entries(stored)) {
            if (!entry || typeof entry.source !== 'string') continue
            const dir = this.dirFor(name, entry)
            const info: MarketplaceInfo = {
                name,
                source: entry.source,
                builtIn: false,
                dirPath: dir,
                plugins: [],
                updatedAt: await this.updatedAt(dir),
            }
            try {
                info.plugins = readMarketplaceManifest(dir).plugins
            } catch (err: any) {
                info.error = err?.message || String(err)
            }
            result.push(info)
        }
        return result
    }

    async add(input: string): Promise<MarketplaceInfo> {
        const resolved = resolveSource(input)
        const stored = await this.readStored()

        let manifest: MarketplaceManifest
        let entry: StoredMarketplace
        let tempClone: string | null = null

        try {
            if (resolved.kind === 'local') {
                manifest = readMarketplaceManifest(resolved.path)
                entry = { source: resolved.path, kind: 'local', addedAt: new Date().toISOString() }
            } else {
                tempClone = await cloneToTemp({ url: resolved.url, ref: resolved.ref })
                manifest = readMarketplaceManifest(tempClone)
                const source = resolved.ref ? `${resolved.url}#${resolved.ref}` : resolved.url
                entry = { source, kind: 'git', addedAt: new Date().toISOString() }
            }

            if (manifest.name === BUILT_IN_MARKETPLACE_NAME) {
                throw new Error(`"${BUILT_IN_MARKETPLACE_NAME}" is built in and cannot be added.`)
            }
            if (stored[manifest.name]) {
                throw new Error(`A marketplace named "${manifest.name}" is already added.`)
            }

            if (tempClone) {
                const dest = path.join(this.cacheRoot, manifest.name)
                await fs.rm(dest, { recursive: true, force: true })
                await fs.mkdir(this.cacheRoot, { recursive: true })
                await fs.cp(tempClone, dest, { recursive: true })
                await this.touch(dest)
            }
        } finally {
            if (tempClone) await removeTempClone(tempClone)
        }

        const config = await this.readConfig()
        config.marketplaces = { ...stored, [manifest.name]: entry }
        await this.writeConfig(config)

        const added = (await this.list()).find((m) => m.name === manifest.name)
        if (!added) throw new Error(`Failed to add marketplace "${manifest.name}".`)
        return added
    }

    async update(name: string): Promise<MarketplaceInfo> {
        if (name === BUILT_IN_MARKETPLACE_NAME) {
            return (await this.list())[0]!
        }
        const stored = await this.readStored()
        const entry = stored[name]
        if (!entry) throw new Error(`No marketplace named "${name}".`)

        const dir = this.dirFor(name, entry)
        if (entry.kind === 'git') {
            if (fsSync.existsSync(path.join(dir, '.git'))) {
                await runGit(['pull', '--ff-only'], dir)
            } else {
                const [url, ref] = entry.source.split('#')
                await fs.rm(dir, { recursive: true, force: true })
                await fs.mkdir(this.cacheRoot, { recursive: true })
                await cloneRepo({ url: url!, ref, dest: dir })
            }
            await this.touch(dir)
        }
        readMarketplaceManifest(dir)

        const updated = (await this.list()).find((m) => m.name === name)
        if (!updated) throw new Error(`No marketplace named "${name}".`)
        return updated
    }

    async remove(name: string): Promise<void> {
        if (name === BUILT_IN_MARKETPLACE_NAME) {
            throw new Error(`"${BUILT_IN_MARKETPLACE_NAME}" is built in and cannot be removed.`)
        }
        const config = await this.readConfig()
        const stored = await this.readStored()
        const entry = stored[name]
        if (!entry) throw new Error(`No marketplace named "${name}".`)

        delete stored[name]
        config.marketplaces = stored
        await this.writeConfig(config)

        if (entry.kind === 'git') {
            await fs.rm(path.join(this.cacheRoot, name), { recursive: true, force: true })
        }
    }

    /** Finds a plugin by "<name>@<marketplace>" or by plain name (first match) */
    async findPlugin(
        id: string
    ): Promise<{ entry: MarketplacePluginEntry; marketplace: MarketplaceInfo } | null> {
        const [name, marketName] = id.split('@')
        const markets = await this.list()
        for (const marketplace of markets) {
            if (marketName && marketplace.name !== marketName) continue
            const entry = marketplace.plugins.find(
                (p) => p.name.toLowerCase() === name!.toLowerCase()
            )
            if (entry) return { entry, marketplace }
        }
        return null
    }
}
