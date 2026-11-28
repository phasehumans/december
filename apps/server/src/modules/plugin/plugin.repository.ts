import { prisma } from '@december/database'

import type { PluginSaveData } from './plugin.types'
import type { Prisma } from '@december/database'

// every read leaves out the files: only a cloud session (the worker) reads them
const PUBLIC_FIELDS = {
    id: true,
    name: true,
    description: true,
    version: true,
    author: true,
    sourceKind: true,
    source: true,
    ref: true,
    path: true,
    commitSha: true,
    enabled: true,
    skills: true,
    mcpServers: true,
    fileCount: true,
    sizeBytes: true,
    createdAt: true,
    updatedAt: true,
} satisfies Prisma.UserPluginSelect

const toJson = (data: PluginSaveData) => ({
    ...data,
    skills: data.skills as unknown as Prisma.InputJsonValue,
    mcpServers: data.mcpServers as unknown as Prisma.InputJsonValue,
    files: new Uint8Array(data.files),
})

const findPlugins = (userId: string) =>
    prisma.userPlugin.findMany({
        where: { userId },
        orderBy: { name: 'asc' },
        select: PUBLIC_FIELDS,
    })

const findPlugin = (userId: string, name: string) =>
    prisma.userPlugin.findUnique({
        where: { userId_name: { userId, name } },
        select: PUBLIC_FIELDS,
    })

const countPlugins = (userId: string) => prisma.userPlugin.count({ where: { userId } })

const createPlugin = (userId: string, data: PluginSaveData) =>
    prisma.userPlugin.create({ data: { ...toJson(data), userId }, select: PUBLIC_FIELDS })

const replacePlugin = (id: string, data: PluginSaveData) =>
    prisma.userPlugin.update({ where: { id }, data: toJson(data), select: PUBLIC_FIELDS })

const setPluginEnabled = (id: string, enabled: boolean) =>
    prisma.userPlugin.update({ where: { id }, data: { enabled }, select: PUBLIC_FIELDS })

const deletePlugin = (userId: string, name: string) =>
    prisma.userPlugin.deleteMany({ where: { userId, name } })

export const pluginRepository = {
    findPlugins,
    findPlugin,
    countPlugins,
    createPlugin,
    replacePlugin,
    setPluginEnabled,
    deletePlugin,
}
