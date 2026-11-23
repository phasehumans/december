import { create } from 'zustand'

import {
    demoHooks,
    demoMcps,
    demoMemories,
    demoPlugins,
    demoRules,
    demoSkills,
} from '../lib/demoData'

import type {
    ConnectionsHook,
    ConnectionsMcp,
    ConnectionsMemory,
    ConnectionsPlugin,
    ConnectionsRule,
    ConnectionsSkill,
} from '../types'

// in-memory store for demo mode. there is no backend yet, so nothing persists
// past a page reload.

interface ConnectionsState {
    plugins: ConnectionsPlugin[]
    skills: ConnectionsSkill[]
    mcps: ConnectionsMcp[]
    hooks: ConnectionsHook[]
    rules: ConnectionsRule[]
    memories: ConnectionsMemory[]
    memoryEnabled: boolean
    hasSeenInstallNotice: boolean

    setPluginInstalled: (name: string, installed: boolean) => void
    setPluginEnabled: (name: string, enabled: boolean) => void
    updatePlugin: (name: string) => void
    addPluginFromRepo: (repo: string) => void
    markInstallNoticeSeen: () => void

    saveSkill: (skill: ConnectionsSkill, previousName?: string) => void
    setSkillEnabled: (name: string, enabled: boolean) => void
    deleteSkill: (name: string) => void

    saveMcp: (mcp: ConnectionsMcp, previousName?: string) => void
    setMcpEnabled: (name: string, enabled: boolean) => void
    setMcpToolEnabled: (name: string, tool: string, enabled: boolean) => void
    setMcpStatus: (name: string, patch: Partial<ConnectionsMcp>) => void
    removeMcp: (name: string) => void

    saveHook: (hook: ConnectionsHook) => void
    setHookEnabled: (id: string, enabled: boolean) => void
    deleteHook: (id: string) => void
    replaceUserHooks: (hooks: ConnectionsHook[]) => void

    saveRule: (rule: ConnectionsRule, previousName?: string) => void
    setRuleEnabled: (name: string, enabled: boolean) => void
    deleteRule: (name: string) => void

    deleteMemory: (id: string) => void
    deleteAllMemories: () => void
    setMemoryEnabled: (enabled: boolean) => void
}

const upsertByName = <T extends { name: string }>(list: T[], item: T, previousName?: string) => {
    const key = previousName ?? item.name
    const exists = list.some((entry) => entry.name === key)
    return exists ? list.map((entry) => (entry.name === key ? item : entry)) : [item, ...list]
}

export const useConnectionsStore = create<ConnectionsState>((set) => ({
    plugins: demoPlugins,
    skills: demoSkills,
    mcps: demoMcps,
    hooks: demoHooks,
    rules: demoRules,
    memories: demoMemories,
    memoryEnabled: true,
    hasSeenInstallNotice: false,

    setPluginInstalled: (name, installed) =>
        set((s) => ({
            plugins: s.plugins.map((p) => (p.name === name ? { ...p, installed } : p)),
        })),
    setPluginEnabled: (name, enabled) =>
        set((s) => ({
            plugins: s.plugins.map((p) => (p.name === name ? { ...p, enabled } : p)),
        })),
    updatePlugin: (name) =>
        set((s) => ({
            plugins: s.plugins.map((p) =>
                p.name === name && p.updateTo
                    ? { ...p, version: p.updateTo, updateTo: undefined }
                    : p
            ),
        })),
    addPluginFromRepo: (repo) =>
        set((s) => {
            const name = repo.split('/').pop() || repo
            const plugin: ConnectionsPlugin = {
                name,
                version: '0.1.0',
                source: repo,
                commit: '0000000',
                installed: true,
                enabled: true,
                contents: [],
            }
            return { plugins: upsertByName(s.plugins, plugin) }
        }),
    markInstallNoticeSeen: () => set({ hasSeenInstallNotice: true }),

    saveSkill: (skill, previousName) =>
        set((s) => ({ skills: upsertByName(s.skills, skill, previousName) })),
    setSkillEnabled: (name, enabled) =>
        set((s) => ({
            skills: s.skills.map((k) => (k.name === name ? { ...k, enabled } : k)),
        })),
    deleteSkill: (name) => set((s) => ({ skills: s.skills.filter((k) => k.name !== name) })),

    saveMcp: (mcp, previousName) => set((s) => ({ mcps: upsertByName(s.mcps, mcp, previousName) })),
    setMcpEnabled: (name, enabled) =>
        set((s) => ({ mcps: s.mcps.map((m) => (m.name === name ? { ...m, enabled } : m)) })),
    setMcpToolEnabled: (name, tool, enabled) =>
        set((s) => ({
            mcps: s.mcps.map((m) =>
                m.name === name
                    ? {
                          ...m,
                          tools: m.tools.map((t) => (t.name === tool ? { ...t, enabled } : t)),
                      }
                    : m
            ),
        })),
    setMcpStatus: (name, patch) =>
        set((s) => ({ mcps: s.mcps.map((m) => (m.name === name ? { ...m, ...patch } : m)) })),
    removeMcp: (name) => set((s) => ({ mcps: s.mcps.filter((m) => m.name !== name) })),

    saveHook: (hook) =>
        set((s) => {
            const exists = s.hooks.some((h) => h.id === hook.id)
            return {
                hooks: exists
                    ? s.hooks.map((h) => (h.id === hook.id ? hook : h))
                    : [...s.hooks, hook],
            }
        }),
    setHookEnabled: (id, enabled) =>
        set((s) => ({ hooks: s.hooks.map((h) => (h.id === id ? { ...h, enabled } : h)) })),
    deleteHook: (id) => set((s) => ({ hooks: s.hooks.filter((h) => h.id !== id) })),
    replaceUserHooks: (hooks) =>
        set((s) => ({ hooks: [...hooks, ...s.hooks.filter((h) => h.plugin)] })),

    saveRule: (rule, previousName) =>
        set((s) => ({ rules: upsertByName(s.rules, rule, previousName) })),
    setRuleEnabled: (name, enabled) =>
        set((s) => ({ rules: s.rules.map((r) => (r.name === name ? { ...r, enabled } : r)) })),
    deleteRule: (name) => set((s) => ({ rules: s.rules.filter((r) => r.name !== name) })),

    deleteMemory: (id) => set((s) => ({ memories: s.memories.filter((m) => m.id !== id) })),
    deleteAllMemories: () => set({ memories: [] }),
    setMemoryEnabled: (enabled) => set({ memoryEnabled: enabled }),
}))

/** true when the plugin that owns an item is turned off (its items are locked) */
export const isPluginOff = (plugins: ConnectionsPlugin[], plugin?: string) =>
    Boolean(plugin && plugins.find((p) => p.name === plugin)?.enabled === false)
