import path from 'node:path'

import {
    attachUserHooks,
    loadUserHooks,
    type UserHook,
    type UserHooksAgentController,
} from '@december/shared'

import { getConfigDir, loadConfig } from '../config'

import { isWorkspaceTrusted, resolveWorkspaceRoot } from './workspace-trust'

import type { Agent } from '@december/agent'

// the agent wiring moved to @december/shared, so a cloud session runs hooks the same way
export { MAX_STOP_HOOK_CONTINUES, appendHookContext } from '@december/shared'

export interface UserHooksController extends UserHooksAgentController {
    /** the hooks that run now (project hooks only when the workspace is trusted) */
    listHooks(): UserHook[]
    projectHooksSkipped(): boolean
}

export function getUserHookPaths(workspaceDir: string): {
    globalPath: string
    projectPath: string
} {
    return {
        globalPath: path.join(getConfigDir(), 'hooks.json'),
        projectPath: path.join(path.resolve(workspaceDir), '.december', 'hooks.json'),
    }
}

/**
 * Connects hooks.json to the agent. Hook files are read again on every event, so
 * edits apply without a restart. Project hooks run only in a trusted workspace.
 */
export async function setupUserHooks(
    agent: Agent,
    options: {
        workspaceDir: string
        /** shown to the user when a hook fails or blocks something */
        onNotice?: (message: string, tone: 'info' | 'error') => void
    }
): Promise<UserHooksController> {
    const workspaceDir = path.resolve(options.workspaceDir)
    const paths = getUserHookPaths(workspaceDir)
    let trusted = false
    try {
        trusted = isWorkspaceTrusted(resolveWorkspaceRoot(workspaceDir), await loadConfig())
    } catch {
        // Intentionally swallowed: an unknown trust state means project hooks do not run
        trusted = false
    }

    const listHooks = () => loadUserHooks({ ...paths, includeProject: trusted })

    const controller = attachUserHooks(agent, {
        listHooks,
        cwd: workspaceDir,
        onNotice: options.onNotice,
    })

    return {
        ...controller,
        listHooks,
        projectHooksSkipped: () => !trusted,
    }
}
