import { BUILT_IN_MARKETPLACE_NAME } from '@december/shared'

import { AppError } from '../../shared/appError'

import { pluginGithub } from './plugin.github'
import { pluginRepository } from './plugin.repository'
import {
    MAX_PLUGINS,
    catalogPlugin,
    encodePluginFiles,
    fallbackPluginName,
    filesSize,
    findCatalogEntry,
    parsePluginFiles,
    selectPluginFiles,
    toMarketplaceListing,
    toPublicPlugin,
} from './plugin.utils'

import type {
    GithubPluginSource,
    InstallPlugin,
    PluginByName,
    PluginSaveData,
    SaveDataInput,
    SetPluginEnabled,
    UserRef,
} from './plugin.types'

const notFound = (name: string) => new AppError(`No plugin named ${name} is installed.`, 404)

/** downloads a repository and reads the plugin in it. nothing in it is run */
const readGithubPlugin = async (data: GithubPluginSource) => {
    const { owner, repo, path } = data
    const archive = pluginGithub.readArchive(await pluginGithub.downloadArchive(data))
    const files = selectPluginFiles(archive.entries, path ?? '')
    const plugin = parsePluginFiles({
        files,
        fallbackName: fallbackPluginName({ owner, repo, path }),
        label: `${owner}/${repo}`,
    })
    return { plugin, commitSha: archive.commitSha }
}

const toSaveData = (data: SaveDataInput): PluginSaveData => {
    const { plugin, sourceKind, source, ref, path, commitSha, name } = data
    return {
        name: name ?? plugin.name,
        description: plugin.description,
        version: plugin.version,
        author: plugin.author,
        sourceKind,
        source,
        ref,
        path,
        commitSha,
        skills: plugin.skills,
        mcpServers: plugin.mcpServers,
        files: encodePluginFiles(plugin.files),
        fileCount: plugin.files.length,
        sizeBytes: filesSize(plugin.files),
    }
}

/** the save data of a source: a built-in marketplace entry first (like the cli), then github */
const resolveSource = async (data: { source: string }): Promise<PluginSaveData> => {
    const { source } = data
    const entry = findCatalogEntry(source)
    if (entry) {
        return toSaveData({
            plugin: catalogPlugin(entry),
            sourceKind: 'marketplace',
            source: BUILT_IN_MARKETPLACE_NAME,
            ref: null,
            path: null,
            commitSha: null,
        })
    }
    const [, market] = source.split('@')
    if (market !== undefined && !source.includes('/') && market !== BUILT_IN_MARKETPLACE_NAME) {
        throw new AppError(
            `Only the ${BUILT_IN_MARKETPLACE_NAME} marketplace is on the web. Use owner/repo for other plugins.`,
            400
        )
    }
    if (market === BUILT_IN_MARKETPLACE_NAME) {
        throw new AppError(
            `No plugin named ${source.split('@')[0]} in ${BUILT_IN_MARKETPLACE_NAME}.`,
            404
        )
    }
    const github = pluginGithub.parseGithubSource(source)
    const { plugin, commitSha } = await readGithubPlugin(github)
    return toSaveData({
        plugin,
        sourceKind: 'github',
        source: `${github.owner}/${github.repo}`,
        ref: github.ref ?? null,
        path: github.path ?? null,
        commitSha,
    })
}

const isUniqueError = (error: unknown) => (error as { code?: string })?.code === 'P2002'

const listPlugins = async (data: UserRef) => {
    const { userId } = data
    const plugins = await pluginRepository.findPlugins(userId)
    return { plugins: plugins.map(toPublicPlugin) }
}

const listMarketplace = async (data: UserRef) => {
    const { userId } = data
    return toMarketplaceListing(await pluginRepository.findPlugins(userId))
}

/**
 * Installs a plugin from the built-in marketplace or from a public GitHub repository. The
 * files are saved on the account; a cloud session writes them into its sandbox.
 */
const installPlugin = async (data: InstallPlugin) => {
    const { userId, source } = data
    if ((await pluginRepository.countPlugins(userId)) >= MAX_PLUGINS) {
        throw new AppError(`You can install up to ${MAX_PLUGINS} plugins.`, 409)
    }
    const save = await resolveSource({ source })
    if (await pluginRepository.findPlugin(userId, save.name)) {
        throw new AppError(`${save.name} is already installed. Update it instead.`, 409)
    }
    try {
        const plugin = await pluginRepository.createPlugin(userId, save)
        return { plugin: toPublicPlugin(plugin) }
    } catch (error) {
        // two installs of one plugin at the same time: the second one finds the first
        if (isUniqueError(error)) {
            throw new AppError(`${save.name} is already installed. Update it instead.`, 409)
        }
        throw error
    }
}

const setPluginEnabled = async (data: SetPluginEnabled) => {
    const { userId, name, enabled } = data
    const existing = await pluginRepository.findPlugin(userId, name)
    if (!existing) throw notFound(name)
    const plugin = await pluginRepository.setPluginEnabled(existing.id, enabled)
    return { plugin: toPublicPlugin(plugin) }
}

/**
 * Reads the plugin again from where it came from and keeps its name, like the cli's
 * update. A github plugin at the same commit is left as it is.
 */
const updatePlugin = async (data: PluginByName) => {
    const { userId, name } = data
    const existing = await pluginRepository.findPlugin(userId, name)
    if (!existing) throw notFound(name)

    let save: PluginSaveData
    if (existing.sourceKind === 'marketplace') {
        const entry = findCatalogEntry(existing.name)
        if (!entry) throw new AppError(`${name} is no longer in ${existing.source}.`, 404)
        save = toSaveData({
            plugin: catalogPlugin(entry),
            sourceKind: 'marketplace',
            source: existing.source,
            ref: null,
            path: null,
            commitSha: null,
        })
        if (existing.version === entry.version)
            return { plugin: toPublicPlugin(existing), changed: false }
    } else {
        const [owner = '', repo = ''] = existing.source.split('/')
        const source: GithubPluginSource = {
            kind: 'github',
            owner,
            repo,
            ...(existing.ref ? { ref: existing.ref } : {}),
            ...(existing.path ? { path: existing.path } : {}),
        }
        const { plugin, commitSha } = await readGithubPlugin(source)
        if (commitSha && commitSha === existing.commitSha) {
            return { plugin: toPublicPlugin(existing), changed: false }
        }
        save = toSaveData({
            plugin,
            sourceKind: 'github',
            source: existing.source,
            ref: existing.ref,
            path: existing.path,
            commitSha,
            name: existing.name,
        })
    }
    const plugin = await pluginRepository.replacePlugin(existing.id, {
        ...save,
        name: existing.name,
    })
    return { plugin: toPublicPlugin(plugin), changed: true }
}

const uninstallPlugin = async (data: PluginByName) => {
    const { userId, name } = data
    const { count } = await pluginRepository.deletePlugin(userId, name)
    if (count === 0) throw notFound(name)
    return { deleted: true }
}

export const pluginService = {
    listPlugins,
    listMarketplace,
    installPlugin,
    setPluginEnabled,
    updatePlugin,
    uninstallPlugin,
}
