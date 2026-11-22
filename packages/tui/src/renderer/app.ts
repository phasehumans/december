import { exec } from 'node:child_process'
import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'

import { getReasoningSupportType } from '@december/providers'
import { CHANGELOG_URL, PROVIDER_BILLING_LINKS, SkillDiscoveryEngine } from '@december/shared'

import { COMMANDS } from '../commands/commands'
import {
    UNIFIED_PROVIDER_MENU_ITEMS,
    SUBSCRIPTION_PROVIDER_ITEMS,
    BYOK_PROVIDER_ITEMS,
    PROVIDER_KEY_URLS,
    PROVIDER_KEY_NOTES,
    formatProviderName,
} from '../constants/providers'
import { getNextTip } from '../constants/tips'
import { Keymap, defaultKeybindingsFileContent } from '../keybindings'
import { THEME } from '../theme'
import { writeToClipboard } from '../utils/clipboard'
import {
    groupCodeSearchResults,
    searchWorkspaceCode,
    type CodeSearchGroupItem,
    type CodeSearchResultItem,
} from '../utils/code-search'
import {
    fetchGitStatusFiles,
    type DiffFileEntry,
    type ChangeBlock,
    parseUnifiedDiffToRows,
} from '../utils/diff'
import { toolCallChanges } from '../utils/edit-diff'
import { getFileQueryMatch, scoreAndSortFiles, type ScoredFile } from '../utils/fuzzy'
import { expandPastes, storePaste } from '../utils/paste-manager'
import { toRelativePath } from '../utils/terminal-link'

import {
    AttentionNotifier,
    nextNotifyMode,
    normalizeNotifyMode,
    type AttentionEvent,
    type AttentionReason,
    type NotifyMode,
} from './attention-notifier'
import { sliceToWidth } from './cell'
import { splitInputSequences } from './input-lexer'
import { DifferentialScreen } from './screen'
import { TerminalController } from './terminal'
import { ActivityTracker, planStepsFromText } from './views/activity-line-view'
import { AskQuestionMenuView, type QuestionItem } from './views/ask-question-menu-view'
import {
    AuthMenuView,
    type AuthViewMode,
    type ProviderItem,
    MAIN_MENU_OPTIONS,
    DEFAULT_AUTH_PROVIDERS,
    AUTH_PROVIDER_WINDOW_SIZE,
} from './views/auth-menu-view'
import { BtwOverlayView, BTW_EXPANDED_MAX_VISIBLE_LINES } from './views/btw-overlay-view'
import { CodeSearchMenuView, CODE_SEARCH_WINDOW_SIZE } from './views/code-search-menu-view'
import { CommandMenuView, WINDOW_SIZE as CMD_WINDOW_SIZE } from './views/command-menu-view'
import { ContextMenuView } from './views/context-menu-view'
import { DiffViewMenuView, DIFF_WINDOW_SIZE, type DiffScope } from './views/diff-view-menu-view'
import {
    EffortMenuView,
    type ReasoningLevel,
    REASONING_OPTIONS,
    normalizeReasoningLevel,
} from './views/effort-menu-view'
import { FileAutocompleteMenuView, FILE_WINDOW_SIZE } from './views/file-autocomplete-menu-view'
import { FileViewMenuView } from './views/file-view-menu-view'
import { HeaderView, type HeaderViewProps } from './views/header-view'
import { HelpMenuView, type HelpTab, resolveShortcuts } from './views/help-menu-view'
import { InputBarView, wrapInputText, getWrappedCursorPosition } from './views/input-bar-view'
import { LoginMenuView, LOGIN_OPTIONS } from './views/login-menu-view'
import { McpMenuView, type McpServerMenuItem, type McpViewMode } from './views/mcp-menu-view'
import { MemoryViewMenuView, type AgentsFileViewItem } from './views/memory-view-menu-view'
import { type MenuFooterItem } from './views/menu-footer-view'
import { MessageLineCache } from './views/message-line-cache'
import { MessageListView, type MessageItem } from './views/message-list-view'
import {
    ModelSelectMenuView,
    MODEL_WINDOW_SIZE,
    type ModelItem,
} from './views/model-select-menu-view'
import { takePanelCursor } from './views/panel'
import { PlanApproveMenuView, PLAN_APPROVE_OPTIONS } from './views/plan-approve-menu-view'
import {
    buildPluginList,
    ensureVisible,
    lineIndexOf,
    marketplaceCounts,
    PLUGIN_KIND_FILTERS,
    PLUGIN_TABS,
    PluginMenuView,
    pluginSubtitle,
    type DiscoverRow,
    type ExtensionRow,
    type MarketplaceRow,
    type PluginInputKind,
    type PluginInstallScope,
    type PluginKindFilter,
    type PluginList,
    type PluginScreen,
    type PluginSelectable,
    type PluginTab,
} from './views/plugin-menu-view'
import {
    ReportView,
    clampReportScroll,
    firstSelectableRow,
    getReportViewportHeight,
    nextSelectableRow,
    type ReportRow,
} from './views/report-view'
import {
    RewindSelectMenuView,
    type RewindTurnEntry,
    REWIND_WINDOW_SIZE,
} from './views/rewind-select-menu-view'
import {
    getSessionDisplayTitle,
    SessionSelectMenuView,
    type SessionItem,
    SESSION_WINDOW_SIZE,
} from './views/session-select-menu-view'
import { SettingsMenuView, formatSettingValue, type SettingItem } from './views/settings-menu-view'
import { SkillsMenuView, toTildePath, type SkillItem } from './views/skills-menu-view'
import { SwitchSelectMenuView, type SwitchItem } from './views/switch-select-menu-view'
import {
    TASKS_WINDOW_SIZE,
    TasksModeMenuView,
    getTaskLogLines,
    getTaskLogTitle,
    orderTasks,
    type TaskItem,
    type TasksConfirmStop,
} from './views/tasks-mode-menu-view'
import { ToolPermissionMenuView, getPermissionOptions } from './views/tool-permission-menu-view'
import {
    UsageSelectMenuView,
    type UsageOverview,
    type UsageStats,
} from './views/usage-select-menu-view'

import type { DifferentialScreenOptions } from './types'
import type { ReleaseAnnouncement } from '../constants/announcements'
import type { BtwState } from '../types'
import type { FormattedLine } from './views/markdown'

export type OverlayType =
    | 'none'
    | 'help'
    | 'effort'
    | 'login'
    | 'model'
    | 'diff'
    | 'tasks'
    | 'settings'
    | 'context'
    | 'skills'
    | 'codesearch'
    | 'fileview'
    | 'session'
    | 'usage'
    | 'memory'
    | 'rewind'
    | 'ask_question'
    | 'tool_permission'
    | 'plan_approve'
    | 'auth'
    | 'switch'
    | 'mcp'
    | 'plugin'
    | 'report'

/** State of the shared full-screen report overlay (/check, /skills, /hooks, /permissions, /github) */
export interface ReportState {
    kind: 'check' | 'skills' | 'hooks' | 'permissions' | 'github'
    title: string
    subtitle?: string
    rows: ReportRow[]
    selectedIndex: number
    scrollOffset: number
    isLoading: boolean
    loadingText?: string
    emptyText?: string
    tabs?: { label: string; active: boolean }[]
    /** single-line text input; enter calls onSubmit, esc cancels it */
    input?: { prompt: string; value: string; mask?: boolean; onSubmit: (value: string) => void }
    footer: MenuFooterItem[]
    /** enter on the selected row */
    onEnter?: (row: ReportRow | undefined) => void
    /** other keys; return true when handled */
    onKey?: (key: string, row: ReportRow | undefined) => boolean
}

export interface PluginCatalogData {
    installed: ExtensionRow[]
    discover: DiscoverRow[]
    marketplaces: MarketplaceRow[]
}

export type PluginConfirmAction =
    | { action: 'uninstall'; id: string; message: string }
    | { action: 'remove-mcp'; id: string; scope: 'global' | 'project'; message: string }
    | { action: 'remove-marketplace'; id: string; message: string }

/**
 * What happened when the user entered an api key (issue #619, D4).
 * rejected: the provider does not know the key, nothing was saved.
 * forbidden: saved, but the account cannot use it yet (billing, region, restricted key).
 * unverified: saved, the provider has no model list or could not be reached.
 */
export interface ApiKeySaveResult {
    status: 'saved' | 'rejected' | 'forbidden' | 'unverified' | 'error'
    message?: string
    /** how many models the key unlocked, when the provider listed them */
    modelCount?: number
    /** unverified only: why the key could not be checked */
    unverifiedReason?: 'not_verifiable' | 'no_endpoint' | 'network' | 'no_key' | string
}

export interface PendingModelFallback {
    provider: string
    failedModel: string
    fallbackModel: string
    prompt: string
}

export interface DifferentialAppState {
    input: string
    cursorPos: number
    messages: MessageItem[]
    promptHistory: string[]
    historyIndex: number
    scrollOffset?: number
    isReadingMode: boolean
    isStreaming: boolean
    /** Plan mode: plain prompts are sent as /plan <prompt> (toggle with shift+tab or /plan) */
    planMode: boolean
    report: ReportState | null
    promptQueue: string[]
    spinnerFrame: number
    statusMessage?: string
    /** Background update in progress, shown as a lasting status line with elapsed time */
    updateStatus?: { message: string; startedAt: number }
    /** A new version is installed; the running session still uses the old one */
    pendingRestart?: { version: string; dismissed: boolean }
    activeTip?: string | null
    activeModel?: string
    modelLabel?: string
    authMethod?: string
    selectedProvider?: string
    isAuthenticated?: boolean
    contextTokens?: number
    maxContextTokens?: number
    cliVersion?: string
    userEmail?: string
    decemberEmail?: string
    hasDecember?: boolean
    cwd?: string
    branch?: string
    latestVersion?: string
    mcpServersCount?: number
    announcement?: ReleaseAnnouncement | null
    showExitConfirm: boolean
    toast: { message: string; variant?: 'success' | 'error' | 'info' } | null
    activeOverlay: OverlayType
    overlayHistory: OverlayType[]

    // Command menu drop-up state
    commandSelectedIndex: number
    commandWindowStart: number

    // Model select state
    models: ModelItem[]
    modelSearchQuery: string
    modelSelectedIndex: number
    modelWindowStart: number
    isModelSearching: boolean

    // Diff view state
    /** The files of the view shown: diffSessionFiles or diffAllFiles */
    diffFiles: DiffFileEntry[]
    /** Which changes /diff shows: this session's (since its first turn) or all git changes */
    diffScope: DiffScope
    /** All git changes in the workspace */
    diffAllFiles: DiffFileEntry[]
    /** Changes since the session's first turn; null when the session has no snapshot */
    diffSessionFiles: DiffFileEntry[] | null
    /** True while /diff fetches its changes */
    isDiffLoading: boolean
    diffSelectedIndex: number
    diffWindowStart: number
    isDiffDetailView: boolean
    isDiffFullFile: boolean
    diffScrollOffset: number
    diffCursorLineIndex: number
    diffFilePositions: Record<
        string,
        { cursorIndex: number; scrollOffset: number; isFullFile?: boolean }
    >
    diffFullContents: Record<string, string>

    // Tasks view state
    tasks: TaskItem[]
    tasksSelectedIndex: number
    tasksWindowStart: number
    tasksConfirmStop: TasksConfirmStop
    /** id of the task whose log is open in the file view (it follows new output) */
    fileViewTaskId: string | null

    // Settings view state
    settingsSelectedIndex: number
    settings: SettingItem[]

    // Skill detail (SKILL.md viewer, opened from /plugin)
    skillsDetailSkill: SkillItem | null
    skillsIsDetailView: boolean
    skillsDetailContent: string | null
    skillsDetailLines: string[]
    skillsDetailLoading: boolean
    skillsDetailError: string | null
    skillsCursorLine: number
    skillsScrollOffset: number

    // Code search state
    codeSearchQuery: string
    codeSearchResults: CodeSearchResultItem[]
    codeSearchGroups: CodeSearchGroupItem[]
    codeSearchSelectedIndex: number
    codeSearchWindowStart: number

    // File view state
    fileViewPath: string
    fileViewLines: string[]
    fileViewCursorLine: number
    fileViewScrollOffset: number
    fileViewIsLoading: boolean
    fileViewError: string | null
    fileViewReturnOverlay: OverlayType
    fileViewSearchQuery?: string
    fileViewMatchLines?: number[]
    fileViewCurrentMatchIndex?: number

    // Btw side question state
    btwState: BtwState | null
    btwScrollOffset: number

    // Effort / Reasoning view state
    thinkingLevel: string
    effortSelectedIndex: number

    // Help view state
    helpActiveTab: HelpTab
    helpCmdSelectedIndex: number
    helpCmdWindowStart: number
    helpShortcutSelectedIndex: number
    helpShortcutWindowStart: number

    // Login view state
    loginSelectedIndex: number
    loginConfirmSwitch: boolean

    // Session view state
    sessions: SessionItem[]
    sessionSelectedIndex: number
    sessionWindowStart: number
    sessionSearchQuery: string
    isSessionSearching: boolean
    sessionRenameMode: boolean
    sessionRenameValue: string
    sessionConfirmDeleteId: string | null

    // Usage view state
    usageStats: UsageStats
    usageOverview?: UsageOverview
    usageLoading: boolean

    // Memory view state (AGENTS.md viewer)
    memoryReturnOverlay: OverlayType
    memoryFile: AgentsFileViewItem | null
    memoryCursorLine: number
    memoryScrollOffset: number
    memoryIsLoading: boolean

    // Rewind view state
    rewindTurns: RewindTurnEntry[]
    rewindSelectedIndex: number
    rewindWindowStart: number
    rewindConfirming: boolean

    // Ask question interactive state
    pendingQuestions: QuestionItem[] | null
    currentQuestionIndex: number
    questionSelectedIndex: number
    questionSelectedMulti: Set<number>
    /** Text typed into the "Type your own answer…" row; null when not typing (S21) */
    questionCustomText: string | null

    // Tool permission interactive state
    pendingToolCall: {
        toolName: string
        commandOrTarget?: string
        diffLines?: string[]
        resolve: (res: any) => void
    } | null
    toolPermissionSelectedIndex: number

    // Plan approve interactive state
    pendingPlan: {
        summary: string
        fullPlan?: string
        resolve: (action: any) => void
    } | null
    planApproveSelectedIndex: number

    // Auth view state
    authViewMode: AuthViewMode
    authProviders: ProviderItem[]
    authProviderSelectedIndex: number
    authProviderWindowStart: number
    authProviderSearchQuery: string
    isSearchingAuthProviders: boolean
    authApiKeyInput: string
    authKeyError: string | null
    /** true while december checks the entered key with the provider */
    authKeyChecking: boolean
    /** /model: the picked model is not available on this key, waiting for y/n */
    modelSwitchConfirm: { failed: ModelItem; fallback: ModelItem } | null
    /** /model: the picked model cannot use tools, waiting for y/n */
    modelToolsConfirm: ModelItem | null
    /** /model: `r` is reading the provider's list again */
    modelRefreshing: boolean
    authMenuSelectedIndex: number
    authConfirmDeleteValue: string | null
    authConfirmTarget: { label: string; value: string; account?: string } | null

    // File autocomplete dropup state
    fileAutocompleteItems: ScoredFile[]
    fileAutocompleteSelectedIndex: number
    fileAutocompleteWindowStart: number
    isFileAutocompleteVisible: boolean

    // Switch view state
    switchItems: SwitchItem[]
    switchSelectedIndex: number
    switchConfirmDeleteValue: string | null

    // MCP view state
    mcpServersList: McpServerMenuItem[]
    mcpSelectedIndex: number
    mcpWindowStart: number
    mcpIsDetailView: boolean
    mcpScrollOffset: number
    mcpMode: McpViewMode
    mcpConfirmDeleteName: string | null
    /** Opened on one server from /plugin: esc returns to /plugin instead of the list */
    mcpDetailOnly: boolean
    mcpCustomName: string
    mcpCustomCommand: string
    mcpCustomScope: 'global' | 'project'
    mcpCustomEager: boolean
    mcpCustomEnv: string
    mcpCustomActiveField: number

    // Plugin view state
    pluginActiveTab: PluginTab
    pluginScreen: PluginScreen
    pluginSearchQuery: string
    pluginIsSearching: boolean
    pluginKindFilter: PluginKindFilter
    pluginMarketFilter: string | null
    pluginSelectedIndex: number
    pluginWindowStart: number
    pluginDetailKey: string | null
    pluginActionIndex: number
    pluginInstallId: string | null
    pluginInstallScope: PluginInstallScope
    pluginInputKind: PluginInputKind
    pluginInputValue: string
    pluginConfirm: PluginConfirmAction | null
    pluginBusy: string | null
    pluginLoading: boolean
    pluginCatalog: PluginCatalogData

    pendingModelFallback?: PendingModelFallback

    sessionId?: string
    sessionTitle?: string
    configPath?: string
}

export interface DifferentialAppOptions extends DifferentialScreenOptions {
    /**
     * Queues a frame callback. render() coalesces every state change made in the same
     * tick into one painted frame. Defaults to setImmediate, or synchronous painting
     * under test so assertions can read the screen right after a state change.
     */
    scheduleFrame?: (callback: () => void) => void
    cliVersion?: string
    latestVersion?: string
    modelLabel?: string
    activeModel?: string
    authMethod?: string
    selectedProvider?: string
    isAuthenticated?: boolean
    userEmail?: string
    decemberEmail?: string
    hasDecember?: boolean
    cwd?: string
    branch?: string
    contextTokens?: number
    maxContextTokens?: number
    mcpServersCount?: number
    onLoadMcpServers?: () => Promise<McpServerMenuItem[]>
    onToggleMcpServer?: (name: string) => Promise<void>
    onRestartMcpServer?: (name: string) => Promise<void>
    /** Runs `december update` in the background; progress and result are reported by the host */
    onRunUpdate?: () => Promise<void>
    /** Hands the terminal to a freshly started December that resumes this session */
    onRestart?: () => Promise<void> | void
    onRemoveMcpServer?: (name: string, scope: 'global' | 'project') => Promise<void>
    onAddMcpServer?: (data: {
        name: string
        target: string
        scope: 'global' | 'project'
        eager?: boolean
        env?: Record<string, string>
    }) => Promise<void>
    onLoadPlugins?: () => Promise<PluginCatalogData>
    /** Turns a plugin, skill, or MCP server on or off and saves the choice */
    onTogglePluginItem?: (
        item: Pick<ExtensionRow, 'kind' | 'id' | 'scope' | 'mcpScope' | 'parentPlugin'>
    ) => Promise<{ enabled: boolean; restartRequired: boolean }>
    onInstallPlugin?: (id: string, scope: PluginInstallScope) => Promise<{ name: string }>
    onInstallPluginFromSource?: (
        source: string,
        scope: PluginInstallScope
    ) => Promise<{ name: string }>
    onUpdatePlugin?: (id: string) => Promise<{ name: string; version?: string }>
    onUninstallPlugin?: (id: string) => Promise<void>
    onAddMarketplace?: (source: string) => Promise<{ name: string; available: number }>
    onUpdateMarketplace?: (name: string) => Promise<void>
    onRemoveMarketplace?: (name: string) => Promise<void>
    onModelFallback?: (fallbackModel: string, failedModel: string, prompt: string) => void
    /** Skills for /skill:<name> lookups; discovered from the workspace when omitted */
    skills?: SkillItem[]
    announcement?: ReleaseAnnouncement | null
    models?: ModelItem[]
    tasks?: TaskItem[]
    thinkingLevel?: string
    sessionId?: string
    sessionTitle?: string
    configPath?: string
    onSubmit?: (prompt: string) => void
    onAbort?: () => void
    onExit?: () => void
    onModelSelect?: (model: ModelItem) => void
    getProviderModels?: (provider: string) => ModelItem[]
    onEffortSelect?: (level: ReasoningLevel) => Promise<void> | void
    onLogin?: (
        onCode: (code: string, url: string) => void,
        signal?: AbortSignal
    ) => Promise<{ token: string; email: string | null }>
    onSubscriptionLogin?: (
        provider: string,
        onCode?: (code: string, url: string) => void
    ) => Promise<any>
    onCodeSearch?: (query: string) => Promise<CodeSearchResultItem[]>
    onOpenCodeSearchResult?: (item: CodeSearchResultItem) => void
    onInsertContext?: (file: string, line?: number) => void
    onSideQuestion?: (
        question: string,
        handlers: {
            signal?: AbortSignal
            onChunk: (chunk: string) => void
            onComplete: () => void
            onError: (err: any) => void
        }
    ) => void
    onSessionSelect?: (sessionId: string) => Promise<void> | void
    onSessionDelete?: (sessionId: string) => Promise<void> | void
    onSessionRename?: (sessionId: string, newTitle: string) => Promise<void> | void
    /** `/rename <title>` sets the title. `/rename` with no title asks the model for one. */
    onRenameSession?: (title?: string) => Promise<string | void> | string | void
    onRewindTurn?: (snapshotId: string) => Promise<void> | void
    onOpenBillingPortal?: (url?: string) => void
    sessionRepository?: any
    sessions?: SessionItem[]
    usageStats?: UsageStats
    rewindTurns?: RewindTurnEntry[]
    onLoadAgentsFile?: () => Promise<AgentsFileViewItem | null>
    onScaffoldRules?: () => Promise<{ success: boolean; message: string }>
    onOpenEditor?: (filePath: string) => Promise<void>
    workspaceFiles?: string[]
    recentFiles?: Set<string>
    /** /model opened: the cli refreshes the provider's model list when it is stale (G1) */
    onModelMenuOpen?: () => void
    /** `r` in /model: the cli reads the provider's list now and reports what changed */
    onModelRefresh?: () => Promise<void> | void
    /** says whether the key can use `model`, and which model to offer instead (D5) */
    onCheckModel?: (model: ModelItem) => { available: boolean; fallback?: ModelItem }
    onSaveApiKey?: (
        provider: string,
        apiKey: string,
        /** aborted when the user presses esc while the key is being checked */
        signal?: AbortSignal
    ) => Promise<ApiKeySaveResult | void> | ApiKeySaveResult | void
    switchItems?: SwitchItem[]
    onSwitchSelect?: (value: string) => Promise<void> | void
    onDeleteProvider?: (value: string) => Promise<void> | void
    onExecuteDirectCommand?: (command: string) => Promise<void> | void
    authRequiredNotice?: string
    settings?: SettingItem[]
    onSettingChange?: (settingId: string, newValue: string) => Promise<void> | void
    /** #617: the bell or desktop notification when December needs the user. Default "off". */
    notifyMode?: NotifyMode
    /** #617: December waits on the user, or a long turn finished (runs the Notification hook) */
    onAttention?: (event: AttentionEvent) => void
    onKillTask?: (taskId: string) => boolean | void
    /** removes finished tasks from the task manager (not only from the view) */
    onClearCompletedTasks?: () => void
    /** moves the commands running in the foreground to the background; returns how many */
    onBackgroundForeground?: () => number
    onClearContext?: () => Promise<void> | void
    onNewContext?: () => Promise<string | void> | string | void
    onForkContext?: (newSessionId?: string) => Promise<string | void> | string | void
    onLoadRewindTurns?: () => Promise<RewindTurnEntry[]> | RewindTurnEntry[]
    /** `/diff`: files changed since the session's first turn; null when it has no snapshot */
    onLoadSessionChanges?: () => Promise<DiffFileEntry[] | null>
    onLoadUsage?: () => Promise<UsageOverview | undefined>
    /** `/compact [focus]`: summarizes the conversation now */
    onCompact?: (focus?: string) => Promise<CompactOutcome>
    /** `/check`: health checks for keys, settings, MCP servers, skills, and rules */
    onRunChecks?: () => Promise<CheckItem[]>
    /** `/permissions`: allow and deny rules from the global and project files */
    onLoadPermissions?: () => Promise<PermissionsData>
    onChangePermissionRule?: (change: PermissionRuleChange) => Promise<void>
    /** `/github`: status of the December GitHub Action setup for this repo */
    onLoadGithubSetup?: () => Promise<GithubSetupData>
    /** runs one setup step; resolves to a message for the toast */
    onGithubSetupAction?: (action: GithubSetupAction) => Promise<string>
    /** `/hooks`: hooks from the global and project hooks.json */
    onLoadHooks?: () => Promise<HooksData>
    /** ~/.december/keybindings.json; without it the default keys are used */
    keybindingsPath?: string
}

export interface HooksData {
    hooks: {
        event: string
        matcher: string
        command: string
        timeoutSeconds: number
        source: 'global' | 'project'
    }[]
    globalPath: string
    projectPath: string
    /** absolute paths, for opening in an editor */
    globalFile: string
    projectFile: string
    /** project hooks exist but do not run because the workspace is not trusted */
    projectSkipped: boolean
    problems: string[]
}

export interface GithubSetupData {
    ghInstalled: boolean
    ghAuthed: boolean
    ghAuthDetail?: string
    repo?: string
    defaultBranch: string
    inGitRepo: boolean
    workflowExists: boolean
    workflowPath?: string
    /** provider the action runs with, and the secret that holds its key */
    provider: string
    secretName: string
    providerNote?: string
    secretSet: boolean
    slackSet: boolean
    discordSet: boolean
    secretsError?: string
    /** set when a saved BYOK key for `provider` can be sent as the secret */
    savedKeyAvailable: boolean
}

export type GithubSetupAction =
    | { type: 'write-workflow'; overwrite: boolean }
    | { type: 'set-secret'; name: string; value: string }
    | { type: 'use-saved-key' }

export interface PermissionsData {
    allow: { global: string[]; project: string[] }
    deny: { global: string[]; project: string[] }
    toolPermission: 'always-proceed' | 'always-ask'
    globalPath: string
    projectPath: string
}

export interface PermissionRuleChange {
    action: 'add' | 'remove'
    kind: 'allow' | 'deny'
    scope: 'global' | 'project'
    pattern: string
}

export interface CheckItem {
    group: string
    label: string
    status: 'ok' | 'warn' | 'fail'
    detail?: string
    fix?: string
}

export interface CompactOutcome {
    compacted: boolean
    tokensBefore?: number
    tokensAfter?: number
}

export function openBrowserUrl(url: string): void {
    if (process.env.NODE_ENV === 'test' || !!process.env.BUN_TEST) return
    try {
        const platform = os.platform()
        const isWsl =
            platform === 'linux' &&
            (!!process.env.WSL_DISTRO_NAME || os.release().toLowerCase().includes('microsoft'))
        let cmd = ''
        if (platform === 'darwin') {
            cmd = `open "${url}"`
        } else if (platform === 'win32') {
            cmd = `start "" "${url}"`
        } else if (isWsl) {
            cmd = `powershell.exe -NoProfile -Command "Start-Process '${url}'"`
        } else {
            cmd = `xdg-open "${url}"`
        }
        exec(cmd, () => {})
    } catch {
        // Intentionally swallowed: fallback URL display handled in toast
    }
}

/** Esc presses within this window after a jump-to-bottom do not stop the agent. */
const ESC_ABORT_GUARD_MS = 1000

export const DEFAULT_SETTINGS: SettingItem[] = [
    { id: 'provider', title: 'Provider', value: 'none' },
    { id: 'model', title: 'Model', value: 'none' },
    { id: 'tool_permission', title: 'Tool permission', value: 'always-proceed' },
    { id: 'pathguard', title: 'Path guard', value: 'on' },
    { id: 'non_workspace', title: 'Files outside workspace', value: 'off' },
    { id: 'thinking_level', title: 'Thinking level', value: 'fast' },
    { id: 'steering_mode', title: 'Steering', value: 'all' },
    { id: 'browser_visible', title: 'Browser window', value: 'on' },
    { id: 'notify', title: 'Notify me', value: 'off' },
]

export class DifferentialApp {
    readonly screen: DifferentialScreen
    readonly terminal: TerminalController
    readonly state: DifferentialAppState
    private options?: DifferentialAppOptions
    private isRunning = false
    private stdinListener?: (chunk: Buffer | string) => void
    private lineCache = new MessageLineCache()
    private isBatchingInput = false
    private maxScroll = 0
    /** Line count and layout key captured when the user scrolled away from the bottom. */
    private scrollAnchor: { totalLines: number; layoutKey: string } | null = null
    /** Time of the last Esc that jumped to the bottom, used to guard against an accidental abort. */
    private lastEscJumpAt = 0
    private exitTimer: any = null
    private toastTimer: any = null
    private updateInProgress = false
    private updateStatusTimer: ReturnType<typeof setInterval> | null = null
    /** Set once the terminal is handed to another process; no more painting after that */
    private isDetached = false
    private spinnerTimer: any = null
    private streamStartTime = 0
    /** #617: bell, desktop notification and Notification hook when December needs the user */
    private readonly attention: AttentionNotifier
    /** start and end of the last finished turn, for a plan approval that opens after it */
    private lastTurnStartedAt = 0
    private lastTurnEndedAt = 0
    /** the window title without the waiting marker, and whether the marker shows */
    private windowTitle = 'december'
    private waitingTitleShown = false
    /** Activity line (L0): phase latch and timing for the current turn */
    private readonly activityTracker = new ActivityTracker()
    private lastStreamActivityAt = 0
    private firstTokenAt = 0
    private statusSetAt = 0
    private turnPausedMs = 0
    private turnPauseStartedAt: number | undefined
    private hasReceivedToken = false
    private btwLoaderTimer: ReturnType<typeof setInterval> | null = null
    /** Queued prompt (as sent) to the input as typed, so ↑ restores paste placeholders (L14) */
    private queuedRawInputs = new Map<string, string>()
    /** The latest retry from the agent's AgentRetry event (F1); cleared when output resumes */
    private retryInfo:
        | { attempt: number; max?: number; reason: string; nextAt?: number }
        | undefined
    /** Checklist made from an approved /plan until the agent sends its own (F2) */
    private seededPlan:
        | { items: { text: string; status: 'pending' | 'in_progress' | 'done' }[]; at: number }
        | undefined
    /** Output tokens of the current turn, for the end-of-turn line (L16) */
    private turnOutputTokens = 0
    /** Files whose diff an approval prompt showed this turn, so the chat does not repeat it (S4.8) */
    private readonly previewedPaths = new Set<string>()
    private onSettingChangeCallback?: (settingId: string, newValue: string) => Promise<void> | void
    private onKillTaskCallback?: (taskId: string) => boolean | void
    private onClearCompletedTasksCallback?: () => void
    private onBackgroundForegroundCallback?: () => number
    /** re-renders running task durations once a second while the tasks overlay is open */
    private tasksTicker: ReturnType<typeof setInterval> | null = null
    /** task notices that arrived mid-turn; shown when the turn ends */
    private pendingTaskNotices: MessageItem[] = []
    private onSubmitCallback?: (prompt: string) => void
    private onAbortCallback?: () => void
    private onExitCallback?: () => void
    private onModelSelectCallback?: (model: ModelItem) => void
    private onModelMenuOpenCallback?: () => void
    private onModelRefreshCallback?: () => Promise<void> | void
    private keyCheckAbort?: AbortController
    private onCheckModelCallback?: (model: ModelItem) => {
        available: boolean
        fallback?: ModelItem
    }
    private getProviderModelsCallback?: (provider: string) => ModelItem[]
    private onCodeSearchCallback?: (query: string) => Promise<CodeSearchResultItem[]>
    private onOpenCodeSearchResultCallback?: (item: CodeSearchResultItem) => void
    private onInsertContextCallback?: (file: string, line?: number) => void
    private onEffortSelectCallback?: (level: ReasoningLevel) => Promise<void> | void
    private onLoginCallback?: (
        onCode: (code: string, url: string) => void,
        signal?: AbortSignal
    ) => Promise<{ token: string; email: string | null }>
    private onSubscriptionLoginCallback?: (
        provider: string,
        onCode?: (code: string, url: string) => void
    ) => Promise<any>
    private onSwitchSelectCallback?: (value: string) => Promise<void> | void
    private onDeleteProviderCallback?: (value: string) => Promise<void> | void
    private onSessionSelectCallback?: (sessionId: string) => Promise<void> | void
    private onSessionDeleteCallback?: (sessionId: string) => Promise<void> | void
    private onSessionRenameCallback?: (sessionId: string, newTitle: string) => Promise<void> | void
    private onRenameSessionCallback?: (title?: string) => Promise<string | void> | string | void
    private onRewindTurnCallback?: (snapshotId: string) => Promise<void> | void
    private onOpenBillingPortalCallback?: (url?: string) => void
    private questionResolveCallback?: (answers: string | string[]) => void
    sessionRepository?: any
    readonly workspaceFiles: string[] = []
    readonly recentFiles: Set<string> = new Set<string>()
    private onSaveApiKeyCallback?: (
        provider: string,
        apiKey: string,
        /** aborted when the user presses esc while the key is being checked */
        signal?: AbortSignal
    ) => Promise<ApiKeySaveResult | void> | ApiKeySaveResult | void
    private onOpenEditorCallback?: (filePath: string) => Promise<void> | void
    private isLoadingWorkspaceFiles = false
    private pendingQuestionAnswers: Record<string, string | string[]> = {}
    private pendingQuestionResolver?: (answers: Record<string, string | string[]>) => void
    private pendingToolPermissionResolver?: (
        decision: 'approve' | 'always' | 'git_tracked' | 'deny'
    ) => void
    private pendingPlanApprovalResolver?: (
        decision: 'approve' | 'refine' | 'view' | 'reject'
    ) => void
    private onSideQuestionCallback?: (
        question: string,
        handlers: {
            signal?: AbortSignal
            onChunk: (chunk: string) => void
            onComplete: () => void
            onError: (err: any) => void
        }
    ) => void
    private onExecuteDirectCommandCallback?: (command: string) => Promise<void> | void
    private onClearContextCallback?: () => Promise<void> | void
    private onNewContextCallback?: () => Promise<string | void> | string | void
    private onForkContextCallback?: (
        newSessionId?: string
    ) => Promise<string | void> | string | void
    private onLoadRewindTurnsCallback?: () => Promise<RewindTurnEntry[]> | RewindTurnEntry[]
    private onLoadSessionChangesCallback?: () => Promise<DiffFileEntry[] | null>
    /** Counts /diff loads, so a slow load does not overwrite a newer one */
    private diffLoadId = 0
    private onLoadUsageCallback?: () => Promise<UsageOverview | undefined>
    private authRequiredNotice?: string
    private pasteBuffer: string | null = null
    private streamRenderTimer: ReturnType<typeof setTimeout> | null = null
    private lastStreamRenderTime = 0
    private static readonly STREAM_THROTTLE_MS = 16 // 60fps streaming throttle window
    private toolRenderTimer: ReturnType<typeof setTimeout> | null = null
    private lastToolRenderTime = 0
    private static readonly TOOL_THROTTLE_MS = 33 // ~30fps max for tool output updates
    private renderScheduled = false
    private readonly scheduleFrame: ((callback: () => void) => void) | null
    /** Lay out only the newest turns while following the bottom (off under synchronous tests) */
    private readonly virtualizeHistory: boolean
    /** An idle pass is queued to lay out older turns the last frame skipped */
    private historyLayoutScheduled = false
    /** A frame was skipped because the terminal had not taken the last one yet */
    private paintOnDrain = false
    private unsubscribeDrain?: () => void
    /** Earliest time for the next paint when the terminal is slow to take output */
    private nextPaintAt = 0
    /** A frame write slower than this means the terminal is behind */
    private static readonly SLOW_WRITE_MS = 4
    private static readonly MAX_FRAME_DELAY_MS = 250
    /** DECEMBER_PERF=1 draws frame, output and first-token stats in the top-right corner */
    private readonly perfHud = process.env.DECEMBER_PERF === '1'
    private readonly perfStats = {
        frameMs: 0,
        avgFrameMs: 0,
        maxFrameMs: 0,
        frameBytes: 0,
        slowWrites: 0,
        droppedFrames: 0,
        ttftMs: 0,
    }
    private static readonly HISTORY_LAYOUT_BUDGET_MS = 8

    constructor(options?: DifferentialAppOptions) {
        this.terminal = options?.terminal ?? new TerminalController()
        this.screen = new DifferentialScreen({
            terminal: this.terminal,
            width: options?.width,
            height: options?.height,
            synchronized: options?.synchronized,
        })

        this.options = options
        const isTestEnv = process.env.NODE_ENV === 'test' || Boolean(process.env.BUN_TEST)
        this.scheduleFrame =
            options?.scheduleFrame ?? (isTestEnv ? null : (callback) => setImmediate(callback))
        this.virtualizeHistory = this.scheduleFrame !== null
        this.onSubmitCallback = options?.onSubmit
        this.onAbortCallback = options?.onAbort
        this.onExitCallback = options?.onExit
        this.onModelSelectCallback = options?.onModelSelect
        this.onCheckModelCallback = options?.onCheckModel
        this.onModelMenuOpenCallback = options?.onModelMenuOpen
        this.onModelRefreshCallback = options?.onModelRefresh
        this.getProviderModelsCallback = options?.getProviderModels
        this.onEffortSelectCallback = options?.onEffortSelect
        this.onLoginCallback = options?.onLogin
        this.onSubscriptionLoginCallback = options?.onSubscriptionLogin
        this.onSwitchSelectCallback = options?.onSwitchSelect
        this.onDeleteProviderCallback = options?.onDeleteProvider
        this.onCodeSearchCallback = options?.onCodeSearch
        this.onOpenCodeSearchResultCallback = options?.onOpenCodeSearchResult
        this.onInsertContextCallback = options?.onInsertContext
        this.onSideQuestionCallback = options?.onSideQuestion
        this.onSessionSelectCallback = options?.onSessionSelect
        this.onSessionDeleteCallback = options?.onSessionDelete
        this.onSessionRenameCallback = options?.onSessionRename
        this.onRenameSessionCallback = options?.onRenameSession
        this.onRewindTurnCallback = options?.onRewindTurn
        this.onOpenBillingPortalCallback = options?.onOpenBillingPortal
        this.sessionRepository = options?.sessionRepository
        this.onSaveApiKeyCallback = options?.onSaveApiKey
        this.onOpenEditorCallback = options?.onOpenEditor
        this.onExecuteDirectCommandCallback = options?.onExecuteDirectCommand
        this.onSettingChangeCallback = options?.onSettingChange
        this.attention = new AttentionNotifier({
            write: (data) => {
                if (this.terminal.stdout?.isTTY) this.terminal.write(data)
            },
            onAttention: options?.onAttention,
        })
        this.attention.mode = normalizeNotifyMode(options?.notifyMode)
        this.onKillTaskCallback = options?.onKillTask
        this.onClearCompletedTasksCallback = options?.onClearCompletedTasks
        this.onBackgroundForegroundCallback = options?.onBackgroundForeground
        this.onClearContextCallback = options?.onClearContext
        this.onNewContextCallback = options?.onNewContext
        this.onForkContextCallback = options?.onForkContext
        this.onLoadRewindTurnsCallback = options?.onLoadRewindTurns
        this.onLoadSessionChangesCallback = options?.onLoadSessionChanges
        this.onLoadUsageCallback = options?.onLoadUsage
        this.authRequiredNotice = options?.authRequiredNotice
        this.workspaceFiles = options?.workspaceFiles ? [...options.workspaceFiles] : []
        this.recentFiles = options?.recentFiles ? new Set(options.recentFiles) : new Set<string>()

        const initialThinking = options?.thinkingLevel || 'fast'
        const initialEffortIdx = REASONING_OPTIONS.findIndex((opt) => opt.value === initialThinking)

        this.state = {
            input: '',
            cursorPos: 0,
            messages: [],
            promptHistory: [],
            historyIndex: -1,
            isReadingMode: false,
            isStreaming: false,
            planMode: false,
            report: null,
            promptQueue: [],
            spinnerFrame: 0,
            statusMessage: undefined,
            updateStatus: undefined,
            pendingRestart: undefined,
            activeTip: null,
            cliVersion: options?.cliVersion || '0.4.15',
            latestVersion: options?.latestVersion,
            modelLabel: options?.modelLabel || 'Gemini 3.7 Flash',
            activeModel: options?.activeModel,
            authMethod: options?.authMethod,
            selectedProvider: options?.selectedProvider,
            isAuthenticated: options?.isAuthenticated ?? true,
            userEmail: options?.userEmail,
            decemberEmail: options?.decemberEmail,
            hasDecember: options?.hasDecember,
            cwd: options?.cwd,
            branch: options?.branch,
            contextTokens: options?.contextTokens || 0,
            maxContextTokens: options?.maxContextTokens,
            mcpServersCount: options?.mcpServersCount ?? 0,
            announcement: options?.announcement,
            showExitConfirm: false,
            toast: null,
            activeOverlay: 'none',
            overlayHistory: [],

            thinkingLevel: initialThinking,
            effortSelectedIndex: initialEffortIdx >= 0 ? initialEffortIdx : 0,

            helpActiveTab: 'general',
            helpCmdSelectedIndex: 0,
            helpCmdWindowStart: 0,
            helpShortcutSelectedIndex: 0,
            helpShortcutWindowStart: 0,

            loginSelectedIndex: 0,
            loginConfirmSwitch: false,

            // Session view state
            sessions: options?.sessions || [],
            sessionSelectedIndex: 0,
            sessionWindowStart: 0,
            sessionSearchQuery: '',
            isSessionSearching: false,
            sessionRenameMode: false,
            sessionRenameValue: '',
            sessionConfirmDeleteId: null,

            // Usage view state
            usageStats: options?.usageStats || {
                requests: 0,
                inputTokens: 0,
                outputTokens: 0,
                totalTokens: 0,
            },
            usageLoading: false,

            // Memory view state (AGENTS.md viewer)
            memoryReturnOverlay: 'none',
            memoryFile: null,
            memoryCursorLine: 0,
            memoryScrollOffset: 0,
            memoryIsLoading: false,

            // Rewind view state
            rewindTurns: options?.rewindTurns || [],
            rewindSelectedIndex: 0,
            rewindWindowStart: 0,
            rewindConfirming: false,

            // Ask question interactive state
            pendingQuestions: null,
            currentQuestionIndex: 0,
            questionSelectedIndex: 0,
            questionSelectedMulti: new Set(),
            questionCustomText: null,

            // Tool permission interactive state
            pendingToolCall: null,
            toolPermissionSelectedIndex: 0,

            // Plan approve interactive state
            pendingPlan: null,
            planApproveSelectedIndex: 0,

            // Auth view state
            authViewMode: 'menu',
            authProviders: BYOK_PROVIDER_ITEMS,
            authProviderSelectedIndex: 0,
            authProviderWindowStart: 0,
            authProviderSearchQuery: '',
            isSearchingAuthProviders: false,
            authApiKeyInput: '',
            authKeyError: null,
            authKeyChecking: false,
            modelSwitchConfirm: null,
            modelToolsConfirm: null,
            modelRefreshing: false,
            authMenuSelectedIndex: 0,
            authConfirmDeleteValue: null,
            authConfirmTarget: null,

            // File autocomplete dropup state
            fileAutocompleteItems: [],
            fileAutocompleteSelectedIndex: 0,
            fileAutocompleteWindowStart: 0,
            isFileAutocompleteVisible: false,

            sessionId: options?.sessionId,
            sessionTitle: options?.sessionTitle,
            configPath: options?.configPath,

            commandSelectedIndex: 0,
            commandWindowStart: 0,

            models: options?.models || [],
            modelSearchQuery: '',
            modelSelectedIndex: 0,
            modelWindowStart: 0,
            isModelSearching: false,

            diffFiles: [],
            diffScope: 'all',
            diffAllFiles: [],
            diffSessionFiles: null,
            isDiffLoading: false,
            diffSelectedIndex: 0,
            diffWindowStart: 0,
            isDiffDetailView: false,
            isDiffFullFile: false,
            diffScrollOffset: 0,
            diffCursorLineIndex: 0,
            diffFilePositions: {},
            diffFullContents: {},

            tasks: orderTasks(options?.tasks || []),
            tasksSelectedIndex: 0,
            tasksWindowStart: 0,
            tasksConfirmStop: null,
            fileViewTaskId: null,

            settingsSelectedIndex: 0,
            // Copy each row: toggles change rows in place, and must not leak into the caller's array
            settings: (options?.settings ?? DEFAULT_SETTINGS).map((item) => ({ ...item })),

            skillsDetailSkill: null,
            skillsIsDetailView: false,
            skillsDetailContent: null,
            skillsDetailLines: [],
            skillsDetailLoading: false,
            skillsDetailError: null,
            skillsCursorLine: 0,
            skillsScrollOffset: 0,

            codeSearchQuery: '',
            codeSearchResults: [],
            codeSearchGroups: [],
            codeSearchSelectedIndex: 0,
            codeSearchWindowStart: 0,

            fileViewPath: '',
            fileViewLines: [],
            fileViewCursorLine: 0,
            fileViewScrollOffset: 0,
            fileViewIsLoading: false,
            fileViewError: null,
            fileViewReturnOverlay: 'none',
            fileViewSearchQuery: undefined,
            fileViewMatchLines: undefined,
            fileViewCurrentMatchIndex: undefined,

            btwState: null,
            btwScrollOffset: 0,

            switchItems: options?.switchItems ? [...options.switchItems] : [],
            switchSelectedIndex: 0,
            switchConfirmDeleteValue: null,

            mcpServersList: [],
            mcpSelectedIndex: 0,
            mcpWindowStart: 0,
            mcpIsDetailView: false,
            mcpScrollOffset: 0,
            mcpMode: 'list',
            mcpConfirmDeleteName: null,
            mcpDetailOnly: false,
            mcpCustomName: '',
            mcpCustomCommand: '',
            mcpCustomScope: 'global',
            mcpCustomEager: false,
            mcpCustomEnv: '',
            mcpCustomActiveField: 0,

            pluginActiveTab: 'installed',
            pluginScreen: 'list',
            pluginSearchQuery: '',
            pluginIsSearching: false,
            pluginKindFilter: 'all',
            pluginMarketFilter: null,
            pluginSelectedIndex: 0,
            pluginWindowStart: 0,
            pluginDetailKey: null,
            pluginActionIndex: 0,
            pluginInstallId: null,
            pluginInstallScope: 'user',
            pluginInputKind: 'install-source',
            pluginInputValue: '',
            pluginConfirm: null,
            pluginBusy: null,
            pluginLoading: false,
            pluginCatalog: { installed: [], discover: [], marketplaces: [] },
        }

        this.refreshModelsForProvider(this.state.selectedProvider)

        this.screen.onResize(() => {
            this.lineCache.clear()
            this.render()
        })
    }

    start(): void {
        if (this.isRunning) return
        this.isRunning = true

        this.screen.start()
        this.unsubscribeDrain = this.terminal.onDrain(() => {
            if (!this.paintOnDrain) return
            this.paintOnDrain = false
            this.render()
        })

        this.stdinListener = (data) => {
            let str = data.toString()
            if (this.pasteBuffer !== null) {
                this.pasteBuffer += str
                const pasteEnd = this.pasteBuffer.indexOf('\x1b[201~')
                if (pasteEnd !== -1) {
                    const fullPaste = this.pasteBuffer.slice(0, pasteEnd + 6)
                    const remaining = this.pasteBuffer.slice(pasteEnd + 6)
                    this.pasteBuffer = null
                    this.handleKey(fullPaste)
                    if (remaining) {
                        str = remaining
                    } else {
                        return
                    }
                } else {
                    return
                }
            }

            const pasteStart = str.indexOf('\x1b[200~')
            if (pasteStart !== -1) {
                const pasteEnd = str.indexOf('\x1b[201~', pasteStart + 6)
                if (pasteEnd === -1) {
                    const before = str.slice(0, pasteStart)
                    this.pasteBuffer = str.slice(pasteStart)
                    if (before) {
                        str = before
                    } else {
                        return
                    }
                }
            }

            const sequences = splitInputSequences(str)
            if (sequences.length === 0) return

            if (sequences.length === 1) {
                this.handleKey(sequences[0]!)
                return
            }

            this.isBatchingInput = true
            try {
                for (const seq of sequences) {
                    this.handleKey(seq)
                }
            } finally {
                this.isBatchingInput = false
                this.render()
            }
        }

        if (this.terminal.stdin && typeof this.terminal.stdin.on === 'function') {
            this.terminal.stdin.on('data', this.stdinListener)
        }

        if (
            this.workspaceFiles.length === 0 &&
            process.env.NODE_ENV !== 'test' &&
            !process.env.BUN_TEST
        ) {
            this.refreshWorkspaceFiles().catch(() => {
                // Intentionally swallowed: initial workspace indexing fallback
            })
        }

        this.render()
    }

    stop(): void {
        if (!this.isRunning) return
        this.isRunning = false
        this.unsubscribeDrain?.()
        this.unsubscribeDrain = undefined

        this.stopSpinner()
        if (this.btwLoaderTimer) {
            clearInterval(this.btwLoaderTimer)
            this.btwLoaderTimer = null
        }
        if (this.tasksTicker) {
            clearInterval(this.tasksTicker)
            this.tasksTicker = null
        }

        if (this.exitTimer) {
            clearTimeout(this.exitTimer)
            this.exitTimer = null
        }
        if (this.toastTimer) {
            clearTimeout(this.toastTimer)
            this.toastTimer = null
        }
        if (this.streamRenderTimer) {
            clearTimeout(this.streamRenderTimer)
            this.streamRenderTimer = null
        }
        if (this.updateStatusTimer) {
            clearInterval(this.updateStatusTimer)
            this.updateStatusTimer = null
        }

        if (
            this.stdinListener &&
            this.terminal.stdin &&
            typeof this.terminal.stdin.removeListener === 'function'
        ) {
            this.terminal.stdin.removeListener('data', this.stdinListener)
            this.stdinListener = undefined
        }

        this.screen.stop()
    }

    getAllCommands(): { name: string; description: string; args?: string }[] {
        return COMMANDS.map((c) => ({
            name: c.name,
            description: c.description,
            args: c.args,
        })).sort((a, b) => a.name.localeCompare(b.name))
    }

    /**
     * sets the display title of the active session and mirrors it to the
     * terminal window title. pass undefined for an untitled session.
     */
    setSessionTitle(title?: string): void {
        this.state.sessionTitle = title || undefined
        const active = this.state.sessions.find((s) => s.id === this.state.sessionId)
        if (active && title) active.title = title
        this.windowTitle = title ? `december · ${title}` : 'december'
        this.terminal.setWindowTitle?.(
            this.waitingTitleShown ? `● ${this.windowTitle}` : this.windowTitle
        )
    }

    /** #617: sets how December tells the user it needs them (the "Notify me" setting) */
    setNotifyMode(mode: string): void {
        this.attention.mode = normalizeNotifyMode(mode)
    }

    /**
     * #617: an approval prompt opened. Fires the Notification hook, and the bell or desktop
     * notification when the setting and focus allow it.
     */
    private notifyAttention(reason: AttentionReason): void {
        const now = Date.now()
        let elapsedMs = 0
        if (this.streamStartTime) elapsedMs = now - this.streamStartTime
        // A plan approval opens right after its turn ends: count that turn
        else if (this.lastTurnEndedAt && now - this.lastTurnEndedAt < 5_000) {
            elapsedMs = this.lastTurnEndedAt - this.lastTurnStartedAt
        }
        this.attention.notify(reason, elapsedMs)
    }

    /** #617: "● " in front of the window title while an approval prompt waits */
    private syncWaitingTitle(): void {
        const waiting = DifferentialApp.APPROVAL_OVERLAYS.has(this.state.activeOverlay)
        if (waiting === this.waitingTitleShown) return
        this.waitingTitleShown = waiting
        this.terminal.setWindowTitle?.(waiting ? `● ${this.windowTitle}` : this.windowTitle)
    }

    showToast(message: string, variant: 'success' | 'error' | 'info' = 'info'): void {
        if (this.toastTimer) {
            clearTimeout(this.toastTimer)
        }
        this.state.toast = { message, variant }
        this.render()
        this.toastTimer = setTimeout(() => {
            this.state.toast = null
            this.render()
        }, 3000)
    }

    startSpinner(): void {
        if (this.streamStartTime === 0) {
            this.streamStartTime = Date.now()
        }
        if (this.spinnerTimer) return
        this.spinnerTimer = setInterval(() => {
            this.state.spinnerFrame = (this.state.spinnerFrame + 1) % 10
            if (
                this.state.isStreaming &&
                Date.now() - this.streamStartTime >= 2000 &&
                !this.state.activeTip
            ) {
                this.state.activeTip = getNextTip()
            }
            // Redraw only while something animates: the activity line, or a running step's dot
            const hasAnimation =
                this.state.isStreaming ||
                this.state.messages.some((m) => m.toolCall?.status === 'running')

            if (hasAnimation) {
                this.render()
            }
        }, 80)
    }

    stopSpinner(): void {
        if (this.spinnerTimer) {
            clearInterval(this.spinnerTimer)
            this.spinnerTimer = null
        }
        this.state.spinnerFrame = 0
    }

    /**
     * Show or clear the lasting update status line. The elapsed time ticks once per
     * second so long installs never look stuck.
     */
    setUpdateStatus(message?: string): void {
        if (!message) {
            this.state.updateStatus = undefined
            if (this.updateStatusTimer) {
                clearInterval(this.updateStatusTimer)
                this.updateStatusTimer = null
            }
            this.render()
            return
        }
        const startedAt = this.state.updateStatus?.startedAt ?? Date.now()
        this.state.updateStatus = { message, startedAt }
        if (!this.updateStatusTimer) {
            this.updateStatusTimer = setInterval(() => this.render(), 1000)
        }
        this.render()
    }

    getUpdateStatusText(): string | undefined {
        const status = this.state.updateStatus
        if (!status) return undefined
        const seconds = Math.floor((Date.now() - status.startedAt) / 1000)
        // Shown as plain text in the status row: "updating to v0.4.16 12s" (L17)
        const message = status.message.charAt(0).toLowerCase() + status.message.slice(1)
        return `${message} ${seconds}s`
    }

    setPendingRestart(version?: string): void {
        this.state.pendingRestart = version ? { version, dismissed: false } : undefined
        this.render()
    }

    /**
     * Stop drawing and release the terminal for good. Used before another process
     * takes over the screen, so late timers in this process cannot paint over it.
     */
    handOffTerminal(): void {
        this.stop()
        this.isDetached = true
    }

    private requestRestart(): void {
        if (!this.options?.onRestart) {
            this.showToast('Exit with /exit and run "december --resume" to restart.', 'info')
            return
        }
        const res = this.options.onRestart()
        if (res && typeof (res as Promise<void>).catch === 'function') {
            ;(res as Promise<void>).catch((err: any) => {
                this.showToast(`Could not restart: ${err?.message || err}`, 'error')
            })
        }
    }

    setStatusMessage(msg?: string): void {
        if (this.state.statusMessage === msg) return
        this.state.statusMessage = msg
        this.statusSetAt = Date.now()
        this.render()
    }

    /** Shows a retry in the activity line from the agent's typed AgentRetry event (F1) */
    setRetry(info?: {
        attempt: number
        maxAttempts?: number
        delayMs?: number
        reason: string
    }): void {
        this.retryInfo = info
            ? {
                  attempt: info.attempt,
                  max: info.maxAttempts,
                  reason: info.reason,
                  nextAt: info.delayMs !== undefined ? Date.now() + info.delayMs : undefined,
              }
            : undefined
        this.render()
    }

    clearStatusMessage(): void {
        this.retryInfo = undefined
        if (this.state.statusMessage === undefined) return
        this.state.statusMessage = undefined
        this.render()
    }

    async openFileView(
        filePath: string,
        targetLine = 1,
        returnOverlay: OverlayType = 'none',
        searchQuery?: string,
        matchLines?: number[],
        contentLines?: string[]
    ): Promise<void> {
        this.state.activeOverlay = 'fileview'
        this.state.fileViewPath = filePath
        this.state.fileViewTaskId = null
        this.state.fileViewReturnOverlay = returnOverlay
        this.state.fileViewSearchQuery = searchQuery
        this.state.fileViewMatchLines = matchLines || []
        this.state.fileViewIsLoading = !contentLines
        this.state.fileViewError = null
        this.state.fileViewLines = contentLines || []
        const line0 = Math.max(0, targetLine - 1)
        this.state.fileViewCursorLine = line0
        this.state.fileViewScrollOffset = Math.max(0, line0 - 5)

        // Index case-insensitive search matches from in-memory content if provided
        if (contentLines && searchQuery && searchQuery.trim()) {
            const lowerQ = searchQuery.trim().toLowerCase()
            const dynamicMatches: number[] = []
            for (let i = 0; i < contentLines.length; i++) {
                const line = contentLines[i]
                if (line && line.toLowerCase().includes(lowerQ)) {
                    dynamicMatches.push(i + 1)
                }
            }
            if (dynamicMatches.length > 0) {
                this.state.fileViewMatchLines = dynamicMatches
            }
        }

        const effectiveMatches = this.state.fileViewMatchLines || []
        if (effectiveMatches.length > 0) {
            const foundIdx = effectiveMatches.indexOf(targetLine)
            this.state.fileViewCurrentMatchIndex = foundIdx !== -1 ? foundIdx : 0
        } else {
            this.state.fileViewCurrentMatchIndex = 0
        }

        this.render()

        if (contentLines) {
            return
        }

        try {
            const { lines } = await FileViewMenuView.loadFile(
                filePath,
                this.state.cwd || process.cwd()
            )
            this.state.fileViewLines = lines
            this.state.fileViewIsLoading = false
            const clampedLine = lines.length > 0 ? Math.min(lines.length - 1, line0) : 0
            this.state.fileViewCursorLine = clampedLine
            const visibleLineCount = Math.max(5, this.screen.height - 4)
            this.state.fileViewScrollOffset = Math.max(
                0,
                clampedLine - Math.floor(visibleLineCount / 2)
            )

            // Dynamic case-insensitive match line indexing from loaded file content
            if (searchQuery && searchQuery.trim()) {
                const lowerQ = searchQuery.trim().toLowerCase()
                const dynamicMatches: number[] = []
                for (let i = 0; i < lines.length; i++) {
                    const line = lines[i]
                    if (line && line.toLowerCase().includes(lowerQ)) {
                        dynamicMatches.push(i + 1)
                    }
                }
                if (dynamicMatches.length > 0) {
                    this.state.fileViewMatchLines = dynamicMatches
                    const target1 = clampedLine + 1
                    const foundIdx = dynamicMatches.indexOf(target1)
                    if (foundIdx !== -1) {
                        this.state.fileViewCurrentMatchIndex = foundIdx
                    } else {
                        const closestIdx = dynamicMatches.findIndex((m) => m >= target1)
                        this.state.fileViewCurrentMatchIndex = closestIdx !== -1 ? closestIdx : 0
                    }
                }
            }
        } catch (err: any) {
            this.state.fileViewIsLoading = false
            this.state.fileViewError = err?.message || 'Failed to read file'
        }
        this.render()
    }

    refreshUsageStats(): void {
        let requests = 0
        let inputTokens = 0
        let outputTokens = 0
        let cacheReadTokens = 0

        for (const msg of this.state.messages) {
            if (msg && msg.usage) {
                inputTokens += msg.usage.promptTokens || 0
                outputTokens += msg.usage.completionTokens || 0
                cacheReadTokens +=
                    (msg.usage as any).cacheReadInputTokens ||
                    (msg.usage as any).cacheReadTokens ||
                    0
                requests++
            }
        }

        this.state.usageStats = {
            requests,
            inputTokens,
            outputTokens,
            cacheReadTokens,
            totalTokens: inputTokens + outputTokens,
        }
    }

    getEffectiveContextTokens(): number {
        if (this.state.contextTokens && this.state.contextTokens > 0) {
            return this.state.contextTokens
        }
        for (let i = this.state.messages.length - 1; i >= 0; i--) {
            const m = this.state.messages[i]
            if (m && m.usage && m.usage.promptTokens) {
                return (m.usage.promptTokens || 0) + (m.usage.completionTokens || 0)
            }
        }
        if (this.state.usageStats && this.state.usageStats.inputTokens > 0) {
            return this.state.usageStats.inputTokens
        }
        let charCount = 0
        for (const m of this.state.messages) {
            if (m && m.content) {
                charCount += m.content.length
            }
        }
        if (charCount > 0) {
            return Math.ceil(charCount / 4)
        }
        return 0
    }

    async loadUsageOverview(): Promise<void> {
        if (!this.onLoadUsageCallback) {
            this.state.usageLoading = false
            this.render()
            return
        }
        this.state.usageLoading = true
        try {
            const overview = await this.onLoadUsageCallback()
            if (overview) this.state.usageOverview = overview
        } catch {
            // Intentionally swallowed: the view keeps the last overview or shows its unavailable state
        } finally {
            this.state.usageLoading = false
            this.render()
        }
    }

    private getUsageDashboard(): { name: string; url: string } {
        const name =
            this.state.authMethod === 'december'
                ? 'december'
                : (this.state.selectedProvider || 'december').toLowerCase()
        const url =
            PROVIDER_BILLING_LINKS[name] ||
            PROVIDER_BILLING_LINKS.december ||
            'https://app.trydecember.com/settings/billing'
        return { name, url }
    }

    async loadRewindTurns(): Promise<void> {
        if (!this.onLoadRewindTurnsCallback) return
        try {
            const result = this.onLoadRewindTurnsCallback()
            const turns =
                result && typeof (result as Promise<any>).then === 'function'
                    ? await result
                    : (result as RewindTurnEntry[])
            if (Array.isArray(turns)) {
                this.state.rewindTurns = turns
                this.render()
            }
        } catch {
            // Intentionally swallowed: fail silently on loading rewind turns
        }
    }

    async openSkillDetail(skill: SkillItem): Promise<void> {
        this.state.skillsDetailSkill = skill
        this.state.skillsIsDetailView = true
        this.state.skillsCursorLine = 0
        this.state.skillsScrollOffset = 0
        this.state.skillsDetailLoading = true
        this.state.skillsDetailError = null
        this.state.skillsDetailLines = []
        this.render()

        if (!skill.entryFilePath) {
            this.state.skillsDetailLoading = false
            this.state.skillsDetailError = 'No entry file path found for skill.'
            this.render()
            return
        }

        try {
            const content = await fs.promises.readFile(skill.entryFilePath, 'utf8')
            this.state.skillsDetailContent = content
            this.state.skillsDetailLines = content.split(/\r?\n/)
            this.state.skillsDetailLoading = false
            this.state.skillsDetailError = null
        } catch (e: any) {
            // Intentionally swallowed: display read error in skill detail viewport
            this.state.skillsDetailLoading = false
            this.state.skillsDetailError = e?.message || 'Failed to read skill documentation file.'
            this.state.skillsDetailLines = []
        }
        this.render()
    }

    async openMcpView(focusServer?: string): Promise<void> {
        this.state.activeOverlay = 'mcp'
        this.state.mcpSelectedIndex = 0
        this.state.mcpWindowStart = 0
        this.state.mcpIsDetailView = false
        this.state.mcpScrollOffset = 0
        this.state.mcpMode = 'list'
        this.state.mcpConfirmDeleteName = null
        this.state.mcpDetailOnly = false
        this.state.mcpCustomName = ''
        this.state.mcpCustomCommand = ''
        this.state.mcpCustomScope = 'global'
        this.state.mcpCustomEager = false
        this.state.mcpCustomEnv = ''
        this.state.mcpCustomActiveField = 0
        this.render()
        await this.loadMcpServers()
        if (focusServer) {
            const index = this.state.mcpServersList.findIndex((s) => s.name === focusServer)
            if (index >= 0) {
                this.state.mcpSelectedIndex = index
                this.state.mcpIsDetailView = true
                this.state.mcpMode = 'detail'
                this.state.mcpDetailOnly = true
                this.render()
            }
        }
    }

    async loadMcpServers(): Promise<void> {
        if (this.options?.onLoadMcpServers) {
            try {
                const groupOrder = (s: McpServerMenuItem) =>
                    s.plugin ? 2 : s.scope === 'project' ? 0 : 1
                this.state.mcpServersList = (await this.options.onLoadMcpServers()).sort(
                    (a, b) => groupOrder(a) - groupOrder(b) || a.name.localeCompare(b.name)
                )
                this.state.mcpServersCount = this.state.mcpServersList.filter(
                    (s) => s.status === 'connected'
                ).length
                this.render()
            } catch {
                // Intentionally swallowed: ignore mcp load error
            }
        }
    }

    async openPluginView(options?: {
        tab?: PluginTab
        kindFilter?: PluginKindFilter
    }): Promise<void> {
        this.state.activeOverlay = 'plugin'
        this.state.pluginActiveTab = options?.tab || 'installed'
        this.state.pluginKindFilter = options?.kindFilter || 'all'
        this.state.pluginMarketFilter = null
        this.state.pluginScreen = 'list'
        this.state.pluginSearchQuery = ''
        this.state.pluginIsSearching = false
        this.state.pluginSelectedIndex = 0
        this.state.pluginWindowStart = 0
        this.state.pluginDetailKey = null
        this.state.pluginConfirm = null
        this.state.pluginBusy = null
        this.render()
        await this.loadPlugins()
    }

    async loadPlugins(): Promise<void> {
        if (!this.options?.onLoadPlugins) return
        this.state.pluginLoading = true
        try {
            this.state.pluginCatalog = await this.options.onLoadPlugins()
            const total = this.getPluginList().items.length
            this.state.pluginSelectedIndex = Math.min(
                this.state.pluginSelectedIndex,
                Math.max(0, total - 1)
            )
        } catch (err: any) {
            this.showToast(`Failed to load plugins: ${err?.message || err}`, 'error')
        } finally {
            this.state.pluginLoading = false
            this.render()
        }
    }

    /** The rows the current /plugin tab shows, after search and filters */
    getPluginList(): PluginList {
        return buildPluginList({
            tab: this.state.pluginActiveTab,
            installed: this.state.pluginCatalog.installed,
            discover: this.state.pluginCatalog.discover,
            marketplaces: this.state.pluginCatalog.marketplaces,
            query: this.state.pluginSearchQuery,
            kindFilter: this.state.pluginKindFilter,
            marketFilter: this.state.pluginMarketFilter,
        })
    }

    private enabledSkillsCache: SkillItem[] | null = null

    /** Turned-on skills, for /skill:<name> lookups. Hosts and tests can inject them. */
    private getEnabledSkills(): SkillItem[] {
        if (this.options?.skills) return this.options.skills
        if (!this.enabledSkillsCache) {
            try {
                this.enabledSkillsCache = new SkillDiscoveryEngine({
                    workspaceDir: this.state.cwd || process.cwd(),
                })
                    .discoverAllSkills()
                    .map((s) => ({
                        name: s.name,
                        description: s.metadata?.description || '',
                        origin: s.origin,
                        directoryPath: s.directoryPath,
                        entryFilePath: s.entryFilePath,
                    }))
            } catch {
                // Intentionally swallowed: no skills when discovery fails
                this.enabledSkillsCache = []
            }
        }
        return this.enabledSkillsCache
    }

    private findInstalledRow(key: string | null): ExtensionRow | null {
        if (!key) return null
        for (const row of this.state.pluginCatalog.installed) {
            if (row.key === key) return row
            const child = row.children?.find((c) => c.key === key)
            if (child) return child
        }
        return null
    }

    private pluginDetailActions(row: ExtensionRow): Array<{ id: string; label: string }> {
        const actions = [
            { id: 'toggle', label: row.enabled ? 'Turn off plugin' : 'Turn on plugin' },
        ]
        if (row.updatable) {
            actions.push({
                id: 'update',
                label:
                    row.updateAvailable && row.latestVersion
                        ? `Update to v${row.latestVersion}`
                        : 'Update',
            })
        }
        if (row.removable) actions.push({ id: 'uninstall', label: 'Uninstall' })
        return actions
    }

    private pluginInstallPaths(name: string): Record<PluginInstallScope, string> {
        return {
            user: `~/.december/plugins/${name}`,
            project: `.december/plugins/${name}`,
        }
    }

    private setPluginTab(tab: PluginTab): void {
        this.state.pluginActiveTab = tab
        this.state.pluginSelectedIndex = 0
        this.state.pluginWindowStart = 0
        this.state.pluginSearchQuery = ''
        this.state.pluginIsSearching = false
        this.state.pluginScreen = 'list'
        this.render()
    }

    /** Runs a plugin action with a busy line, a result toast, and a reload */
    private runPluginTask(
        busy: string,
        task: () => Promise<string | void>,
        options?: { backToList?: boolean }
    ): void {
        if (this.state.pluginBusy) return
        this.state.pluginBusy = busy
        this.render()
        task()
            .then(async (message) => {
                this.state.pluginBusy = null
                if (options?.backToList) this.state.pluginScreen = 'list'
                await this.loadPlugins()
                if (message) this.showToast(message, 'success')
            })
            .catch((err: any) => {
                this.state.pluginBusy = null
                this.showToast(err?.message || String(err), 'error')
                this.render()
            })
    }

    private pluginRestartNote(restartRequired?: boolean): string {
        return restartRequired ? ' Restart December to apply it to the agent.' : ''
    }

    private runPluginConfirm(confirm: PluginConfirmAction): void {
        const opts = this.options
        if (confirm.action === 'uninstall' && opts?.onUninstallPlugin) {
            const uninstall = opts.onUninstallPlugin
            this.runPluginTask(
                `Uninstalling ${confirm.id}`,
                async () => {
                    await uninstall(confirm.id)
                    return `Uninstalled ${confirm.id}.${this.pluginRestartNote(true)}`
                },
                { backToList: true }
            )
        } else if (confirm.action === 'remove-mcp' && opts?.onRemoveMcpServer) {
            const remove = opts.onRemoveMcpServer
            this.runPluginTask(`Removing ${confirm.id}`, async () => {
                await remove(confirm.id, confirm.scope)
                return `Removed MCP server ${confirm.id}.`
            })
        } else if (confirm.action === 'remove-marketplace' && opts?.onRemoveMarketplace) {
            const remove = opts.onRemoveMarketplace
            this.runPluginTask(`Removing ${confirm.id}`, async () => {
                await remove(confirm.id)
                return `Removed marketplace ${confirm.id}. Plugins you installed from it stay installed.`
            })
        } else {
            this.render()
        }
    }

    private updatePluginById(id: string, name: string): void {
        const update = this.options?.onUpdatePlugin
        if (!update) return
        this.runPluginTask(`Updating ${name}`, async () => {
            const result = await update(id)
            const version = result.version ? ` to v${result.version}` : ''
            return `Updated ${result.name}${version}.${this.pluginRestartNote(true)}`
        })
    }

    private openPluginInput(kind: PluginInputKind): void {
        this.state.pluginScreen = 'input'
        this.state.pluginInputKind = kind
        this.state.pluginInputValue = ''
        this.state.pluginInstallScope = 'user'
        this.render()
    }

    private openPluginRow(item: PluginSelectable): void {
        if (item.type === 'marketplace') {
            this.state.pluginMarketFilter = item.row.name
            this.setPluginTab('discover')
            return
        }

        if (item.type === 'discover') {
            const row = item.row
            if (row.installed) {
                if (row.updateAvailable) {
                    this.updatePluginById(row.name, row.name)
                } else {
                    this.showToast(
                        `${row.name} is already installed. Manage it in Installed.`,
                        'info'
                    )
                }
                return
            }
            this.state.pluginInstallId = row.id
            this.state.pluginInstallScope = row.defaultScope || 'user'
            this.state.pluginScreen = 'install'
            this.render()
            return
        }

        const row = item.row
        if (row.kind === 'plugin') {
            this.state.pluginDetailKey = row.key
            this.state.pluginActionIndex = 0
            this.state.pluginScreen = 'details'
            this.render()
            return
        }
        if (row.kind === 'skill') {
            this.state.overlayHistory.push('plugin')
            this.state.activeOverlay = 'skills'
            this.openSkillDetail({
                name: row.name,
                description: row.description,
                entryFilePath: row.entryFilePath,
                directoryPath: row.path,
            }).catch(() => {
                // Intentionally swallowed: openSkillDetail shows read errors in the viewer
            })
            return
        }
        if (!row.enabled) {
            this.showToast(`${row.name} is off. Press space to turn it on first.`, 'info')
            return
        }
        this.state.overlayHistory.push('plugin')
        this.openMcpView(row.id).catch(() => {
            // Intentionally swallowed: openMcpView reports load errors itself
        })
    }

    private askToRemovePluginRow(row: ExtensionRow): void {
        if (row.kind === 'plugin' && row.removable) {
            this.state.pluginConfirm = {
                action: 'uninstall',
                id: row.id,
                message: `Uninstall ${row.name}?`,
            }
        } else if (row.kind === 'mcp' && row.parentPlugin) {
            this.showToast(
                `${row.name} comes from the ${row.parentPlugin} plugin. Uninstall the plugin instead.`,
                'info'
            )
            return
        } else if (row.kind === 'mcp' && row.mcpScope) {
            this.state.pluginConfirm = {
                action: 'remove-mcp',
                id: row.id,
                scope: row.mcpScope,
                message: `Remove MCP server ${row.name}?`,
            }
        } else if (row.kind === 'skill') {
            this.showToast(
                `Skills are not removed from here. Turn it off, or delete its folder: ${row.path || row.source}`,
                'info'
            )
            return
        }
        this.render()
    }

    private submitPluginInput(): void {
        const value = this.state.pluginInputValue.trim()
        if (!value) {
            this.showToast('Enter a folder path, git url, or owner/repo.', 'error')
            return
        }
        if (this.state.pluginInputKind === 'install-source') {
            const install = this.options?.onInstallPluginFromSource
            if (!install) return
            const scope = this.state.pluginInstallScope
            this.runPluginTask(
                `Installing from ${value}`,
                async () => {
                    const result = await install(value, scope)
                    this.state.pluginInputValue = ''
                    return `Installed ${result.name}.${this.pluginRestartNote(true)}`
                },
                { backToList: true }
            )
            return
        }
        const add = this.options?.onAddMarketplace
        if (!add) return
        this.runPluginTask(
            `Adding ${value}`,
            async () => {
                const result = await add(value)
                this.state.pluginInputValue = ''
                return `Added ${result.name} with ${result.available} plugins. Find them in Discover.`
            },
            { backToList: true }
        )
    }

    private handlePluginKey(key: string): void {
        const isEnter = key === '\r' || key === '\n'
        const isUp = key === '\x1b[A'
        const isDown = key === '\x1b[B'
        const isBackspace = key === '\x7f' || key === '\b'
        const isPrintable = key.length === 1 && key >= ' ' && key !== '\x7f'

        if (this.state.pluginBusy) return

        if (this.state.pluginConfirm) {
            if (key === 'y' || key === 'Y') {
                const confirm = this.state.pluginConfirm
                this.state.pluginConfirm = null
                this.runPluginConfirm(confirm)
            } else if (key === 'n' || key === 'N') {
                this.state.pluginConfirm = null
                this.render()
            }
            return
        }

        const screen = this.state.pluginScreen

        if (screen === 'input') {
            if (isEnter) {
                this.submitPluginInput()
            } else if (key === '\t' || key === '\x1b[Z') {
                if (this.state.pluginInputKind === 'install-source') {
                    this.state.pluginInstallScope =
                        this.state.pluginInstallScope === 'user' ? 'project' : 'user'
                    this.render()
                }
            } else if (isBackspace) {
                this.state.pluginInputValue = this.state.pluginInputValue.slice(0, -1)
                this.render()
            } else if (isPrintable) {
                this.state.pluginInputValue += key
                this.render()
            }
            return
        }

        if (screen === 'install') {
            const row = this.state.pluginCatalog.discover.find(
                (d) => d.id === this.state.pluginInstallId
            )
            if (isUp || isDown || key === '\t') {
                this.state.pluginInstallScope =
                    this.state.pluginInstallScope === 'user' ? 'project' : 'user'
                this.render()
            } else if (isEnter && row && this.options?.onInstallPlugin) {
                const install = this.options.onInstallPlugin
                const scope = this.state.pluginInstallScope
                this.runPluginTask(
                    `Installing ${row.name}`,
                    async () => {
                        const result = await install(row.id, scope)
                        return `Installed ${result.name}.${this.pluginRestartNote(true)}`
                    },
                    { backToList: true }
                )
            }
            return
        }

        if (screen === 'details') {
            const row = this.findInstalledRow(this.state.pluginDetailKey)
            if (!row) {
                this.state.pluginScreen = 'list'
                this.render()
                return
            }
            const actions = this.pluginDetailActions(row)
            if (isUp || key === 'k') {
                this.state.pluginActionIndex = Math.max(0, this.state.pluginActionIndex - 1)
                this.render()
            } else if (isDown || key === 'j') {
                this.state.pluginActionIndex = Math.min(
                    actions.length - 1,
                    this.state.pluginActionIndex + 1
                )
                this.render()
            } else if (isEnter) {
                const action = actions[this.state.pluginActionIndex]
                if (action?.id === 'toggle') this.togglePluginRow(row)
                if (action?.id === 'update') this.updatePluginById(row.id, row.name)
                if (action?.id === 'uninstall') this.askToRemovePluginRow(row)
            }
            return
        }

        const list = this.getPluginList()
        const total = list.items.length
        const current = list.items[this.state.pluginSelectedIndex]
        const resetSelection = () => {
            this.state.pluginSelectedIndex = 0
            this.state.pluginWindowStart = 0
        }

        if (this.state.pluginIsSearching && !isUp && !isDown) {
            if (isEnter) {
                this.state.pluginIsSearching = false
            } else if (isBackspace) {
                this.state.pluginSearchQuery = this.state.pluginSearchQuery.slice(0, -1)
                resetSelection()
            } else if (isPrintable) {
                this.state.pluginSearchQuery += key
                resetSelection()
            } else {
                return
            }
            this.render()
            return
        }

        const tabIndex = PLUGIN_TABS.indexOf(this.state.pluginActiveTab)
        if (key === '\t' || key === '\x1b[C') {
            this.state.pluginMarketFilter = null
            this.setPluginTab(PLUGIN_TABS[(tabIndex + 1) % PLUGIN_TABS.length]!)
            return
        }
        if (key === '\x1b[Z' || key === '\x1b[D') {
            this.state.pluginMarketFilter = null
            this.setPluginTab(
                PLUGIN_TABS[(tabIndex - 1 + PLUGIN_TABS.length) % PLUGIN_TABS.length]!
            )
            return
        }
        if (isUp || key === 'k') {
            if (this.state.pluginSelectedIndex > 0) {
                this.state.pluginSelectedIndex -= 1
                this.render()
            }
            return
        }
        if (isDown || key === 'j') {
            if (this.state.pluginSelectedIndex < total - 1) {
                this.state.pluginSelectedIndex += 1
                this.render()
            }
            return
        }
        if (key === '/') {
            this.state.pluginIsSearching = true
            this.render()
            return
        }

        const tab = this.state.pluginActiveTab
        if (isEnter) {
            if (current) this.openPluginRow(current)
            return
        }

        if (tab === 'installed') {
            if (key === ' ' && current?.type === 'extension') {
                const row = current.row
                if (row.kind === 'mcp' && row.parentPlugin) {
                    this.showToast(
                        `${row.name} comes from the ${row.parentPlugin} plugin. Turn the plugin off, or stop it for this session in /mcp.`,
                        'info'
                    )
                    return
                }
                this.togglePluginRow(row)
                return
            }
            if (key === 'f' || key === 'F') {
                const i = PLUGIN_KIND_FILTERS.indexOf(this.state.pluginKindFilter)
                this.state.pluginKindFilter =
                    PLUGIN_KIND_FILTERS[(i + 1) % PLUGIN_KIND_FILTERS.length]!
                resetSelection()
                this.render()
                return
            }
            if ((key === 'd' || key === 'D') && current?.type === 'extension') {
                this.askToRemovePluginRow(current.row)
            }
            return
        }

        if (tab === 'discover') {
            if (key === ' ' && current) {
                this.openPluginRow(current)
                return
            }
            if (key === 'i' || key === 'I') {
                this.openPluginInput('install-source')
                return
            }
            if (key === 'm' || key === 'M') {
                const names = [
                    null,
                    ...marketplaceCounts(this.state.pluginCatalog.discover).map((m) => m.name),
                ]
                const i = names.indexOf(this.state.pluginMarketFilter)
                this.state.pluginMarketFilter = names[(i + 1) % names.length] ?? null
                resetSelection()
                this.render()
            }
            return
        }

        if (key === 'a' || key === 'A') {
            this.openPluginInput('add-marketplace')
            return
        }
        if (current?.type === 'marketplace' && !current.row.builtIn) {
            const name = current.row.name
            if ((key === 'u' || key === 'U') && this.options?.onUpdateMarketplace) {
                const update = this.options.onUpdateMarketplace
                this.runPluginTask(`Updating ${name}`, async () => {
                    await update(name)
                    return `Updated marketplace ${name}.`
                })
                return
            }
            if (key === 'd' || key === 'D') {
                this.state.pluginConfirm = {
                    action: 'remove-marketplace',
                    id: name,
                    message: `Remove marketplace ${name}?`,
                }
                this.render()
            }
        }
    }

    private pluginDetailActionLabels(): string[] {
        const row = this.findInstalledRow(this.state.pluginDetailKey)
        return row ? this.pluginDetailActions(row).map((a) => a.label) : []
    }

    private renderPluginOverlay(y: number, width: number, height: number): void {
        const list = this.getPluginList()
        const total = list.items.length
        if (this.state.pluginSelectedIndex > Math.max(0, total - 1)) {
            this.state.pluginSelectedIndex = Math.max(0, total - 1)
        }
        this.state.pluginWindowStart = ensureVisible(
            this.state.pluginWindowStart,
            lineIndexOf(list, this.state.pluginSelectedIndex),
            PluginMenuView.visibleListLines(height, list.lines.length)
        )
        const catalog = this.state.pluginCatalog
        const installRow =
            this.state.pluginScreen === 'install'
                ? catalog.discover.find((d) => d.id === this.state.pluginInstallId) || null
                : null
        const detailRow = this.findInstalledRow(this.state.pluginDetailKey)
        const pathName =
            installRow?.name ||
            (this.state.pluginScreen === 'input' ? '<name>' : detailRow?.name || '<name>')

        PluginMenuView.render(this.screen.backBuffer, {
            x: 0,
            y,
            width,
            height,
            activeTab: this.state.pluginActiveTab,
            screen: this.state.pluginScreen,
            list,
            selectedIndex: this.state.pluginSelectedIndex,
            windowStart: this.state.pluginWindowStart,
            query: this.state.pluginSearchQuery,
            isSearching: this.state.pluginIsSearching,
            kindFilter: this.state.pluginKindFilter,
            marketFilter: this.state.pluginMarketFilter,
            marketNames: marketplaceCounts(catalog.discover).map((m) => m.name),
            subtitle: pluginSubtitle(
                this.state.pluginActiveTab,
                catalog,
                this.state.pluginMarketFilter
            ),
            loading: this.state.pluginLoading,
            busy: this.state.pluginBusy,
            confirm: this.state.pluginConfirm?.message || null,
            confirmVerb: this.state.pluginConfirm?.action === 'uninstall' ? 'uninstall' : 'remove',
            detailRow,
            detailActions: this.pluginDetailActionLabels(),
            actionIndex: this.state.pluginActionIndex,
            installRow,
            installScope: this.state.pluginInstallScope,
            installPaths: this.pluginInstallPaths(pathName),
            missingEnv: installRow?.env?.filter((name) => !process.env[name]) || [],
            inputKind: this.state.pluginInputKind,
            inputValue: this.state.pluginInputValue,
        })
    }

    private togglePluginRow(row: ExtensionRow): void {
        if (!this.options?.onTogglePluginItem) return
        const toggle = this.options.onTogglePluginItem
        const verb = row.enabled ? 'Turning off' : 'Turning on'
        this.runPluginTask(`${verb} ${row.name}`, async () => {
            const result = await toggle({
                kind: row.kind,
                id: row.id,
                scope: row.scope,
                mcpScope: row.mcpScope,
                parentPlugin: row.parentPlugin,
            })
            const state = result.enabled ? 'on' : 'off'
            return result.restartRequired
                ? `Turned ${state} ${row.name}. Restart December to apply it to the agent.`
                : `Turned ${state} ${row.name}.`
        })
    }

    setPendingModelFallback(fallback?: PendingModelFallback): void {
        this.state.pendingModelFallback = fallback
        this.render()
    }

    async openMemoryView(returnOverlay: OverlayType = 'none'): Promise<void> {
        this.state.activeOverlay = 'memory'
        this.state.memoryReturnOverlay = returnOverlay
        this.state.memoryScrollOffset = 0
        this.state.memoryCursorLine = 0
        this.state.memoryIsLoading = true
        this.render()

        await this.loadAgentsFile()
    }

    async loadAgentsFile(): Promise<void> {
        this.state.memoryIsLoading = true
        this.render()
        try {
            if (this.options?.onLoadAgentsFile) {
                this.state.memoryFile = await this.options.onLoadAgentsFile()
            }
        } catch {
            // Intentionally swallowed: show empty state when AGENTS.md cannot be read
        } finally {
            this.state.memoryIsLoading = false
            this.render()
        }
    }

    async startDecemberLogin(): Promise<void> {
        this.state.activeOverlay = 'none'
        const loginFn = this.onLoginCallback

        const msgIndex = this.state.messages.length
        this.state.messages.push({
            role: 'assistant',
            content: 'Generating December login code…',
        })
        this.render()

        if (!loginFn) {
            this.state.messages[msgIndex] = {
                role: 'error',
                content:
                    'Login functionality is not available in this environment. Run `december login` in your terminal.',
            }
            this.render()
            return
        }

        try {
            const onCode = (code: string, uri: string) => {
                const fullUrl = uri.includes('?')
                    ? `${uri}&code=${encodeURIComponent(code)}`
                    : `${uri}?code=${encodeURIComponent(code)}`

                this.state.messages[msgIndex] = {
                    role: 'assistant',
                    content: `Confirm code: \`${code}\`\nOpen URL: [${fullUrl}](${fullUrl})\n\nWaiting for approval in your browser…`,
                }
                this.render()
                openBrowserUrl(fullUrl)
            }

            const { token, email } = await loginFn(onCode)
            if (email) {
                this.state.userEmail = email
                this.state.decemberEmail = email
            }
            this.state.hasDecember = true
            if (this.state.messages[msgIndex]) {
                this.state.messages[msgIndex].content = (
                    this.state.messages[msgIndex].content || ''
                )
                    .replace(/\n\s*Waiting for approval.*$/gm, '')
                    .trim()
            }
            this.state.isAuthenticated = true
            this.state.authMethod = 'december'
            this.state.messages.push({
                role: 'assistant',
                content: `Successfully logged in as ${email || 'December user'}!`,
            })
            this.showToast(`Logged in as ${email || 'December user'}.`, 'success')
            this.render()
        } catch (err: any) {
            this.state.messages[msgIndex] = {
                role: 'error',
                content: `Login failed: ${err?.message || 'Unknown error'}`,
            }
            this.render()
        }
    }

    getConfiguredSubscriptionValues(): string[] {
        const result: string[] = []
        for (const it of this.state.switchItems) {
            if (it.value.startsWith('subscription:')) {
                result.push(it.value.slice('subscription:'.length))
            } else if ((it as any).type === 'subscription' && (it as any).provider) {
                result.push((it as any).provider)
            }
        }
        return result
    }

    getConfiguredProviderValues(): string[] {
        const result: string[] = []
        for (const it of this.state.switchItems) {
            if (it.value.startsWith('provider:') || it.value.startsWith('byok:')) {
                result.push(it.value.replace(/^(provider|byok):/, ''))
            } else if ((it as any).type === 'byok' && (it as any).provider) {
                result.push((it as any).provider)
            }
        }
        return result
    }

    /** /model: makes `selected` the active model and tells the cli */
    private applyModelSelection(selected: ModelItem): void {
        this.state.activeModel = selected.value
        this.state.modelLabel = selected.label
        this.state.activeOverlay = 'none'
        this.state.overlayHistory = []

        // Auto-adjust reasoning support on model switch
        const support = getReasoningSupportType(selected.value)
        if (support === 'controllable') {
            if (!this.state.thinkingLevel || this.state.thinkingLevel === 'off') {
                void this.commitThinkingLevel('fast')
            }
        }

        this.showToast(`Switched active model to ${selected.label}.`, 'success')
        if (this.onModelSelectCallback) {
            this.onModelSelectCallback(selected)
        }
        this.render()
    }

    /** D4: checks the key with the provider, then saves it or shows why not */
    private submitApiKey(provider: string, apiKey: string): void {
        const providerName = formatProviderName(provider)
        const abort = new AbortController()
        this.keyCheckAbort = abort
        this.state.authKeyChecking = true
        this.state.authKeyError = null
        this.render()

        const finish = (outcome: ApiKeySaveResult | void) => {
            // cancelled with esc: the cli saw the signal and saved nothing
            if (abort.signal.aborted) return
            this.keyCheckAbort = undefined
            this.state.authKeyChecking = false
            const result: ApiKeySaveResult = outcome || { status: 'saved' }
            const status = result.status
            if (status === 'rejected' || status === 'error') {
                this.state.authApiKeyInput = ''
                this.state.authKeyError =
                    status === 'rejected'
                        ? `Key rejected by ${providerName}${result.message ? `: ${result.message}` : '.'}`
                        : result.message || 'Could not save the key.'
                this.render()
                return
            }

            const existingSwitchIdx = this.state.switchItems.findIndex(
                (it) => it.value === `provider:${provider}` || it.value === `byok:${provider}`
            )
            if (existingSwitchIdx === -1) {
                this.state.switchItems.push({
                    label: providerName,
                    value: `provider:${provider}`,
                    isActive: true,
                })
            } else {
                for (const it of this.state.switchItems) {
                    it.isActive =
                        it.value === `provider:${provider}` || it.value === `byok:${provider}`
                }
            }
            this.state.authApiKeyInput = ''
            this.state.activeOverlay = 'none'
            this.state.isAuthenticated = true
            this.state.authMethod = 'byok'
            this.state.selectedProvider = provider

            if (status === 'forbidden') {
                this.showToast(
                    `Saved key for ${providerName}, but ${providerName} refused access${result.message ? `: ${result.message}` : '.'}`,
                    'error'
                )
            } else if (status === 'unverified') {
                const count = result.modelCount
                if (result.unverifiedReason === 'not_verifiable' && count) {
                    this.showToast(
                        `Saved key for ${providerName} · ${count} models (key not verified)`,
                        'info'
                    )
                } else if (result.unverifiedReason === 'no_endpoint') {
                    this.showToast(
                        `Saved key for ${providerName} · using December's model list`,
                        'info'
                    )
                } else {
                    this.showToast(
                        `Saved key for ${providerName}. Could not verify it, December will check on the first message.`,
                        'info'
                    )
                }
            } else if (result.modelCount) {
                this.showToast(
                    `Saved key for ${providerName} · ${result.modelCount} models`,
                    'success'
                )
            } else {
                this.showToast(`Saved API key for ${providerName}.`, 'success')
            }
            this.render()
        }

        if (!this.onSaveApiKeyCallback) {
            finish()
            return
        }
        Promise.resolve(this.onSaveApiKeyCallback(provider, apiKey, abort.signal))
            .then(finish)
            .catch((err: any) => {
                finish({
                    status: 'error',
                    message: `Could not save the key: ${err?.message || err}`,
                })
            })
    }

    refreshModelsForProvider(provider?: string): void {
        const prov = provider || this.state.selectedProvider
        if (this.getProviderModelsCallback && prov) {
            const providerModels = this.getProviderModelsCallback(prov)
            if (providerModels && providerModels.length > 0) {
                this.state.models = providerModels
                return
            }
        }
        // No fixed fallback list: the model panel shows its empty state (B13)
        if (!this.state.models) this.state.models = []
    }

    async startSubscriptionLogin(provider: string, label?: string): Promise<void> {
        this.state.activeOverlay = 'none'
        const loginFn = this.onSubscriptionLoginCallback
        const displayLabel = label || formatProviderName(provider)

        const msgIndex = this.state.messages.length
        this.state.messages.push({
            role: 'assistant',
            content: `Initiating ${displayLabel} subscription verification…`,
        })
        this.render()

        if (!loginFn) {
            this.state.messages[msgIndex] = {
                role: 'error',
                content: `Subscription login is not available in this environment. Run \`december login ${provider}\` in your terminal.`,
            }
            this.render()
            return
        }

        try {
            const onCode = (code: string, uri: string) => {
                const targetUrl = uri
                const isBrowserAuth = !code || code.endsWith('-AUTH')
                let promptText: string

                if (isBrowserAuth) {
                    writeToClipboard(targetUrl)
                    promptText = `Opening browser to authorize ${displayLabel} subscription…\n(Link copied to clipboard - paste in browser if it did not open automatically)\n\nAuthorization URL:\n${targetUrl}\n\nWaiting for authorization and subscription verification…`
                } else {
                    writeToClipboard(code)
                    promptText = `To authorize ${displayLabel}:\n1. Open: ${targetUrl}\n2. Enter code: \`${code}\` (code copied to clipboard)\n\nWaiting for authorization and subscription verification…`
                }

                this.state.messages[msgIndex] = {
                    role: 'assistant',
                    content: promptText,
                }
                this.render()
                openBrowserUrl(targetUrl)
            }

            await loginFn(provider, onCode)
            if (this.state.messages[msgIndex]) {
                this.state.messages[msgIndex].content = (
                    this.state.messages[msgIndex].content || ''
                )
                    .replace(/\n\s*Waiting for authorization.*$/gm, '')
                    .trim()
            }
            this.state.isAuthenticated = true
            this.state.authMethod = 'subscription'
            this.state.selectedProvider = provider
            this.state.messages.push({
                role: 'assistant',
                content: `Successfully connected to ${displayLabel} subscription!`,
            })
            this.showToast(`Logged in to ${displayLabel} subscription.`, 'success')
            this.render()
        } catch (err: any) {
            this.state.messages[msgIndex] = {
                role: 'error',
                content: `Subscription login failed: ${err?.message || 'Unknown error'}`,
            }
            this.showToast(`Subscription login failed: ${err?.message || 'Error'}`, 'error')
            this.render()
        }
    }

    setWorkspaceFiles(files: string[]): void {
        this.workspaceFiles.length = 0
        this.workspaceFiles.push(...files)
        this.updateFileAutocomplete()
    }

    addRecentFile(filePath: string): void {
        this.recentFiles.add(filePath)
    }

    async refreshWorkspaceFiles(cwd?: string): Promise<string[]> {
        if (this.isLoadingWorkspaceFiles) return this.workspaceFiles
        this.isLoadingWorkspaceFiles = true
        const targetDir = cwd || this.state.cwd || process.cwd()

        try {
            let files: string[] = []
            try {
                const { exec } = await import('node:child_process')
                const { promisify } = await import('node:util')
                const execAsync = promisify(exec)
                const { stdout } = await execAsync(
                    'git ls-files --cached --others --exclude-standard',
                    {
                        cwd: targetDir,
                        maxBuffer: 10 * 1024 * 1024,
                    }
                )
                files = stdout.split('\n').filter(Boolean)
            } catch {
                // Intentionally swallowed: fallback to fast-glob when not a git repository
            }

            if (files.length === 0) {
                const { getWorkspaceIgnores } = await import('@december/shared')
                const ignores = getWorkspaceIgnores(targetDir)
                const fg = (await import('fast-glob')).default
                files = await fg(['**/*'], {
                    cwd: targetDir,
                    dot: true,
                    ignore: ignores,
                    onlyFiles: true,
                    suppressErrors: true,
                })
            }

            this.setWorkspaceFiles(files)

            try {
                const diffEntries = await fetchGitStatusFiles(targetDir)
                if (diffEntries && diffEntries.length > 0) {
                    for (const e of diffEntries) {
                        this.addRecentFile(e.path)
                    }
                }
            } catch {
                // Intentionally swallowed: git status fallback
            }

            return files
        } catch {
            // Intentionally swallowed: fallback to empty workspace files on error
            return []
        } finally {
            this.isLoadingWorkspaceFiles = false
        }
    }

    askQuestion(questions: QuestionItem[]): Promise<Record<string, string | string[]>> {
        return new Promise((resolve) => {
            this.state.pendingQuestions = questions
            this.state.currentQuestionIndex = 0
            this.state.questionSelectedIndex = 0
            this.state.questionSelectedMulti = new Set()
            this.state.questionCustomText = null
            this.pendingQuestionAnswers = {}
            this.pendingQuestionResolver = resolve
            this.state.activeOverlay = 'ask_question'
            this.render()
            this.notifyAttention('ask_question')
        })
    }

    requestToolPermission(call: {
        toolName: string
        commandOrTarget?: string
        diffLines?: string[]
    }): Promise<'approve' | 'always' | 'git_tracked' | 'deny'> {
        if (call.diffLines && call.diffLines.length > 0 && call.commandOrTarget) {
            const target = call.commandOrTarget.match(/^[\w-]+:\s*(.+)$/)?.[1]
            if (target) this.previewedPaths.add(toRelativePath(target.trim()))
        }
        return new Promise((resolve) => {
            this.state.pendingToolCall = {
                toolName: call.toolName,
                commandOrTarget: call.commandOrTarget,
                diffLines: call.diffLines,
                resolve,
            }
            this.state.toolPermissionSelectedIndex = 0
            this.pendingToolPermissionResolver = resolve
            this.state.activeOverlay = 'tool_permission'
            this.render()
            this.notifyAttention('tool_permission')
        })
    }

    updateTasks(tasks: TaskItem[]): void {
        // keep the cursor on the same task when tasks are added, removed or reordered
        const selectedId = this.state.tasks[this.state.tasksSelectedIndex]?.id
        const ordered = orderTasks(tasks)
        this.state.tasks = ordered
        const newIndex = selectedId ? ordered.findIndex((t) => t.id === selectedId) : -1
        if (newIndex >= 0) this.state.tasksSelectedIndex = newIndex
        else if (this.state.tasksConfirmStop === 'one') this.state.tasksConfirmStop = null
        this.clampTasksSelection()
        if (this.state.tasksConfirmStop === 'all' && !ordered.some((t) => t.status === 'running')) {
            this.state.tasksConfirmStop = null
        }
        if (this.state.tasksConfirmStop === 'one') {
            const selected = ordered[this.state.tasksSelectedIndex]
            if (!selected || selected.status !== 'running') this.state.tasksConfirmStop = null
        }
        this.refreshTaskLogView()
        this.render()
    }

    /** keeps the selected task and the scroll window inside the task list */
    private clampTasksSelection(): void {
        const count = this.state.tasks.length
        this.state.tasksSelectedIndex = Math.max(
            0,
            Math.min(this.state.tasksSelectedIndex, count - 1)
        )
        const maxStart = Math.max(0, count - TASKS_WINDOW_SIZE)
        let start = Math.min(this.state.tasksWindowStart, maxStart)
        if (this.state.tasksSelectedIndex < start) start = this.state.tasksSelectedIndex
        if (this.state.tasksSelectedIndex >= start + TASKS_WINDOW_SIZE) {
            start = this.state.tasksSelectedIndex - TASKS_WINDOW_SIZE + 1
        }
        this.state.tasksWindowStart = Math.max(0, start)
    }

    /**
     * if a task log is open, swaps in the latest output. When the cursor was on the
     * last line, it stays on the last line (follow mode); otherwise it keeps its place.
     */
    private refreshTaskLogView(): void {
        const taskId = this.state.fileViewTaskId
        if (!taskId || this.state.activeOverlay !== 'fileview') return
        const task = this.state.tasks.find((t) => t.id === taskId)
        if (!task) return

        const lines = getTaskLogLines(task)
        const previous = this.state.fileViewLines
        if (
            lines.length === previous.length &&
            lines[lines.length - 1] === previous[previous.length - 1]
        ) {
            return
        }
        const wasFollowing = this.isTaskLogFollowing()
        this.state.fileViewLines = lines
        if (wasFollowing) {
            this.state.fileViewCursorLine = Math.max(0, lines.length - 1)
            this.state.fileViewScrollOffset = Math.max(
                0,
                lines.length - this.getFileViewVisibleLineCount()
            )
        } else {
            this.state.fileViewCursorLine = Math.min(
                this.state.fileViewCursorLine,
                Math.max(0, lines.length - 1)
            )
        }
        // the file view title (following / paused) is refreshed on every paint
    }

    private getFileViewVisibleLineCount(): number {
        return Math.max(5, this.screen.height - 4)
    }

    private isTaskLogFollowing(): boolean {
        return this.state.fileViewCursorLine >= this.state.fileViewLines.length - 1
    }

    /**
     * shows a one-line notice in the transcript that a background task finished.
     * During a turn it waits for the turn to end, so it never splits streamed text.
     */
    appendTaskNotice(text: string, tone: 'success' | 'error' | 'muted'): void {
        const notice: MessageItem = { role: 'task_notice', content: text, tone }
        if (this.state.isStreaming) {
            this.pendingTaskNotices.push(notice)
            return
        }
        this.state.messages.push(notice)
        if (!this.state.isReadingMode) this.state.scrollOffset = undefined
        this.render()
    }

    private flushTaskNotices(): void {
        if (this.pendingTaskNotices.length === 0) return
        this.state.messages.push(...this.pendingTaskNotices)
        this.pendingTaskNotices = []
        if (!this.state.isReadingMode) this.state.scrollOffset = undefined
    }

    /** runs a 1s re-render while the tasks overlay shows a running task */
    private syncTasksTicker(): void {
        const shouldTick =
            this.state.activeOverlay === 'tasks' &&
            this.state.tasks.some((t) => t.status === 'running')
        if (shouldTick && !this.tasksTicker) {
            this.tasksTicker = setInterval(() => this.render(), 1000)
            this.tasksTicker.unref?.()
        } else if (!shouldTick && this.tasksTicker) {
            clearInterval(this.tasksTicker)
            this.tasksTicker = null
        }
    }

    setInput(text: string): void {
        this.state.input = text
        this.state.cursorPos = text.length
        this.render()
    }

    requestPlanApproval(plan: {
        summary: string
        fullPlan?: string
    }): Promise<'approve' | 'refine' | 'view' | 'reject'> {
        return new Promise((resolve) => {
            this.state.pendingPlan = {
                summary: plan.summary,
                fullPlan: plan.fullPlan,
                resolve,
            }
            this.state.planApproveSelectedIndex = 0
            this.pendingPlanApprovalResolver = resolve
            this.state.activeOverlay = 'plan_approve'
            this.render()
            this.notifyAttention('plan_approve')
        })
    }

    private submitCurrentQuestionAnswer(answer: string | string[]): void {
        const qList = this.state.pendingQuestions
        if (!qList) return
        const currentQ = qList[this.state.currentQuestionIndex]
        if (!currentQ) return

        this.pendingQuestionAnswers[currentQ.question] = answer
        this.state.questionCustomText = null

        if (this.state.currentQuestionIndex < qList.length - 1) {
            this.state.currentQuestionIndex += 1
            this.state.questionSelectedIndex = 0
            this.state.questionSelectedMulti.clear()
            this.render()
        } else {
            const answers = { ...this.pendingQuestionAnswers }
            this.state.activeOverlay = 'none'
            this.state.pendingQuestions = null
            const res = this.pendingQuestionResolver
            this.pendingQuestionResolver = undefined
            this.render()
            res?.(answers)
        }
    }

    private resolveToolPermission(decision: 'approve' | 'always' | 'git_tracked' | 'deny'): void {
        const res = this.pendingToolPermissionResolver || this.state.pendingToolCall?.resolve
        this.pendingToolPermissionResolver = undefined
        this.state.pendingToolCall = null
        this.state.activeOverlay = 'none'
        this.render()
        res?.(decision)
    }

    private resolvePlanApproval(decision: 'approve' | 'refine' | 'view' | 'reject'): void {
        const plan = this.state.pendingPlan
        if (decision === 'view') {
            const fullPlan =
                plan?.fullPlan || plan?.summary || 'Plan details ready for execution review.'
            const summary = plan?.summary || 'Implementation Plan'
            const lines = fullPlan.split(/\r?\n/)
            this.openFileView('Plan: ' + summary, 1, 'none', undefined, undefined, lines)
            const res = this.pendingPlanApprovalResolver || plan?.resolve
            this.pendingPlanApprovalResolver = undefined
            this.state.pendingPlan = null
            res?.('view')
            return
        }

        if (decision === 'approve') {
            const items = planStepsFromText(plan?.fullPlan || plan?.summary || '')
            this.seededPlan = items.length > 0 ? { items, at: Date.now() } : undefined
        }
        const res = this.pendingPlanApprovalResolver || this.state.pendingPlan?.resolve
        this.pendingPlanApprovalResolver = undefined
        this.state.pendingPlan = null
        this.state.activeOverlay = 'none'
        this.render()
        res?.(decision)
    }

    private updateFileAutocomplete(): void {
        const match = getFileQueryMatch(this.state.input)
        if (match !== null) {
            if (this.workspaceFiles.length === 0) {
                this.refreshWorkspaceFiles()
                    .then(() => {
                        this.updateFileAutocomplete()
                        this.render()
                    })
                    .catch(() => {
                        // Intentionally swallowed: lazy file scan fallback
                    })
                return
            }

            const scored = scoreAndSortFiles(this.workspaceFiles, match.query, this.recentFiles)
            if (scored.length > 0) {
                this.state.fileAutocompleteItems = scored
                this.state.fileAutocompleteSelectedIndex = 0
                this.state.fileAutocompleteWindowStart = 0
                this.state.isFileAutocompleteVisible = true
                return
            }
        }
        this.state.isFileAutocompleteVisible = false
        this.state.fileAutocompleteItems = []
    }

    handlePaste(text: string): void {
        const cleaned = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
        if (!cleaned) return

        if (this.state.activeOverlay !== 'none') {
            const overlay = this.state.activeOverlay

            if (overlay === 'auth') {
                if (this.state.authViewMode === 'byok_key') {
                    const keyChunk = cleaned.replace(/[\r\n]+/g, '').trim()
                    if (keyChunk) {
                        this.state.authApiKeyInput += keyChunk
                        this.state.authKeyError = null
                        this.render()
                    }
                    return
                }
                if (this.state.isSearchingAuthProviders) {
                    const searchChunk = cleaned.replace(/[\r\n]+/g, ' ')
                    this.state.authProviderSearchQuery += searchChunk
                    this.state.authProviderSelectedIndex = 0
                    this.state.authProviderWindowStart = 0
                    this.render()
                    return
                }
            }

            if (overlay === 'model' && this.state.isModelSearching) {
                const searchChunk = cleaned.replace(/[\r\n]+/g, ' ')
                this.state.modelSearchQuery += searchChunk
                this.state.modelSelectedIndex = 0
                this.state.modelWindowStart = 0
                this.render()
                return
            }

            if (overlay === 'session') {
                if (this.state.sessionRenameMode) {
                    const renameChunk = cleaned.replace(/[\r\n]+/g, ' ')
                    this.state.sessionRenameValue += renameChunk
                    this.render()
                    return
                }
                if (this.state.isSessionSearching) {
                    const searchChunk = cleaned.replace(/[\r\n]+/g, ' ')
                    this.state.sessionSearchQuery += searchChunk
                    this.state.sessionSelectedIndex = 0
                    this.state.sessionWindowStart = 0
                    this.render()
                    return
                }
            }

            if (overlay === 'plugin') {
                const chunk = cleaned.replace(/[\r\n]+/g, ' ')
                if (this.state.pluginScreen === 'input') {
                    this.state.pluginInputValue += chunk.trim()
                    this.render()
                    return
                }
                if (this.state.pluginScreen === 'list' && this.state.pluginIsSearching) {
                    this.state.pluginSearchQuery += chunk
                    this.state.pluginSelectedIndex = 0
                    this.state.pluginWindowStart = 0
                    this.render()
                    return
                }
            }

            // Overlay is active but not in a text-input mode: ignore paste to prevent leaking into prompt input
            return
        }

        const lines = cleaned.split('\n')
        if (lines.length > 5) {
            const token = storePaste(cleaned)
            const before = this.state.input.slice(0, this.state.cursorPos)
            const after = this.state.input.slice(this.state.cursorPos)
            this.state.input = before + token + after
            this.state.cursorPos += token.length
        } else {
            const before = this.state.input.slice(0, this.state.cursorPos)
            const after = this.state.input.slice(this.state.cursorPos)
            this.state.input = before + cleaned + after
            this.state.cursorPos += cleaned.length
        }
        this.resetCommandSelection()
        this.updateFileAutocomplete()
        this.render()
    }

    handleKey(key: string, alreadyMapped = false): void {
        // #617: focus in/out reports (CSI ?1004h) are not keys
        if (this.attention.handleFocusSequence(key)) return

        // Bracketed paste: \x1b[200~ <pasted text> \x1b[201~
        if (key.startsWith('\x1b[200~') && key.endsWith('\x1b[201~')) {
            const pastedContent = key.slice(6, -6)
            this.handlePaste(pastedContent)
            return
        }

        // User keybindings: run the bound action's default key instead, or ignore a moved default
        if (!alreadyMapped) {
            const mapped = this.getKeymap().translate(key, this.state.activeOverlay === 'none')
            if (mapped === null) return
            if (mapped !== key) {
                this.handleKey(mapped, true)
                return
            }
        }

        // Ctrl+C
        if (key === '\x03') {
            if (this.state.isStreaming) {
                this.handleAbortStream()
                return
            }

            // If input is non-empty, clear current input draft (standard Unix ^C behavior)
            if (this.state.input.length > 0) {
                this.state.input = ''
                this.state.cursorPos = 0
                this.resetCommandSelection()
                this.updateFileAutocomplete()
                this.render()
                return
            }

            if (this.state.showExitConfirm) {
                if (this.exitTimer) {
                    clearTimeout(this.exitTimer)
                    this.exitTimer = null
                }
                if (this.onExitCallback) {
                    this.onExitCallback()
                } else {
                    this.stop()
                    process.exit(0)
                }
                return
            }

            this.state.showExitConfirm = true
            this.render()
            this.exitTimer = setTimeout(() => {
                this.state.showExitConfirm = false
                this.render()
            }, 3000)
            return
        }

        // Ctrl+T: Toggle Tasks overlay
        if (key === '\x14') {
            this.toggleOverlay('tasks')
            return
        }

        // Ctrl+B: move the command running in the foreground to the background
        if (key === '\x02') {
            const moved = this.onBackgroundForegroundCallback?.() ?? 0
            this.showToast(
                moved > 0
                    ? `Moved ${moved} command${moved === 1 ? '' : 's'} to the background. Ctrl+T to view.`
                    : 'No running command to move to the background.',
                'info'
            )
            return
        }

        // Esc: Close overlay, cancel exit confirm, dismiss btw, stop streaming, or clear input
        if (key === '\x1b') {
            if (this.state.showExitConfirm) {
                this.state.showExitConfirm = false
                this.render()
                return
            }

            if (this.state.pendingModelFallback) {
                this.state.pendingModelFallback = undefined
                this.render()
                return
            }

            if (
                this.state.pendingRestart &&
                !this.state.pendingRestart.dismissed &&
                this.state.activeOverlay === 'none' &&
                !this.state.input
            ) {
                this.state.pendingRestart.dismissed = true
                this.showToast('Restart later with /restart.', 'info')
                return
            }

            if (this.state.activeOverlay !== 'none') {
                this.handleOverlayEsc()
                return
            }

            if (this.state.isFileAutocompleteVisible) {
                this.state.isFileAutocompleteVisible = false
                this.render()
                return
            }

            if (this.state.btwState) {
                if (this.state.btwState.isFocused) {
                    this.state.btwState.isFocused = false
                    this.state.btwState.isExpanded = false
                    this.state.btwScrollOffset = 0
                    this.render()
                    return
                }
                this.state.btwState = null
                this.render()
                return
            }

            if (this.state.input.startsWith('/')) {
                this.state.input = ''
                this.state.cursorPos = 0
                this.resetCommandSelection()
                this.render()
                return
            }

            if (this.state.input.length > 0) {
                this.state.input = ''
                this.state.cursorPos = 0
                this.resetCommandSelection()
                this.updateFileAutocomplete()
                this.render()
                return
            }

            if (this.state.isStreaming) {
                if (this.state.isReadingMode || this.state.scrollOffset !== undefined) {
                    this.scrollToBottom()
                    this.lastEscJumpAt = Date.now()
                    return
                }
                // A quick second Esc after a jump is a double-tap, not a request to stop
                if (Date.now() - this.lastEscJumpAt < ESC_ABORT_GUARD_MS) return
                this.handleAbortStream()
                return
            }

            if (this.state.isReadingMode || this.state.scrollOffset !== undefined) {
                this.scrollToBottom()
                this.lastEscJumpAt = Date.now()
                return
            }
            return
        }

        // Handle 1-keystroke model fallback retry/cancel/switch
        if (this.state.pendingModelFallback) {
            const fallback = this.state.pendingModelFallback
            if (key === '\r' || key === '\n') {
                this.state.pendingModelFallback = undefined
                this.options.onModelFallback?.(
                    fallback.fallbackModel,
                    fallback.failedModel,
                    fallback.prompt
                )
                this.render()
                return
            }
            if (key === '\x1b') {
                this.state.pendingModelFallback = undefined
                this.render()
                return
            }
            if (key === 'm' || key === 'M') {
                this.state.pendingModelFallback = undefined
                this.state.activeOverlay = 'model'
                this.onModelMenuOpenCallback?.()
                this.render()
                return
            }
        }

        // Handle Active Overlay Key Events
        if (this.state.activeOverlay !== 'none') {
            this.handleOverlayKey(key)
            return
        }

        // Handle Btw Side Question navigation when focused in reading mode
        if (this.state.btwState?.isFocused) {
            // Tab while focused: unfocus and collapse back to normal area
            if (key === '\t') {
                this.state.btwState.isFocused = false
                this.state.btwState.isExpanded = false
                this.state.btwScrollOffset = 0
                this.render()
                return
            }
            if (key === '\x1b[A' || key === 'k') {
                this.state.btwScrollOffset = Math.max(0, this.state.btwScrollOffset - 1)
                this.render()
                return
            }
            if (key === '\x1b[B' || key === 'j') {
                this.state.btwScrollOffset += 1
                this.render()
                return
            }
            if (key === '\x1b[5~') {
                const pageSize = BTW_EXPANDED_MAX_VISIBLE_LINES
                this.state.btwScrollOffset = Math.max(0, this.state.btwScrollOffset - pageSize)
                this.render()
                return
            }
            if (key === '\x1b[6~') {
                const pageSize = BTW_EXPANDED_MAX_VISIBLE_LINES
                this.state.btwScrollOffset += pageSize
                this.render()
                return
            }
            // Swallow all other keys while focused in btw so they are not typed into prompt
            return
        }

        // Handle File Autocomplete Navigation when @ or /open query is active
        if (this.state.isFileAutocompleteVisible) {
            if (key === '\x1b') {
                this.state.isFileAutocompleteVisible = false
                this.render()
                return
            }
        }

        if (this.state.isFileAutocompleteVisible && this.state.fileAutocompleteItems.length > 0) {
            const items = this.state.fileAutocompleteItems
            // Arrow Up in file autocomplete
            if (key === '\x1b[A') {
                if (this.state.fileAutocompleteSelectedIndex > 0) {
                    this.state.fileAutocompleteSelectedIndex -= 1
                    if (
                        this.state.fileAutocompleteSelectedIndex <
                        this.state.fileAutocompleteWindowStart
                    ) {
                        this.state.fileAutocompleteWindowStart =
                            this.state.fileAutocompleteSelectedIndex
                    }
                    this.render()
                }
                return
            }

            // Arrow Down in file autocomplete
            if (key === '\x1b[B') {
                if (this.state.fileAutocompleteSelectedIndex < items.length - 1) {
                    this.state.fileAutocompleteSelectedIndex += 1
                    if (
                        this.state.fileAutocompleteSelectedIndex >=
                        this.state.fileAutocompleteWindowStart + FILE_WINDOW_SIZE
                    ) {
                        this.state.fileAutocompleteWindowStart =
                            this.state.fileAutocompleteSelectedIndex - FILE_WINDOW_SIZE + 1
                    }
                    this.render()
                }
                return
            }

            // Tab or Enter: Autocomplete selected file
            if (key === '\t' || key === '\r' || key === '\n') {
                const selected = items[this.state.fileAutocompleteSelectedIndex]
                if (selected) {
                    const match = getFileQueryMatch(this.state.input)
                    if (match?.type === 'open') {
                        this.state.input = `/open ${selected.path} `
                    } else {
                        this.state.input = this.state.input.replace(/@\S*$/, `@${selected.path} `)
                    }
                    this.state.cursorPos = this.state.input.length
                    this.state.isFileAutocompleteVisible = false
                    this.render()
                    return
                }
            }
        }

        // Handle Command Menu Navigation when input starts with '/' and does not contain spaces
        const isCommandMenuNav = this.state.input.startsWith('/') && !this.state.input.includes(' ')

        if (isCommandMenuNav) {
            const query = this.state.input.slice(1).trim()
            const filtered = CommandMenuView.getFiltered(query)

            // Arrow Up in command menu
            if (key === '\x1b[A') {
                if (this.state.commandSelectedIndex > 0) {
                    this.state.commandSelectedIndex -= 1
                    if (this.state.commandSelectedIndex < this.state.commandWindowStart) {
                        this.state.commandWindowStart = this.state.commandSelectedIndex
                    }
                    this.render()
                }
                return
            }

            // Arrow Down in command menu
            if (key === '\x1b[B') {
                if (this.state.commandSelectedIndex < filtered.length - 1) {
                    this.state.commandSelectedIndex += 1
                    if (
                        this.state.commandSelectedIndex >=
                        this.state.commandWindowStart + CMD_WINDOW_SIZE
                    ) {
                        this.state.commandWindowStart =
                            this.state.commandSelectedIndex - CMD_WINDOW_SIZE + 1
                    }
                    this.render()
                }
                return
            }

            // Tab: Autocomplete selected command
            if (key === '\t') {
                if (filtered.length > 0) {
                    const sel =
                        filtered[Math.min(this.state.commandSelectedIndex, filtered.length - 1)]
                    if (sel) {
                        this.state.input = `/${sel.name} `
                        this.state.cursorPos = this.state.input.length
                        this.render()
                    }
                }
                return
            }

            // Enter: Complete partial command on first Enter, execute on second Enter or exact match
            if (key === '\r' || key === '\n') {
                if (filtered.length > 0) {
                    const sel =
                        filtered[Math.min(this.state.commandSelectedIndex, filtered.length - 1)]
                    if (sel) {
                        const currentVal = this.state.input.trim().toLowerCase()
                        const targetCmd = `/${sel.name.toLowerCase()}`
                        const isExactMatch = currentVal === targetCmd
                        const hasArguments =
                            currentVal.length > targetCmd.length &&
                            currentVal.startsWith(targetCmd + ' ')

                        // If user typed only a partial prefix, first Enter completes with trailing space
                        if (!isExactMatch && !hasArguments) {
                            this.state.input = `/${sel.name} `
                            this.state.cursorPos = this.state.input.length
                            this.resetCommandSelection()
                            this.render()
                            return
                        }

                        // Full command match: execute immediately
                        this.executeCommand(sel.name)
                        return
                    }
                }
                this.executeCommand(this.state.input.slice(1).trim())
                return
            }
        }

        // Tab: Focus Btw Side Question if active and not already consumed by file or command autocomplete
        if (
            this.state.btwState &&
            !this.state.btwState.isFocused &&
            this.state.btwState.status !== 'loading' &&
            key === '\t'
        ) {
            this.state.btwState.isFocused = true
            this.state.btwState.isExpanded = true
            this.render()
            return
        }

        // Mouse wheel / trackpad scrolling:
        // Wheel up: \x1b[<64;... or \x1b[<64M
        // Wheel down: \x1b[<65;... or \x1b[<65M
        if (
            key.startsWith('\x1b[<64;') ||
            key.startsWith('\x1b[<64?') ||
            key === '\x1b[<64M' ||
            key === '\x1b[<64m'
        ) {
            if (this.state.activeOverlay !== 'none') {
                this.handleOverlayKey('\x1b[A')
            } else {
                this.scrollUp(3)
            }
            return
        }
        if (
            key.startsWith('\x1b[<65;') ||
            key.startsWith('\x1b[<65?') ||
            key === '\x1b[<65M' ||
            key === '\x1b[<65m'
        ) {
            if (this.state.activeOverlay !== 'none') {
                this.handleOverlayKey('\x1b[B')
            } else {
                this.scrollDown(3)
            }
            return
        }
        if (key.startsWith('\x1b[<')) {
            return
        }

        // Shift+Up / Ctrl+Up: scroll up regardless of prompt input
        if (key === '\x1b[1;2A' || key === '\x1b[1;5A') {
            this.scrollUp(3)
            return
        }
        // Shift+Down / Ctrl+Down: scroll down regardless of prompt input
        if (key === '\x1b[1;2B' || key === '\x1b[1;5B') {
            this.scrollDown(3)
            return
        }

        // Arrow Up: Multiline prompt line up, prompt history, or scroll message history
        if (key === '\x1b[A' || key === '\x1bOA') {
            const paddingLeft = THEME.padding.paddingLeft ?? 2
            const paddingRight = THEME.padding.paddingRight ?? 4
            const textOffsetX = paddingLeft + `${THEME.glyphs.prompt} `.length
            const maxInputWidth = Math.max(10, this.screen.columns - textOffsetX - paddingRight)
            const wrapped = wrapInputText(this.state.input, maxInputWidth)

            if (wrapped.length > 1) {
                const { line, col } = getWrappedCursorPosition(wrapped, this.state.cursorPos)
                if (line > 0) {
                    const prevLine = wrapped[line - 1]!
                    const targetCol = Math.min(col, prevLine.text.length)
                    this.state.cursorPos = prevLine.startIndex + targetCol
                    this.render()
                    return
                }
            }

            // L14: with an empty prompt during a turn, ↑ takes the last queued message back to edit
            if (!this.state.input && this.state.isStreaming && this.state.promptQueue.length > 0) {
                const queued = this.state.promptQueue.pop() || ''
                // Put back the input as typed, with its paste placeholders, not the expanded text
                this.state.input = this.queuedRawInputs.get(queued) ?? queued
                this.queuedRawInputs.delete(queued)
                this.state.cursorPos = this.state.input.length
                this.render()
                return
            }

            if (!this.state.input && this.state.messages.length > 0) {
                this.scrollUp(2)
            } else if (this.state.promptHistory.length > 0) {
                const nextIdx =
                    this.state.historyIndex === -1
                        ? this.state.promptHistory.length - 1
                        : Math.max(0, this.state.historyIndex - 1)
                this.state.historyIndex = nextIdx
                this.state.input = this.state.promptHistory[nextIdx] || ''
                this.state.cursorPos = this.state.input.length
                this.render()
            }
            return
        }

        // Arrow Down: Multiline prompt line down, prompt history, or scroll message history
        if (key === '\x1b[B' || key === '\x1bOB') {
            const paddingLeft = THEME.padding.paddingLeft ?? 2
            const paddingRight = THEME.padding.paddingRight ?? 4
            const textOffsetX = paddingLeft + `${THEME.glyphs.prompt} `.length
            const maxInputWidth = Math.max(10, this.screen.columns - textOffsetX - paddingRight)
            const wrapped = wrapInputText(this.state.input, maxInputWidth)

            if (wrapped.length > 1) {
                const { line, col } = getWrappedCursorPosition(wrapped, this.state.cursorPos)
                if (line < wrapped.length - 1) {
                    const nextLine = wrapped[line + 1]!
                    const targetCol = Math.min(col, nextLine.text.length)
                    this.state.cursorPos = nextLine.startIndex + targetCol
                    this.render()
                    return
                }
            }

            if (!this.state.input && this.state.messages.length > 0) {
                this.scrollDown(2)
            } else if (this.state.historyIndex !== -1) {
                const nextIdx = this.state.historyIndex + 1
                if (nextIdx >= this.state.promptHistory.length) {
                    this.state.historyIndex = -1
                    this.state.input = ''
                    this.state.cursorPos = 0
                } else {
                    this.state.historyIndex = nextIdx
                    this.state.input = this.state.promptHistory[nextIdx] || ''
                    this.state.cursorPos = this.state.input.length
                }
                this.render()
            }
            return
        }

        // Page Up: \x1b[5~ or Shift+PageUp \x1b[5;2~
        if (key === '\x1b[5~' || key === '\x1b[5;2~') {
            const pageSize = Math.max(1, this.screen.height - 8)
            this.scrollUp(pageSize)
            return
        }

        // Page Down: \x1b[6~ or Shift+PageDown \x1b[6;2~
        if (key === '\x1b[6~' || key === '\x1b[6;2~') {
            const pageSize = Math.max(1, this.screen.height - 8)
            this.scrollDown(pageSize)
            return
        }

        // Home: \x1b[H or \x1b[1~ or \x1bOH
        if (key === '\x1b[H' || key === '\x1b[1~' || key === '\x1bOH') {
            if (this.state.input.length > 0) {
                this.state.cursorPos = 0
                this.render()
            } else if (this.state.messages.length > 0) {
                // Read maxScroll only after older turns are laid out
                this.ensureHistoryLaidOut()
                this.scrollUp(this.maxScroll)
            }
            return
        }

        // End: \x1b[F or \x1b[4~ or \x1bOF
        if (key === '\x1b[F' || key === '\x1b[4~' || key === '\x1bOF') {
            if (this.state.cursorPos < this.state.input.length) {
                this.state.cursorPos = this.state.input.length
                this.render()
            } else {
                this.scrollToBottom()
            }
            return
        }

        // Shift+Tab: Toggle plan mode
        if (key === '\x1b[Z') {
            this.togglePlanMode()
            return
        }

        // Alt+Enter / Shift+Enter / Ctrl+Enter: Insert newline in prompt
        if (
            key === '\x1b\r' ||
            key === '\x1b\n' ||
            key === '\x1b[13;2u' ||
            key === '\x1b[13;3u' ||
            key === '\x1b[13;5u' ||
            key === '\x1b[27;2;13~' ||
            key === '\x1b[27;3;13~' ||
            key === '\x1b[27;5;13~' ||
            key === '\x1bOM'
        ) {
            const before = this.state.input.slice(0, this.state.cursorPos)
            const after = this.state.input.slice(this.state.cursorPos)
            this.state.input = before + '\n' + after
            this.state.cursorPos += 1
            this.render()
            return
        }

        // Enter: Submit prompt or execute slash command
        if (key === '\r' || key === '\n') {
            const trimmed = this.state.input.trim()
            if (!trimmed && this.state.pendingRestart && !this.state.pendingRestart.dismissed) {
                this.requestRestart()
                return
            }
            if (trimmed) {
                if (trimmed.startsWith('/')) {
                    this.executeCommand(trimmed.slice(1))
                } else {
                    this.submitPrompt()
                }
            }
            return
        }

        // Ctrl+H: Open session select menu (when input is empty)
        if (key === '\x08' && this.state.input.length === 0) {
            this.toggleOverlay('session')
            return
        }

        // Delete: \x1b[3~
        if (key === '\x1b[3~') {
            if (this.state.cursorPos < this.state.input.length) {
                const before = this.state.input.slice(0, this.state.cursorPos)
                const after = this.state.input.slice(this.state.cursorPos + 1)
                this.state.input = before + after
                this.resetCommandSelection()
                this.updateFileAutocomplete()
                this.render()
            }
            return
        }

        // Alt+D / Alt+Delete: Word delete forward
        if (key === '\x1bd' || key === '\x1bD' || key === '\x1b[3;3~' || key === '\x1b[3;5~') {
            if (this.state.cursorPos < this.state.input.length) {
                let pos = this.state.cursorPos
                const len = this.state.input.length
                while (pos < len && /\s/.test(this.state.input[pos] || '')) {
                    pos++
                }
                while (pos < len && !/\s/.test(this.state.input[pos] || '')) {
                    pos++
                }
                const before = this.state.input.slice(0, this.state.cursorPos)
                const after = this.state.input.slice(pos)
                this.state.input = before + after
                this.resetCommandSelection()
                this.updateFileAutocomplete()
                this.render()
            }
            return
        }

        // Backspace: \x7f or \b
        if (key === '\x7f' || key === '\b') {
            if (this.state.cursorPos > 0) {
                const before = this.state.input.slice(0, this.state.cursorPos)
                const tokenMatch = before.match(/(\[Pasted \d+ lines(?: #\d+)?\])$/)
                if (tokenMatch && tokenMatch[1]) {
                    const tokenLen = tokenMatch[1].length
                    const after = this.state.input.slice(this.state.cursorPos)
                    this.state.input = before.slice(0, -tokenLen) + after
                    this.state.cursorPos -= tokenLen
                    this.resetCommandSelection()
                    this.updateFileAutocomplete()
                    this.render()
                    return
                }
                const after = this.state.input.slice(this.state.cursorPos)
                this.state.input = before.slice(0, -1) + after
                this.state.cursorPos -= 1
                this.resetCommandSelection()
                this.updateFileAutocomplete()
                this.render()
            }
            return
        }

        // Left Arrow: \x1b[D
        if (key === '\x1b[D') {
            if (this.state.cursorPos > 0) {
                this.state.cursorPos -= 1
                this.render()
            }
            return
        }

        // Right Arrow: \x1b[C
        if (key === '\x1b[C') {
            if (this.state.cursorPos < this.state.input.length) {
                this.state.cursorPos += 1
                this.render()
            }
            return
        }

        // Ctrl+A: Beginning of input
        if (key === '\x01') {
            this.state.cursorPos = 0
            this.render()
            return
        }

        // Ctrl+E: End of input
        if (key === '\x05') {
            this.state.cursorPos = this.state.input.length
            this.render()
            return
        }

        // Ctrl+K: Kill forward from cursor to end
        if (key === '\x0b') {
            this.state.input = this.state.input.slice(0, this.state.cursorPos)
            this.resetCommandSelection()
            this.updateFileAutocomplete()
            this.render()
            return
        }

        // Ctrl+U: Kill backward from cursor to start
        if (key === '\x15') {
            this.state.input = this.state.input.slice(this.state.cursorPos)
            this.state.cursorPos = 0
            this.resetCommandSelection()
            this.updateFileAutocomplete()
            this.render()
            return
        }

        // Ctrl+W / Alt+Backspace: Word delete backward
        if (
            key === '\x17' ||
            key === '\x1b\x7f' ||
            key === '\x1b\b' ||
            key === '\x1b[1;5H' ||
            key === '\x1b[1;3H'
        ) {
            if (this.state.cursorPos > 0) {
                let pos = this.state.cursorPos
                while (pos > 0 && /\s/.test(this.state.input[pos - 1] || '')) {
                    pos--
                }
                while (pos > 0 && !/\s/.test(this.state.input[pos - 1] || '')) {
                    pos--
                }
                const before = this.state.input.slice(0, pos)
                const after = this.state.input.slice(this.state.cursorPos)
                this.state.input = before + after
                this.state.cursorPos = pos
                this.resetCommandSelection()
                this.updateFileAutocomplete()
                this.render()
            }
            return
        }

        // Alt+B / Alt+Left / Ctrl+Left: Word jump backward
        if (
            key === '\x1bb' ||
            key === '\x1bB' ||
            key === '\x1b[1;5D' ||
            key === '\x1b[1;3D' ||
            key === '\x1b[5D' ||
            key === '\x1b\x1b[D'
        ) {
            if (this.state.cursorPos > 0) {
                let pos = this.state.cursorPos
                while (pos > 0 && /\s/.test(this.state.input[pos - 1] || '')) {
                    pos--
                }
                while (pos > 0 && !/\s/.test(this.state.input[pos - 1] || '')) {
                    pos--
                }
                this.state.cursorPos = pos
                this.render()
            }
            return
        }

        // Alt+F / Alt+Right / Ctrl+Right: Word jump forward
        if (
            key === '\x1bf' ||
            key === '\x1bF' ||
            key === '\x1b[1;5C' ||
            key === '\x1b[1;3C' ||
            key === '\x1b[5C' ||
            key === '\x1b\x1b[C'
        ) {
            if (this.state.cursorPos < this.state.input.length) {
                let pos = this.state.cursorPos
                const len = this.state.input.length
                while (pos < len && /\s/.test(this.state.input[pos] || '')) {
                    pos++
                }
                while (pos < len && !/\s/.test(this.state.input[pos] || '')) {
                    pos++
                }
                this.state.cursorPos = pos
                this.render()
            }
            return
        }

        // Ctrl+P: History previous
        if (key === '\x10') {
            if (this.state.promptHistory.length > 0) {
                const nextIdx =
                    this.state.historyIndex === -1
                        ? this.state.promptHistory.length - 1
                        : Math.max(0, this.state.historyIndex - 1)
                this.state.historyIndex = nextIdx
                this.state.input = this.state.promptHistory[nextIdx] || ''
                this.state.cursorPos = this.state.input.length
                this.render()
            }
            return
        }

        // Ctrl+N: History next
        if (key === '\x0e') {
            if (this.state.historyIndex !== -1) {
                const nextIdx = this.state.historyIndex + 1
                if (nextIdx >= this.state.promptHistory.length) {
                    this.state.historyIndex = -1
                    this.state.input = ''
                    this.state.cursorPos = 0
                } else {
                    this.state.historyIndex = nextIdx
                    this.state.input = this.state.promptHistory[nextIdx] || ''
                    this.state.cursorPos = this.state.input.length
                }
                this.render()
            }
            return
        }

        // Ctrl+L: Toggle slash command menu
        if (key === '\x0c') {
            if (this.state.input.startsWith('/')) {
                this.state.input = ''
                this.state.cursorPos = 0
            } else {
                this.state.input = '/'
                this.state.cursorPos = 1
                this.resetCommandSelection()
            }
            this.render()
            return
        }

        // Ctrl+Y: Quick copy last assistant response to clipboard
        if (key === '\x19') {
            for (let i = this.state.messages.length - 1; i >= 0; i--) {
                const m = this.state.messages[i]
                if (m && m.role === 'assistant' && m.content) {
                    writeToClipboard(m.content)
                    this.showToast('Copied last response to clipboard.', 'success')
                    return
                }
            }
            this.showToast('No assistant response to copy.', 'info')
            return
        }

        // Printable text input
        if (!key.startsWith('\x1b') && key.length > 0) {
            const before = this.state.input.slice(0, this.state.cursorPos)
            const after = this.state.input.slice(this.state.cursorPos)
            this.state.input = before + key + after
            this.state.cursorPos += key.length
            this.resetCommandSelection()
            this.updateFileAutocomplete()
            this.render()
        }
    }

    private resetCommandSelection(): void {
        this.state.commandSelectedIndex = 0
        this.state.commandWindowStart = 0
    }

    executeCommand(name: string): void {
        const raw = name.trim()
        const match = raw.match(/^\/?([a-zA-Z0-9_\-:]+)(?:\s+(.*))?$/s)
        if (!match) return
        const cmd = (match[1] || '').toLowerCase()
        const args = (match[2] || '').trim()

        this.state.input = ''
        this.state.cursorPos = 0
        this.state.overlayHistory = []

        if (cmd === 'ask') {
            if (args) {
                this.executeCommand(`btw ${args}`)
            } else {
                this.showToast('Usage: /btw <question> (/ask was replaced by /btw)', 'info')
            }
            return
        }

        if (cmd === 'plan') {
            if (!args) {
                this.togglePlanMode()
                return
            }
            this.state.promptHistory.push(`/${raw}`)
            this.state.historyIndex = -1
            this.state.messages.push({
                role: 'user',
                content: `/plan ${args}`,
            })
            this.render()
            if (this.onSubmitCallback) {
                this.onSubmitCallback(`/plan ${args}`)
            }
            return
        }

        // Built-in, so a user skill named "learn" cannot shadow it
        if (cmd === 'learn') {
            const hasConversation = this.state.messages.some(
                (m) => m.role === 'user' || m.role === 'assistant'
            )
            if (!args && !hasConversation) {
                this.showToast(
                    'Usage: /learn [lesson] (e.g. /learn never use axios, use lib/http.ts)',
                    'info'
                )
                return
            }
            const command = args ? `/learn ${args}` : '/learn'
            this.state.promptHistory.push(`/${raw}`)
            this.state.historyIndex = -1
            this.state.messages.push({
                role: 'user',
                content: command,
            })
            this.render()
            if (this.onSubmitCallback) {
                this.onSubmitCallback(command)
            }
            return
        }

        if (cmd === 'exit') {
            if (this.onExitCallback) {
                this.onExitCallback()
            } else {
                this.stop()
                process.exit(0)
            }
            return
        }

        if (cmd === 'compact') {
            this.runCompact(args || undefined)
            return
        }

        // 'doctor' is a hidden alias of 'check'
        if (cmd === 'check' || cmd === 'doctor') {
            this.openCheckReport()
            return
        }

        if (cmd === 'permissions' || cmd === 'allowed-tools') {
            this.openPermissionsReport('allow')
            return
        }

        if (cmd === 'github') {
            this.openGithubReport()
            return
        }

        if (cmd === 'keybindings') {
            this.openKeybindingsFile()
            return
        }

        if (cmd === 'hooks') {
            this.openHooksReport()
            return
        }

        if (cmd === 'skills') {
            const sub = args.toLowerCase()
            if (sub && sub !== 'reload') {
                this.showToast('Usage: /skills or /skills reload', 'info')
                return
            }
            this.openSkillsReport(sub === 'reload')
            return
        }

        if (cmd === 'clear') {
            this.state.messages = []
            this.state.contextTokens = 0
            if (this.onClearContextCallback) {
                const res = this.onClearContextCallback()
                if (res && typeof (res as Promise<any>).catch === 'function') {
                    ;(res as Promise<any>).catch(() => {})
                }
            }
            this.showToast('Cleared conversation history.', 'success')
            this.render()
            return
        }

        if (cmd === 'new') {
            this.state.messages = []
            this.state.contextTokens = 0
            if (this.onNewContextCallback) {
                const res = this.onNewContextCallback()
                if (res && typeof (res as Promise<any>).then === 'function') {
                    ;(res as Promise<string | void>)
                        .then((newSessionId) => {
                            if (newSessionId) {
                                this.state.sessionId = newSessionId
                                this.render()
                            }
                        })
                        .catch(() => {})
                } else if (typeof res === 'string') {
                    this.state.sessionId = res
                }
            }
            this.showToast('Started a new conversation.', 'success')
            this.render()
            return
        }

        if (cmd === 'fork') {
            const forkTarget = args ? args.trim() : undefined
            if (this.onForkContextCallback) {
                const res = this.onForkContextCallback(forkTarget)
                if (res && typeof (res as Promise<any>).then === 'function') {
                    ;(res as Promise<string | void>)
                        .then((newSessionId) => {
                            if (newSessionId) {
                                this.state.sessionId = newSessionId
                                this.showToast(
                                    `Forked conversation into a new branch: ${this.state.sessionTitle || newSessionId}.`,
                                    'success'
                                )
                                this.render()
                            }
                        })
                        .catch((err) => {
                            this.showToast(
                                `Failed to fork conversation: ${err?.message || err}`,
                                'error'
                            )
                            this.render()
                        })
                } else if (typeof res === 'string') {
                    this.state.sessionId = res
                    this.showToast(
                        `Forked conversation into a new branch: ${this.state.sessionTitle || res}.`,
                        'success'
                    )
                    this.render()
                }
            } else {
                this.showToast('Forked conversation into a new branch.', 'success')
                this.render()
            }
            return
        }

        if (cmd === 'rename') {
            const requested = args ? args.trim() : ''
            if (!this.onRenameSessionCallback) {
                this.showToast('Renaming is not available in this session.', 'error')
                return
            }
            if (!requested) {
                this.showToast('Generating a session title…', 'info')
            }
            Promise.resolve(this.onRenameSessionCallback(requested || undefined))
                .then((title) => {
                    if (title) {
                        this.setSessionTitle(title)
                        this.showToast(`Renamed session to "${title}".`, 'success')
                    } else if (!requested) {
                        this.showToast(
                            'Could not generate a title. Use /rename <title> to set one.',
                            'error'
                        )
                    }
                    this.render()
                })
                .catch((err) => {
                    this.showToast(`Failed to rename session: ${err?.message || err}`, 'error')
                    this.render()
                })
            return
        }

        if (cmd === 'copy') {
            const assistantMsgs = this.state.messages.filter((m) => m.role === 'assistant')
            const lastMsg =
                assistantMsgs.length > 0 ? assistantMsgs[assistantMsgs.length - 1] : null
            if (lastMsg && lastMsg.content) {
                writeToClipboard(lastMsg.content)
                this.showToast('Copied last assistant response to clipboard!', 'success')
            } else {
                this.showToast('No assistant response found to copy.', 'error')
            }
            return
        }

        if (cmd === 'changelog') {
            openBrowserUrl(CHANGELOG_URL)
            this.showToast('Opened changelog in browser.', 'success')
            return
        }

        if (cmd === 'docs' || cmd.startsWith('docs')) {
            const url = 'https://trydecember.com/docs'
            openBrowserUrl(url)
            this.showToast('Opened documentation in browser.', 'success')
            return
        }

        if (cmd === 'feedback') {
            const url = 'https://github.com/phasehumans/december/issues/new/choose'
            openBrowserUrl(url)
            this.showToast('Opened feedback in browser.', 'success')
            return
        }

        if (cmd === 'shortcuts') {
            this.state.activeOverlay = 'help'
            this.state.helpActiveTab = 'shortcuts'
            this.state.helpShortcutSelectedIndex = 0
            this.state.helpShortcutWindowStart = 0
            this.render()
            return
        }

        if (cmd === 'help') {
            this.state.activeOverlay = 'help'
            const lowerArgs = args.toLowerCase()
            if (lowerArgs === 'commands' || lowerArgs === 'cmds') {
                this.state.helpActiveTab = 'commands'
                this.state.helpCmdSelectedIndex = 0
                this.state.helpCmdWindowStart = 0
            } else if (lowerArgs === 'shortcuts') {
                this.state.helpActiveTab = 'shortcuts'
                this.state.helpShortcutSelectedIndex = 0
                this.state.helpShortcutWindowStart = 0
            } else {
                this.state.helpActiveTab = 'general'
            }
            this.render()
            return
        }

        if (cmd === 'effort' || cmd === 'reasoning') {
            const rawModel = this.state.activeModel || this.state.modelLabel
            const support = getReasoningSupportType(rawModel)

            if (args) {
                const lower = args.toLowerCase().trim()
                const validArgs = [
                    'auto',
                    'fast',
                    'deep',
                    'off',
                    'low',
                    'medium',
                    'high',
                    'minimal',
                ]
                if (validArgs.includes(lower)) {
                    const normalized = normalizeReasoningLevel(lower)
                    const label = normalized.charAt(0).toUpperCase() + normalized.slice(1)
                    void this.commitThinkingLevel(normalized).then((saved) => {
                        if (!saved) return
                        if (support === 'none') {
                            this.showToast(
                                `Reasoning set to ${label} (${rawModel || 'Active model'} runs in standard mode).`,
                                'info'
                            )
                        } else if (support === 'fixed') {
                            this.showToast(
                                `Reasoning set to ${label} (${rawModel || 'Active model'} uses fixed provider reasoning).`,
                                'info'
                            )
                        } else {
                            this.showToast(`Reasoning set to ${label}.`, 'success')
                        }
                    })
                    return
                } else {
                    this.showToast('Invalid reasoning level. Valid options: fast, deep', 'error')
                    return
                }
            }

            this.state.activeOverlay = 'effort'
            const normalized = normalizeReasoningLevel(this.state.thinkingLevel)
            const idx = REASONING_OPTIONS.findIndex((opt) => opt.value === normalized)
            this.state.effortSelectedIndex = idx >= 0 ? idx : 0
            this.render()
            return
        }

        if (cmd === 'login' || cmd === 'auth') {
            if (args) {
                const provider = args.toLowerCase().trim()
                if (this.onSubscriptionLoginCallback) {
                    this.startSubscriptionLogin(provider)
                } else {
                    this.showToast(`Run \`december login ${provider}\` in your terminal.`, 'info')
                }
                return
            }

            this.state.activeOverlay = 'login'
            this.state.loginSelectedIndex = 0
            this.state.loginConfirmSwitch = false
            this.render()
            return
        }

        if (cmd === 'settings') {
            this.state.activeOverlay = 'settings'
            this.state.settingsSelectedIndex = 0
            this.render()
            return
        }

        if (cmd === 'context') {
            this.state.activeOverlay = 'context'
            this.refreshUsageStats()
            this.render()
            return
        }

        if (cmd === 'switch') {
            this.state.activeOverlay = 'switch'
            this.state.switchSelectedIndex = 0
            this.state.switchConfirmDeleteValue = null
            this.render()
            return
        }

        if (cmd === 'model') {
            if (
                !this.state.isAuthenticated &&
                this.getConfiguredProviderValues().length === 0 &&
                this.getConfiguredSubscriptionValues().length === 0 &&
                !this.state.hasDecember
            ) {
                this.state.messages.push({
                    role: 'user',
                    content: '/model',
                })
                const notice =
                    this.authRequiredNotice ||
                    'You are not logged in and have no custom API keys (BYOK) configured.\n\nPlease run `/login` to:\n- Link an AI Subscription (Copilot, Claude, ChatGPT, Gemini), or\n- Sign in with your December account (Cloud Wallet), or\n- Configure Bring Your Own Key (BYOK) for providers like OpenAI, Anthropic, Gemini, OpenRouter, etc.'
                this.state.messages.push({
                    role: 'assistant',
                    content: notice,
                })
                this.render()
                return
            }
            this.refreshModelsForProvider()
            this.state.activeOverlay = 'model'
            this.onModelMenuOpenCallback?.()
            this.state.modelSearchQuery = ''
            this.state.isModelSearching = false
            const activeIdx = this.state.models.findIndex(
                (m) => m.value === this.state.activeModel || m.label === this.state.activeModel
            )
            this.state.modelSelectedIndex = activeIdx >= 0 ? activeIdx : 0
            this.state.modelWindowStart = Math.max(
                0,
                Math.min(
                    this.state.modelSelectedIndex,
                    Math.max(0, this.state.models.length - MODEL_WINDOW_SIZE)
                )
            )
            this.render()
            return
        }

        if (cmd === 'diff') {
            this.state.activeOverlay = 'diff'
            this.state.isDiffDetailView = false
            this.state.isDiffFullFile = false
            this.state.diffScrollOffset = 0
            this.state.diffSelectedIndex = 0
            this.state.diffWindowStart = 0
            this.state.diffCursorLineIndex = 0
            this.loadDiffFiles()
            this.render()
            return
        }

        if (cmd === 'tasks') {
            this.state.activeOverlay = 'tasks'
            this.state.tasksSelectedIndex = 0
            this.state.tasksWindowStart = 0
            this.state.tasksConfirmStop = null
            this.render()
            return
        }

        if (cmd === 'session' || cmd === 'sessions' || cmd === 'resume') {
            this.state.activeOverlay = 'session'
            this.state.sessionSelectedIndex = 0
            this.state.sessionWindowStart = 0
            this.state.sessionSearchQuery = args || ''
            this.state.isSessionSearching = false
            this.state.sessionRenameMode = false
            this.state.sessionConfirmDeleteId = null
            if (this.sessionRepository?.listSessions) {
                this.sessionRepository
                    .listSessions()
                    .then((sessions: any[]) => {
                        this.state.sessions = sessions.map((s) => ({
                            id: s.id,
                            title: s.title,
                            preview: s.preview || s.id,
                            updatedAt: s.updatedAt || Date.now(),
                            messageCount: s.messageCount,
                        }))
                        this.render()
                    })
                    .catch(() => {
                        // Intentionally swallowed: ignore session list loading errors
                    })
            }
            this.render()
            return
        }

        if (cmd === 'usage' || cmd === 'cost') {
            this.state.activeOverlay = 'usage'
            this.state.usageLoading = Boolean(this.onLoadUsageCallback)
            this.render()
            void this.loadUsageOverview()
            return
        }

        if (cmd === 'memory') {
            const returnOverlay =
                this.state.activeOverlay !== 'none' ? this.state.activeOverlay : 'none'
            this.openMemoryView(returnOverlay).catch(() => {
                // Intentionally swallowed: openMemoryView error
            })
            return
        }

        if (cmd === 'mcp') {
            this.openMcpView().catch(() => {
                // Intentionally swallowed: openMcpView error
            })
            return
        }

        if (cmd === 'plugin' || cmd === 'plugins') {
            this.openPluginView().catch(() => {
                // Intentionally swallowed: openPluginView error
            })
            return
        }

        // 'undo' is a hidden alias of 'rewind' (not listed in the slash menu)
        if (cmd === 'restart') {
            if (!this.state.pendingRestart) {
                this.showToast(
                    'No update is waiting. Run /update to install the latest version.',
                    'info'
                )
                return
            }
            if (this.state.isStreaming) {
                this.showToast('Wait for the current turn to finish, then run /restart.', 'info')
                return
            }
            this.requestRestart()
            return
        }

        if (cmd === 'update') {
            if (this.state.pendingRestart) {
                this.showToast(
                    `v${this.state.pendingRestart.version} is already installed. Run /restart to use it.`,
                    'info'
                )
                return
            }
            if (this.state.isStreaming) {
                this.showToast('Wait for the current turn to finish, then run /update.', 'info')
                return
            }
            if (this.updateInProgress) {
                this.showToast('An update is already running.', 'info')
                return
            }
            if (!this.options?.onRunUpdate) {
                this.showToast('Run "december update" in your terminal to update.', 'info')
                return
            }
            this.updateInProgress = true
            this.options
                .onRunUpdate()
                .catch((err: any) => {
                    this.showToast(`Update failed: ${err?.message || err}`, 'error')
                })
                .finally(() => {
                    this.updateInProgress = false
                })
            return
        }

        if (cmd === 'rewind' || cmd === 'undo') {
            if (this.state.isStreaming) {
                this.showToast('Wait for the current turn to finish, then rewind.', 'info')
                this.render()
                return
            }
            this.state.activeOverlay = 'rewind'
            this.state.rewindTurns = []
            this.state.rewindSelectedIndex = 0
            this.state.rewindWindowStart = 0
            this.state.rewindConfirming = false
            this.loadRewindTurns().catch(() => {
                // Intentionally swallowed: fail silently on loading rewind turns
            })
            this.render()
            return
        }

        if (cmd === 'open') {
            if (!args || args === '.') {
                this.state.input = '/open '
                this.state.cursorPos = this.state.input.length
                this.updateFileAutocomplete()
                this.showToast('Please specify a file name: /open <file>[:line]', 'info')
                this.render()
                return
            }

            const match = args.match(/^(.+?)(?::(\d+))?$/)
            const targetPath = match ? match[1] : args
            const targetLine = match && match[2] ? parseInt(match[2], 10) : 1

            const fullPath = path.isAbsolute(targetPath)
                ? targetPath
                : path.resolve(this.state.cwd || process.cwd(), targetPath)

            try {
                const stat = fs.statSync(fullPath)
                if (stat.isDirectory()) {
                    const dirPrefix = targetPath.endsWith('/') ? targetPath : `${targetPath}/`
                    this.state.input = `/open ${dirPrefix}`
                    this.state.cursorPos = this.state.input.length
                    this.updateFileAutocomplete()
                    this.showToast(
                        `"${targetPath}" is a directory. Please specify a file to open.`,
                        'info'
                    )
                    this.render()
                    return
                }
            } catch {
                if (!this.workspaceFiles.includes(targetPath)) {
                    this.showToast(`File not found: ${targetPath}`, 'error')
                    return
                }
            }

            this.openFileView(targetPath, targetLine, 'none')
            return
        }

        if (cmd === 'codesearch') {
            if (!args) {
                this.showToast('Usage: /codesearch <query>', 'info')
                return
            }
            this.showToast(`Searching for "${args}"…`, 'info')
            this.state.codeSearchQuery = args
            this.state.codeSearchResults = []
            this.state.codeSearchGroups = []
            this.state.codeSearchSelectedIndex = 0
            this.state.codeSearchWindowStart = 0
            this.state.activeOverlay = 'codesearch'
            this.render()

            const searchFn = this.onCodeSearchCallback
                ? this.onCodeSearchCallback(args)
                : searchWorkspaceCode(args, this.state.cwd || process.cwd())

            searchFn
                .then((results) => {
                    this.state.codeSearchResults = results
                    this.state.codeSearchGroups = groupCodeSearchResults(results)
                    this.render()
                })
                .catch(() => {
                    this.state.codeSearchResults = []
                    this.state.codeSearchGroups = []
                    this.render()
                })
            return
        }

        if (cmd === 'btw') {
            if (!args) {
                this.showToast(
                    'Usage: /btw <question> (e.g. /btw what port does redis use?)',
                    'info'
                )
                return
            }
            this.state.btwState = {
                question: args,
                answer: '',
                status: 'loading',
                isExpanded: false,
                isFocused: false,
            }
            this.state.btwScrollOffset = 0
            this.render()
            this.startBtwLoaderTimer()

            if (this.onSideQuestionCallback) {
                const controller = new AbortController()
                this.onSideQuestionCallback(args, {
                    signal: controller.signal,
                    onChunk: (chunk: string) => {
                        if (this.state.btwState) {
                            this.state.btwState.status = 'streaming'
                            this.state.btwState.answer += chunk
                            this.render()
                        }
                    },
                    onComplete: () => {
                        if (this.state.btwState) {
                            this.state.btwState.status = 'complete'
                            this.render()
                        }
                    },
                    onError: (err: any) => {
                        if (this.state.btwState) {
                            this.state.btwState.status = 'error'
                            this.state.btwState.error = err?.message || 'Failed to answer question'
                            this.render()
                        }
                    },
                })
            } else {
                setTimeout(() => {
                    if (this.state.btwState) {
                        this.state.btwState.status = 'complete'
                        this.state.btwState.answer = [
                            `Cached answer for "${args}":`,
                            `• Ephemeral side answers provide context without polluting your active conversation history.`,
                            `• Press Tab to enter the btw section and expand it.`,
                            `• When focused, scroll using Up and Down arrow keys.`,
                            `• Press Esc to return to the prompt or dismiss when collapsed.`,
                        ].join('\n')
                        this.render()
                    }
                }, 100)
            }
            return
        }

        // Check if command matches an installed skill (e.g. /skill:tdd or /tdd [args])
        const skills = this.getEnabledSkills()
        let skillLookup = cmd
        if (skillLookup.startsWith('skill:')) {
            skillLookup = skillLookup.slice('skill:'.length)
        }
        const matchedSkill = skills.find((s) => s.name.toLowerCase() === skillLookup.toLowerCase())
        if (matchedSkill) {
            const taskDetail = args
                ? `for: "${args}"`
                : 'based on the conversation context or prompt the user to clarify requirements if needed'
            const directive = `Execute skill '${matchedSkill.name}' ${taskDetail}. Use the 'run_skill' tool to delegate this procedure to an isolated subagent.`
            this.state.promptHistory.push(`/${raw}`)
            this.state.historyIndex = -1
            this.state.messages.push({
                role: 'user',
                content: `/${raw}`,
            })
            this.render()
            if (this.onSubmitCallback) {
                this.onSubmitCallback(directive)
            }
            return
        }

        // Unknown slash command: DO NOT SEND TO CHAT! Display error toast!
        this.showToast(`Unknown command: /${name}. Type /help for available commands.`, 'error')
    }

    toggleOverlay(type: OverlayType): void {
        if (this.state.activeOverlay === type) {
            this.state.activeOverlay = 'none'
        } else {
            this.executeCommand(type)
        }
        this.render()
    }

    private cycleDiffFile(delta: number): void {
        const files = this.state.diffFiles
        if (files.length === 0) return

        const currentFile = files[this.state.diffSelectedIndex]
        if (currentFile) {
            this.state.diffFilePositions[currentFile.path] = {
                cursorIndex: this.state.diffCursorLineIndex,
                scrollOffset: this.state.diffScrollOffset,
                isFullFile: this.state.isDiffFullFile,
            }
        }

        const nextIdx = (this.state.diffSelectedIndex + delta + files.length) % files.length
        this.state.diffSelectedIndex = nextIdx

        const nextFile = files[nextIdx]
        const saved = nextFile ? this.state.diffFilePositions[nextFile.path] : null
        if (saved) {
            this.state.diffCursorLineIndex = saved.cursorIndex
            this.state.diffScrollOffset = saved.scrollOffset
            if (saved.isFullFile !== undefined) {
                this.state.isDiffFullFile = saved.isFullFile
            }
        } else {
            this.state.diffScrollOffset = 0
            this.state.diffCursorLineIndex = 0
        }

        const diffWindowSize = DIFF_WINDOW_SIZE
        if (nextIdx < this.state.diffWindowStart) {
            this.state.diffWindowStart = nextIdx
        } else if (nextIdx >= this.state.diffWindowStart + diffWindowSize) {
            this.state.diffWindowStart = Math.max(0, nextIdx - diffWindowSize + 1)
        }
        this.render()
    }

    /**
     * Fetches both /diff views. It opens on this session's changes when there are any,
     * and on all git changes otherwise (#618).
     */
    private loadDiffFiles(): void {
        const loadId = ++this.diffLoadId
        this.state.diffFiles = []
        this.state.diffAllFiles = []
        this.state.diffSessionFiles = null
        this.state.diffFilePositions = {}
        this.state.diffFullContents = {}
        this.state.isDiffLoading = true

        const all = fetchGitStatusFiles().catch(() => {
            // Intentionally swallowed: the view shows no git changes
            return [] as DiffFileEntry[]
        })
        const session = this.onLoadSessionChangesCallback
            ? this.onLoadSessionChangesCallback().catch(() => {
                  // Intentionally swallowed: without a snapshot only all changes are shown
                  return null
              })
            : Promise.resolve(null)

        void Promise.all([all, session]).then(([allFiles, sessionFiles]) => {
            if (loadId !== this.diffLoadId) return
            this.state.diffAllFiles = allFiles
            this.state.diffSessionFiles = sessionFiles
            this.state.isDiffLoading = false
            this.setDiffScope(sessionFiles && sessionFiles.length > 0 ? 'session' : 'all')
            this.render()
        })
    }

    /** Shows the files of one /diff view, from the top of its list */
    private setDiffScope(scope: DiffScope): void {
        this.state.diffScope = scope
        this.state.diffFiles =
            scope === 'session' ? (this.state.diffSessionFiles ?? []) : this.state.diffAllFiles
        this.state.diffSelectedIndex = 0
        this.state.diffWindowStart = 0
        // The two views can show different diffs of the same path
        this.state.diffFilePositions = {}
        this.state.diffFullContents = {}
    }

    getDiffFullContent(filePath: string): string | null {
        if (!filePath) return null
        if (this.state.diffFullContents[filePath] !== undefined) {
            return this.state.diffFullContents[filePath]
        }
        const fileEntry = this.state.diffFiles.find((f) => f.path === filePath)
        if (fileEntry?.fullContent) {
            this.state.diffFullContents[filePath] = fileEntry.fullContent
            return fileEntry.fullContent
        }
        try {
            const fullPath = path.isAbsolute(filePath)
                ? filePath
                : path.resolve(this.state.cwd || process.cwd(), filePath)
            if (fs.existsSync(fullPath)) {
                const content = fs.readFileSync(fullPath, 'utf8')
                this.state.diffFullContents[filePath] = content
                return content
            }
        } catch {
            // Intentionally swallowed: file cannot be read from disk
        }
        return null
    }

    /**
     * The settings rows as shown. Provider and model come from the live session state, so the
     * rows are correct after /switch, /model or a fallback, without a settings refresh.
     */
    private getSettingsForDisplay(): SettingItem[] {
        const { selectedProvider, activeModel, modelLabel } = this.state
        return this.state.settings.map((item) => {
            if (item.id === 'provider' && selectedProvider) {
                return { ...item, value: selectedProvider }
            }
            if (item.id === 'model' && activeModel && modelLabel) {
                return { ...item, value: modelLabel }
            }
            return item
        })
    }

    /** Show a reasoning level in the state, the effort menu and the settings row */
    private showThinkingLevel(level: string): void {
        this.state.thinkingLevel = level
        const idx = REASONING_OPTIONS.findIndex((opt) => opt.value === level)
        if (idx >= 0) this.state.effortSelectedIndex = idx
        const setting = this.state.settings.find((s) => s.id === 'thinking_level')
        if (setting) setting.value = level
    }

    /**
     * Apply a reasoning level and save it. When the save fails, the old level comes back, an
     * error toast shows, and the result is false.
     */
    private async commitThinkingLevel(level: ReasoningLevel): Promise<boolean> {
        const previous = this.state.thinkingLevel
        this.showThinkingLevel(level)
        this.render()
        try {
            await this.onEffortSelectCallback?.(level)
            return true
        } catch (err: any) {
            // A later change wins: only revert if the level is still the one that failed
            if (this.state.thinkingLevel === level) this.showThinkingLevel(previous)
            this.showToast(`Could not save thinking level: ${err?.message || String(err)}`, 'error')
            return false
        }
    }

    /** Save a toggled settings row. When the save fails, the row gets its old value back. */
    private async saveSettingChange(item: SettingItem, previous: string): Promise<void> {
        const attempted = item.value
        try {
            await this.onSettingChangeCallback?.(item.id, attempted)
            this.showToast(`${item.title}: ${formatSettingValue(item)}`, 'success')
        } catch (err: any) {
            // A later toggle wins: only revert if the row still shows the value that failed
            if (item.value === attempted) item.value = previous
            this.showToast(
                `Could not save ${item.title.toLowerCase()}: ${err?.message || String(err)}`,
                'error'
            )
        }
    }

    closeOrPopOverlay(): void {
        if (this.state.overlayHistory && this.state.overlayHistory.length > 0) {
            this.state.activeOverlay = this.state.overlayHistory.pop()!
        } else {
            this.state.activeOverlay = 'none'
        }
        this.render()
        // Coming back from a skill or MCP server view: show what changed there
        if (this.state.activeOverlay === 'plugin') {
            this.loadPlugins().catch(() => {
                // Intentionally swallowed: loadPlugins reports its own errors
            })
        }
    }

    private handleOverlayEsc(): void {
        const overlay = this.state.activeOverlay

        // esc while the provider checks a key cancels the check; the cli then saves nothing
        if (overlay === 'auth' && this.state.authKeyChecking) {
            this.keyCheckAbort?.abort()
            this.keyCheckAbort = undefined
            this.state.authKeyChecking = false
            this.state.authViewMode = 'byok_provider'
            this.render()
            return
        }

        if (overlay === 'report') {
            if (this.state.report?.input) {
                this.state.report.input = undefined
                this.render()
                return
            }
            this.closeReport()
            return
        }

        if (overlay === 'diff') {
            if (this.state.isDiffDetailView) {
                const currentFile = this.state.diffFiles[this.state.diffSelectedIndex]
                if (currentFile) {
                    this.state.diffFilePositions[currentFile.path] = {
                        cursorIndex: this.state.diffCursorLineIndex,
                        scrollOffset: this.state.diffScrollOffset,
                        isFullFile: this.state.isDiffFullFile,
                    }
                }
                this.state.isDiffDetailView = false
                this.render()
                return
            }
            this.closeOrPopOverlay()
            return
        }

        if (overlay === 'skills') {
            // The skill viewer is opened from /plugin; esc goes back there
            this.state.skillsIsDetailView = false
            this.state.skillsDetailSkill = null
            this.closeOrPopOverlay()
            return
        }

        if (overlay === 'tasks' && this.state.tasksConfirmStop) {
            this.state.tasksConfirmStop = null
            this.render()
            return
        }

        if (overlay === 'session') {
            if (this.state.sessionConfirmDeleteId !== null) {
                this.state.sessionConfirmDeleteId = null
                this.render()
                return
            }
            if (this.state.sessionRenameMode) {
                this.state.sessionRenameMode = false
                this.render()
                return
            }
            if (this.state.isSessionSearching) {
                this.state.isSessionSearching = false
                this.render()
                return
            }
            if (this.state.sessionSearchQuery) {
                this.state.sessionSearchQuery = ''
                this.state.sessionSelectedIndex = 0
                this.state.sessionWindowStart = 0
                this.render()
                return
            }
            this.closeOrPopOverlay()
            return
        }

        if (overlay === 'switch') {
            if (this.state.switchConfirmDeleteValue !== null) {
                this.state.switchConfirmDeleteValue = null
                this.render()
                return
            }
            this.closeOrPopOverlay()
            return
        }

        if (overlay === 'model') {
            if (this.state.isModelSearching) {
                this.state.isModelSearching = false
                this.render()
                return
            }
            if (this.state.modelSearchQuery) {
                this.state.modelSearchQuery = ''
                this.state.modelSelectedIndex = 0
                this.state.modelWindowStart = 0
                this.render()
                return
            }
            this.closeOrPopOverlay()
            return
        }

        if (overlay === 'auth') {
            if (this.state.authConfirmDeleteValue) {
                this.state.authConfirmDeleteValue = null
                this.render()
                return
            }
            if (this.state.authViewMode === 'confirm_switch_subscription') {
                this.state.authConfirmTarget = null
                this.state.authViewMode = 'subscription'
                this.render()
                return
            }
            if (this.state.authViewMode === 'confirm_replace_byok') {
                this.state.authConfirmTarget = null
                this.state.authViewMode = 'byok_provider'
                this.render()
                return
            }
            if (this.state.authViewMode === 'byok_key') {
                this.state.authApiKeyInput = ''
                this.state.authKeyError = null
                this.state.authViewMode = 'byok_provider'
                this.render()
                return
            }
            if (this.state.isSearchingAuthProviders) {
                this.state.isSearchingAuthProviders = false
                this.render()
                return
            }
            if (this.state.authProviderSearchQuery) {
                this.state.authProviderSearchQuery = ''
                this.state.authProviderSelectedIndex = 0
                this.state.authProviderWindowStart = 0
                this.render()
                return
            }
            if (
                this.state.authViewMode === 'byok_provider' ||
                this.state.authViewMode === 'subscription'
            ) {
                if (this.state.overlayHistory.length > 0) {
                    this.state.activeOverlay = this.state.overlayHistory.pop()!
                } else {
                    this.state.activeOverlay = 'login'
                }
                this.render()
                return
            }
            this.closeOrPopOverlay()
            return
        }

        if (overlay === 'login') {
            if (this.state.loginConfirmSwitch) {
                this.state.loginConfirmSwitch = false
                this.render()
                return
            }
            this.closeOrPopOverlay()
            return
        }

        if (overlay === 'memory') {
            if (this.state.memoryReturnOverlay && this.state.memoryReturnOverlay !== 'none') {
                const ret = this.state.memoryReturnOverlay
                this.state.memoryReturnOverlay = 'none'
                this.state.activeOverlay = ret
                this.render()
                return
            }
            this.closeOrPopOverlay()
            return
        }

        if (overlay === 'fileview') {
            if (this.state.fileViewReturnOverlay && this.state.fileViewReturnOverlay !== 'none') {
                const ret = this.state.fileViewReturnOverlay
                this.state.fileViewReturnOverlay = 'none'
                this.state.activeOverlay = ret
                this.render()
                return
            }
            this.closeOrPopOverlay()
            return
        }

        if (overlay === 'ask_question' && this.state.questionCustomText !== null) {
            this.state.questionCustomText = null
            this.render()
            return
        }

        if (overlay === 'ask_question') {
            const res = this.pendingQuestionResolver
            this.pendingQuestionResolver = undefined
            this.state.pendingQuestions = null
            this.closeOrPopOverlay()
            res?.({})
            return
        }

        if (overlay === 'tool_permission') {
            this.resolveToolPermission('deny')
            return
        }

        if (overlay === 'plan_approve') {
            this.resolvePlanApproval('reject')
            return
        }

        if (overlay === 'mcp') {
            if (this.state.mcpConfirmDeleteName) {
                this.state.mcpConfirmDeleteName = null
                this.render()
                return
            }
            if (this.state.mcpMode === 'add_custom') {
                this.state.mcpMode = 'list'
                this.render()
                return
            }
            if (this.state.mcpIsDetailView || this.state.mcpMode === 'detail') {
                this.state.mcpIsDetailView = false
                this.state.mcpMode = 'list'
                this.state.mcpScrollOffset = 0
                if (this.state.mcpDetailOnly) {
                    this.state.mcpDetailOnly = false
                    this.closeOrPopOverlay()
                    return
                }
                this.render()
                return
            }
            this.closeOrPopOverlay()
            return
        }

        if (overlay === 'plugin') {
            if (this.state.pluginConfirm) {
                this.state.pluginConfirm = null
                this.render()
                return
            }
            if (this.state.pluginScreen !== 'list') {
                this.state.pluginScreen = 'list'
                this.state.pluginDetailKey = null
                this.state.pluginInstallId = null
                this.render()
                return
            }
            if (this.state.pluginIsSearching || this.state.pluginSearchQuery) {
                this.state.pluginIsSearching = false
                this.state.pluginSearchQuery = ''
                this.state.pluginSelectedIndex = 0
                this.state.pluginWindowStart = 0
                this.render()
                return
            }
            this.closeOrPopOverlay()
            return
        }

        this.closeOrPopOverlay()
    }

    private handleOverlayKey(key: string): void {
        const overlay = this.state.activeOverlay

        // Esc cancels sub-states or steps back to previous overlay
        if (key === '\x1b') {
            this.handleOverlayEsc()
            return
        }

        // Ctrl+C aborts active overlay immediately
        if (key === '\x03') {
            this.state.activeOverlay = 'none'
            this.state.overlayHistory = []
            this.render()
            return
        }

        if (overlay === 'report') {
            this.handleReportKey(key)
            return
        }

        if (overlay === 'help') {
            // Tab navigation: Left / Right / Tab / Shift+Tab
            const isTab = key === '\t'
            const isShiftTab = key === '\x1b[Z'
            const isRight = key === '\x1b[C' || isTab
            const isLeft = key === '\x1b[D' || isShiftTab

            if (isLeft) {
                const tabs: HelpTab[] = ['general', 'commands', 'shortcuts']
                const idx = tabs.indexOf(this.state.helpActiveTab)
                this.state.helpActiveTab = tabs[(idx - 1 + tabs.length) % tabs.length]!
                this.render()
                return
            }

            if (isRight) {
                const tabs: HelpTab[] = ['general', 'commands', 'shortcuts']
                const idx = tabs.indexOf(this.state.helpActiveTab)
                this.state.helpActiveTab = tabs[(idx + 1) % tabs.length]!
                this.render()
                return
            }

            if (this.state.helpActiveTab === 'commands') {
                const cmds = this.getAllCommands()
                if (key === '\x1b[A' || key === 'k') {
                    if (this.state.helpCmdSelectedIndex > 0) {
                        this.state.helpCmdSelectedIndex -= 1
                        if (this.state.helpCmdSelectedIndex < this.state.helpCmdWindowStart) {
                            this.state.helpCmdWindowStart = this.state.helpCmdSelectedIndex
                        }
                        this.render()
                    }
                    return
                }

                if (key === '\x1b[B' || key === 'j') {
                    if (this.state.helpCmdSelectedIndex < cmds.length - 1) {
                        this.state.helpCmdSelectedIndex += 1
                        if (this.state.helpCmdSelectedIndex >= this.state.helpCmdWindowStart + 8) {
                            this.state.helpCmdWindowStart = this.state.helpCmdSelectedIndex - 7
                        }
                        this.render()
                    }
                    return
                }

                if (key === '\r' || key === '\n') {
                    const selected = cmds[this.state.helpCmdSelectedIndex]
                    if (selected) {
                        this.state.activeOverlay = 'none'
                        this.executeCommand(selected.name)
                    }
                    return
                }
            }

            if (this.state.helpActiveTab === 'shortcuts') {
                if (key === '\x1b[A' || key === 'k') {
                    if (this.state.helpShortcutSelectedIndex > 0) {
                        this.state.helpShortcutSelectedIndex -= 1
                        if (
                            this.state.helpShortcutSelectedIndex <
                            this.state.helpShortcutWindowStart
                        ) {
                            this.state.helpShortcutWindowStart =
                                this.state.helpShortcutSelectedIndex
                        }
                        this.render()
                    }
                    return
                }

                if (key === '\x1b[B' || key === 'j') {
                    if (
                        this.state.helpShortcutSelectedIndex <
                        resolveShortcuts(this.keymap).length - 1
                    ) {
                        this.state.helpShortcutSelectedIndex += 1
                        if (
                            this.state.helpShortcutSelectedIndex >=
                            this.state.helpShortcutWindowStart + 8
                        ) {
                            this.state.helpShortcutWindowStart =
                                this.state.helpShortcutSelectedIndex - 7
                        }
                        this.render()
                    }
                    return
                }
            }

            if (key === 'q' || key === 'Q') {
                this.state.activeOverlay = 'none'
                this.render()
                return
            }

            return
        }

        if (overlay === 'effort') {
            const rawModel = this.state.activeModel || this.state.modelLabel
            const support = getReasoningSupportType(rawModel)
            if (support === 'none' || support === 'fixed') {
                if (key === '\x1b' || key === '\r' || key === '\n' || key === ' ') {
                    this.state.activeOverlay = 'none'
                    this.render()
                }
                return
            }

            if (key === '\x1b[A' || key === 'k') {
                this.state.effortSelectedIndex =
                    (this.state.effortSelectedIndex - 1 + REASONING_OPTIONS.length) %
                    REASONING_OPTIONS.length
                this.render()
                return
            }

            if (key === '\x1b[B' || key === 'j') {
                this.state.effortSelectedIndex =
                    (this.state.effortSelectedIndex + 1) % REASONING_OPTIONS.length
                this.render()
                return
            }

            if (key === '\r' || key === '\n' || key === ' ') {
                const selected = REASONING_OPTIONS[this.state.effortSelectedIndex]
                if (selected) {
                    this.state.activeOverlay = 'none'
                    this.state.overlayHistory = []
                    void this.commitThinkingLevel(selected.value).then((saved) => {
                        if (saved) this.showToast(`Reasoning set to ${selected.label}.`, 'success')
                    })
                }
                return
            }

            return
        }

        if (overlay === 'login') {
            if (this.state.loginConfirmSwitch) {
                if (key === 'y' || key === 'Y') {
                    this.state.loginConfirmSwitch = false
                    this.startDecemberLogin()
                    return
                }
                if (key === 'n' || key === 'N' || key === '\r' || key === '\n') {
                    const email =
                        this.state.decemberEmail || this.state.userEmail || 'December user'
                    this.state.loginConfirmSwitch = false
                    this.state.activeOverlay = 'none'
                    this.showToast(`Already logged in as ${email}.`, 'info')
                    this.render()
                    return
                }
                if (key === '\x1b') {
                    this.state.loginConfirmSwitch = false
                    this.render()
                    return
                }
                return
            }

            if (key === '\x1b[A' || key === 'k') {
                if (this.state.loginSelectedIndex > 0) {
                    this.state.loginSelectedIndex -= 1
                    this.render()
                }
                return
            }

            if (key === '\x1b[B' || key === 'j') {
                if (this.state.loginSelectedIndex < LOGIN_OPTIONS.length - 1) {
                    this.state.loginSelectedIndex += 1
                    this.render()
                }
                return
            }

            if (key === '\r' || key === '\n' || key === ' ') {
                const selected = LOGIN_OPTIONS[this.state.loginSelectedIndex]
                if (!selected) return

                if (selected.value === 'subscription') {
                    this.state.overlayHistory.push('login')
                    this.state.activeOverlay = 'auth'
                    this.state.authViewMode = 'subscription'
                    this.state.authProviders = SUBSCRIPTION_PROVIDER_ITEMS
                    this.state.authProviderSelectedIndex = 0
                    this.state.authProviderWindowStart = 0
                    this.state.authProviderSearchQuery = ''
                    this.state.isSearchingAuthProviders = false
                    this.state.authConfirmDeleteValue = null
                    this.state.authConfirmTarget = null
                    this.render()
                    return
                }

                if (selected.value === 'byok') {
                    this.state.overlayHistory.push('login')
                    this.state.activeOverlay = 'auth'
                    this.state.authViewMode = 'byok_provider'
                    this.state.authProviders = BYOK_PROVIDER_ITEMS
                    this.state.authProviderSelectedIndex = 0
                    this.state.authProviderWindowStart = 0
                    this.state.authProviderSearchQuery = ''
                    this.state.isSearchingAuthProviders = false
                    this.state.authConfirmDeleteValue = null
                    this.state.authConfirmTarget = null
                    this.render()
                    return
                }

                if (selected.value === 'december') {
                    const isDecemberLoggedIn = Boolean(
                        this.state.hasDecember !== undefined
                            ? this.state.hasDecember &&
                                  (this.state.decemberEmail || this.state.userEmail)
                            : this.state.isAuthenticated &&
                                  (this.state.decemberEmail || this.state.userEmail) &&
                                  (this.state.authMethod === 'december' || !this.state.authMethod)
                    )
                    if (isDecemberLoggedIn) {
                        this.state.loginConfirmSwitch = true
                        this.render()
                        return
                    }

                    this.startDecemberLogin()
                    return
                }
            }

            if (key === '\x1b') {
                this.closeOrPopOverlay()
                return
            }

            return
        }

        if (overlay === 'settings') {
            const settings = this.state.settings
            if (key === '\x1b[A' || key === 'k') {
                if (this.state.settingsSelectedIndex > 0) {
                    this.state.settingsSelectedIndex -= 1
                    this.render()
                }
                return
            }
            if (key === '\x1b[B' || key === 'j') {
                if (this.state.settingsSelectedIndex < settings.length - 1) {
                    this.state.settingsSelectedIndex += 1
                    this.render()
                }
                return
            }
            if (key === '\r' || key === '\n' || key === ' ') {
                const current = settings[this.state.settingsSelectedIndex]
                if (current) {
                    if (current.id === 'provider') {
                        // Same view as /switch; esc comes back here
                        this.state.overlayHistory.push('settings')
                        this.state.activeOverlay = 'switch'
                        this.state.switchSelectedIndex = 0
                        this.state.switchConfirmDeleteValue = null
                        this.render()
                        return
                    }
                    if (current.id === 'model') {
                        this.state.overlayHistory.push('settings')
                        this.state.activeOverlay = 'model'
                        this.onModelMenuOpenCallback?.()
                        this.render()
                        return
                    }
                    if (current.id === 'thinking_level') {
                        this.state.overlayHistory.push('settings')
                        this.state.activeOverlay = 'effort'
                        const normalized = normalizeReasoningLevel(this.state.thinkingLevel)
                        const idx = REASONING_OPTIONS.findIndex((opt) => opt.value === normalized)
                        this.state.effortSelectedIndex = idx >= 0 ? idx : 0
                        this.render()
                        return
                    }
                    const previous = current.value
                    // #617: off -> bell -> desktop -> off
                    if (current.id === 'notify') current.value = nextNotifyMode(current.value)
                    else if (current.value === 'on') current.value = 'off'
                    else if (current.value === 'off') current.value = 'on'
                    else if (current.value === 'always-proceed') current.value = 'always-ask'
                    else if (current.value === 'always-ask') current.value = 'always-proceed'
                    else if (current.value === 'all') current.value = 'one-at-a-time'
                    else if (current.value === 'one-at-a-time') current.value = 'all'
                    this.render()
                    void this.saveSettingChange(current, previous)
                }
                return
            }
            return
        }

        if (overlay === 'context') {
            if (key === 'c' || key === 'C') {
                this.state.messages = []
                this.state.contextTokens = 0
                this.state.activeOverlay = 'none'
                if (this.onClearContextCallback) {
                    const res = this.onClearContextCallback()
                    if (res && typeof (res as Promise<any>).catch === 'function') {
                        ;(res as Promise<any>).catch(() => {})
                    }
                }
                this.showToast('Cleared context history.', 'success')
                this.render()
                return
            }
            if (key === 'm' || key === 'M') {
                this.state.overlayHistory.push('context')
                this.state.activeOverlay = 'model'
                this.onModelMenuOpenCallback?.()
                this.state.modelSearchQuery = ''
                this.state.modelSelectedIndex = 0
                this.state.modelWindowStart = 0
                this.render()
                return
            }
            if (key === 'n' || key === 'N') {
                this.state.messages = []
                this.state.contextTokens = 0
                this.state.activeOverlay = 'none'
                if (this.onNewContextCallback) {
                    const res = this.onNewContextCallback()
                    if (res && typeof (res as Promise<any>).then === 'function') {
                        ;(res as Promise<string | void>)
                            .then((newSessionId) => {
                                if (newSessionId) {
                                    this.state.sessionId = newSessionId
                                    this.render()
                                }
                            })
                            .catch(() => {})
                    } else if (typeof res === 'string') {
                        this.state.sessionId = res
                    }
                }
                this.showToast('Started a new conversation.', 'success')
                this.render()
                return
            }
            if (key === '\x1b' || key === 'q' || key === 'Q') {
                this.closeOrPopOverlay()
                return
            }
            return
        }

        if (overlay === 'codesearch') {
            const groups =
                this.state.codeSearchGroups.length > 0
                    ? this.state.codeSearchGroups
                    : groupCodeSearchResults(this.state.codeSearchResults)
            const total = groups.length
            const viewportWindowSize = CODE_SEARCH_WINDOW_SIZE

            if (key === '\x1b[A' || key === 'k') {
                if (this.state.codeSearchSelectedIndex > 0) {
                    this.state.codeSearchSelectedIndex -= 1
                    if (this.state.codeSearchSelectedIndex < this.state.codeSearchWindowStart) {
                        this.state.codeSearchWindowStart = this.state.codeSearchSelectedIndex
                    }
                    this.render()
                }
                return
            }

            if (key === '\x1b[B' || key === 'j') {
                if (this.state.codeSearchSelectedIndex < total - 1) {
                    this.state.codeSearchSelectedIndex += 1
                    if (
                        this.state.codeSearchSelectedIndex >=
                        this.state.codeSearchWindowStart + viewportWindowSize
                    ) {
                        this.state.codeSearchWindowStart =
                            this.state.codeSearchSelectedIndex - viewportWindowSize + 1
                    }
                    this.render()
                }
                return
            }

            if (key === '\r' || key === '\n') {
                const group = groups[this.state.codeSearchSelectedIndex]
                if (group) {
                    if (this.onOpenCodeSearchResultCallback && group.matches[0]) {
                        this.onOpenCodeSearchResultCallback(group.matches[0])
                    }
                    this.openFileView(
                        group.file,
                        group.firstLine,
                        'codesearch',
                        this.state.codeSearchQuery,
                        group.lineNumbers
                    )
                }
                return
            }

            if (key === '\t' || key === 'c' || key === 'C') {
                const group = groups[this.state.codeSearchSelectedIndex]
                if (group) {
                    this.state.input = `@${group.file}:${group.firstLine} `
                    this.state.cursorPos = this.state.input.length
                    this.showToast(
                        `Inserted reference to ${group.file}:${group.firstLine}`,
                        'success'
                    )
                }
                this.state.activeOverlay = 'none'
                this.render()
                return
            }
            return
        }

        if (overlay === 'fileview') {
            if (key === 'q' || key === 'Q') {
                this.state.activeOverlay = this.state.fileViewReturnOverlay || 'none'
                this.render()
                return
            }

            // Cycle files when viewing search results with Left / Right arrow or h / l
            if (
                this.state.fileViewReturnOverlay === 'codesearch' &&
                (key === '\x1b[D' || key === 'h' || key === '\x1b[C' || key === 'l')
            ) {
                const groups =
                    this.state.codeSearchGroups.length > 0
                        ? this.state.codeSearchGroups
                        : groupCodeSearchResults(this.state.codeSearchResults)
                if (groups.length > 1) {
                    const isNext = key === '\x1b[C' || key === 'l'
                    const nextIdx =
                        (this.state.codeSearchSelectedIndex + (isNext ? 1 : -1) + groups.length) %
                        groups.length
                    this.state.codeSearchSelectedIndex = nextIdx
                    const viewportWindowSize = CODE_SEARCH_WINDOW_SIZE
                    if (nextIdx < this.state.codeSearchWindowStart) {
                        this.state.codeSearchWindowStart = nextIdx
                    } else if (nextIdx >= this.state.codeSearchWindowStart + viewportWindowSize) {
                        this.state.codeSearchWindowStart = Math.max(
                            0,
                            nextIdx - viewportWindowSize + 1
                        )
                    }
                    const nextGroup = groups[nextIdx]
                    if (nextGroup) {
                        if (this.onOpenCodeSearchResultCallback && nextGroup.matches[0]) {
                            this.onOpenCodeSearchResultCallback(nextGroup.matches[0])
                        }
                        this.openFileView(
                            nextGroup.file,
                            nextGroup.firstLine,
                            'codesearch',
                            this.state.codeSearchQuery,
                            nextGroup.lineNumbers
                        )
                        this.showToast(
                            `File ${nextIdx + 1}/${groups.length}: ${nextGroup.file} (${nextGroup.matchCount} match${nextGroup.matchCount === 1 ? '' : 'es'})`,
                            'info'
                        )
                    }
                    return
                }
            }

            const matchLines = this.state.fileViewMatchLines || []
            const totalMatches = matchLines.length

            if ((key === 'n' || key === 'N' || key === 'p' || key === 'P') && totalMatches > 0) {
                const isNext = key === 'n'
                let nextIdx = (this.state.fileViewCurrentMatchIndex ?? 0) + (isNext ? 1 : -1)
                let wrapped = false

                if (nextIdx >= totalMatches) {
                    nextIdx = 0
                    wrapped = true
                } else if (nextIdx < 0) {
                    nextIdx = totalMatches - 1
                    wrapped = true
                }

                this.state.fileViewCurrentMatchIndex = nextIdx
                const targetLine1 = matchLines[nextIdx]
                const line0 = Math.max(0, targetLine1 - 1)
                this.state.fileViewCursorLine = line0

                const visibleLineCount = Math.max(5, this.screen.height - 4)
                this.state.fileViewScrollOffset = Math.max(
                    0,
                    line0 - Math.floor(visibleLineCount / 2)
                )
                this.showToast(
                    `Match ${nextIdx + 1}/${totalMatches} (line ${targetLine1})${wrapped ? ' (wrapped)' : ''}`,
                    'info'
                )
                this.render()
                return
            }

            const total = this.state.fileViewLines.length
            const visibleLineCount = Math.max(5, this.screen.height - 4)

            // Line-by-line navigation
            if (key === '\x1b[A' || key === 'k') {
                if (this.state.fileViewCursorLine > 0) {
                    this.state.fileViewCursorLine -= 1
                    if (this.state.fileViewCursorLine < this.state.fileViewScrollOffset) {
                        this.state.fileViewScrollOffset = this.state.fileViewCursorLine
                    }
                    this.render()
                }
                return
            }

            if (key === '\x1b[B' || key === 'j') {
                if (this.state.fileViewCursorLine < total - 1) {
                    this.state.fileViewCursorLine += 1
                    if (
                        this.state.fileViewCursorLine >=
                        this.state.fileViewScrollOffset + visibleLineCount
                    ) {
                        this.state.fileViewScrollOffset =
                            this.state.fileViewCursorLine - visibleLineCount + 1
                    }
                    this.render()
                }
                return
            }

            // Page navigation: PageUp, PageDown, Ctrl+u (\x15), Ctrl+d (\x04)
            if (key === '\x1b[5~' || key === '\x15') {
                const step =
                    key === '\x15'
                        ? Math.max(1, Math.floor(visibleLineCount / 2))
                        : visibleLineCount
                this.state.fileViewCursorLine = Math.max(0, this.state.fileViewCursorLine - step)
                this.state.fileViewScrollOffset = Math.max(
                    0,
                    Math.min(this.state.fileViewCursorLine, this.state.fileViewScrollOffset - step)
                )
                this.render()
                return
            }

            if (key === '\x1b[6~' || key === '\x04') {
                const step =
                    key === '\x04'
                        ? Math.max(1, Math.floor(visibleLineCount / 2))
                        : visibleLineCount
                this.state.fileViewCursorLine = Math.min(
                    Math.max(0, total - 1),
                    this.state.fileViewCursorLine + step
                )
                this.state.fileViewScrollOffset = Math.min(
                    Math.max(0, total - visibleLineCount),
                    this.state.fileViewCursorLine >=
                        this.state.fileViewScrollOffset + visibleLineCount
                        ? this.state.fileViewCursorLine - visibleLineCount + 1
                        : this.state.fileViewScrollOffset + step
                )
                this.render()
                return
            }

            // Top / Bottom motions: g / G
            if (key === 'g') {
                this.state.fileViewCursorLine = 0
                this.state.fileViewScrollOffset = 0
                this.render()
                return
            }

            if (key === 'G') {
                this.state.fileViewCursorLine = Math.max(0, total - 1)
                this.state.fileViewScrollOffset = Math.max(0, total - visibleLineCount)
                this.render()
                return
            }

            // Center cursor in viewport: z
            if (key === 'z') {
                const half = Math.floor(visibleLineCount / 2)
                this.state.fileViewScrollOffset = Math.max(
                    0,
                    Math.min(
                        Math.max(0, total - visibleLineCount),
                        this.state.fileViewCursorLine - half
                    )
                )
                this.render()
                return
            }

            // c / C in task log view copies full output to system clipboard
            if (key === 'c' || key === 'C') {
                if (
                    this.state.fileViewReturnOverlay === 'tasks' ||
                    this.state.fileViewPath?.startsWith('Task Output:')
                ) {
                    const fullOutput = this.state.fileViewLines.join('\n')
                    writeToClipboard(fullOutput)
                    this.showToast('Copied task output to clipboard.', 'success')
                    return
                }
            }

            // Enter / Tab / c: insert context into prompt and return to prompt mode
            if (key === '\r' || key === '\n' || key === '\t' || key === 'c' || key === 'C') {
                if (
                    this.state.fileViewReturnOverlay === 'tasks' ||
                    this.state.fileViewPath?.startsWith('Task Output:')
                ) {
                    return
                }
                const lineNum = this.state.fileViewCursorLine + 1
                const filePath = this.state.fileViewPath
                const mention = lineNum > 1 ? `@${filePath}:${lineNum} ` : `@${filePath} `
                this.state.activeOverlay = 'none'
                this.state.input = this.state.input
                    ? `${this.state.input}${this.state.input.endsWith(' ') ? '' : ' '}${mention}`
                    : mention
                this.state.cursorPos = this.state.input.length
                this.showToast(`Inserted reference to ${filePath}:${lineNum}`, 'success')
                if (this.onInsertContextCallback) {
                    this.onInsertContextCallback(filePath, lineNum)
                }
                this.render()
                return
            }

            return
        }

        if (overlay === 'skills') {
            // SKILL.md viewer
            {
                const totalLines = this.state.skillsDetailLines.length
                const visibleLineCount = Math.max(5, this.screen.height - 4)

                if (key === 'q' || key === 'Q') {
                    this.handleOverlayEsc()
                    return
                }

                if (key === ' ' || key === '\t') {
                    const currentSkill = this.state.skillsDetailSkill
                    if (currentSkill) {
                        this.state.activeOverlay = 'none'
                        this.state.overlayHistory = []
                        this.state.skillsIsDetailView = false
                        this.state.input = `/${currentSkill.name} `
                        this.state.cursorPos = this.state.input.length
                        this.showToast(`Selected skill /${currentSkill.name}`, 'info')
                        this.render()
                    }
                    return
                }

                // Up arrow: scroll line up
                if (key === '\x1b[A' || key === 'k' || key === 'K') {
                    if (this.state.skillsCursorLine > 0) {
                        this.state.skillsCursorLine -= 1
                        if (this.state.skillsCursorLine < this.state.skillsScrollOffset) {
                            this.state.skillsScrollOffset = this.state.skillsCursorLine
                        }
                        this.render()
                    }
                    return
                }

                // Down arrow: scroll line down
                if (key === '\x1b[B' || key === 'j' || key === 'J') {
                    if (this.state.skillsCursorLine < totalLines - 1) {
                        this.state.skillsCursorLine += 1
                        if (
                            this.state.skillsCursorLine >=
                            this.state.skillsScrollOffset + visibleLineCount
                        ) {
                            this.state.skillsScrollOffset = Math.min(
                                Math.max(0, totalLines - visibleLineCount),
                                this.state.skillsCursorLine - visibleLineCount + 1
                            )
                        }
                        this.render()
                    }
                    return
                }

                // PageUp / PageDown
                if (key === '\x1b[5~') {
                    const step = visibleLineCount
                    this.state.skillsCursorLine = Math.max(0, this.state.skillsCursorLine - step)
                    this.state.skillsScrollOffset = Math.max(
                        0,
                        Math.min(this.state.skillsCursorLine, this.state.skillsScrollOffset - step)
                    )
                    this.render()
                    return
                }

                if (key === '\x1b[6~') {
                    const step = visibleLineCount
                    this.state.skillsCursorLine = Math.min(
                        Math.max(0, totalLines - 1),
                        this.state.skillsCursorLine + step
                    )
                    this.state.skillsScrollOffset = Math.min(
                        Math.max(0, totalLines - visibleLineCount),
                        this.state.skillsCursorLine >=
                            this.state.skillsScrollOffset + visibleLineCount
                            ? this.state.skillsCursorLine - visibleLineCount + 1
                            : this.state.skillsScrollOffset + step
                    )
                    this.render()
                    return
                }

                return
            }

            return
        }

        if (overlay === 'switch') {
            const items = this.state.switchItems
            if (this.state.switchConfirmDeleteValue) {
                if (key === 'y' || key === 'Y') {
                    const targetValue = this.state.switchConfirmDeleteValue
                    this.state.switchConfirmDeleteValue = null
                    if (this.onDeleteProviderCallback) {
                        Promise.resolve(this.onDeleteProviderCallback(targetValue)).catch(() => {})
                    }
                    const idx = items.findIndex((it) => it.value === targetValue)
                    if (idx !== -1) {
                        items.splice(idx, 1)
                    }
                    if (this.state.switchSelectedIndex >= items.length) {
                        this.state.switchSelectedIndex = Math.max(0, items.length - 1)
                    }
                    this.showToast('Removed credentials for provider.', 'success')
                    this.render()
                    return
                }
                if (key === 'n' || key === 'N' || key === '\x1b') {
                    this.state.switchConfirmDeleteValue = null
                    this.render()
                    return
                }
                return
            }

            if (key === 'd' || key === 'D') {
                const currentItem = items[this.state.switchSelectedIndex]
                if (currentItem) {
                    this.state.switchConfirmDeleteValue = currentItem.value
                    this.render()
                }
                return
            }

            if (key === '\x1b[A' || key === 'k') {
                if (this.state.switchSelectedIndex > 0) {
                    this.state.switchSelectedIndex -= 1
                    this.render()
                }
                return
            }

            if (key === '\x1b[B' || key === 'j') {
                if (this.state.switchSelectedIndex < items.length - 1) {
                    this.state.switchSelectedIndex += 1
                    this.render()
                }
                return
            }

            if (key === '\r' || key === '\n') {
                const currentItem = items[this.state.switchSelectedIndex]
                if (currentItem) {
                    if (this.onSwitchSelectCallback) {
                        Promise.resolve(this.onSwitchSelectCallback(currentItem.value)).catch(
                            () => {}
                        )
                    }
                    this.state.activeOverlay = 'none'
                    this.state.overlayHistory = []
                    this.showToast(`Switched to ${currentItem.label}.`, 'success')
                    this.render()
                }
                return
            }

            if (key === '\x1b') {
                this.closeOrPopOverlay()
                return
            }

            return
        }

        if (overlay === 'mcp') {
            const servers = this.state.mcpServersList
            const curServer = servers[this.state.mcpSelectedIndex]

            // 1. Delete confirmation active
            if (this.state.mcpConfirmDeleteName) {
                if (key === 'y' || key === 'Y') {
                    const toRemove = servers.find((s) => s.name === this.state.mcpConfirmDeleteName)
                    this.state.mcpConfirmDeleteName = null
                    if (toRemove && this.options?.onRemoveMcpServer) {
                        this.options
                            .onRemoveMcpServer(toRemove.name, toRemove.scope)
                            .then(async () => {
                                this.showToast(`Removed MCP server "${toRemove.name}".`, 'info')
                                this.state.mcpIsDetailView = false
                                this.state.mcpMode = 'list'
                                await this.loadMcpServers()
                            })
                            .catch((err: any) => {
                                this.showToast(
                                    `Failed to remove server: ${err?.message || err}`,
                                    'error'
                                )
                            })
                    }
                    this.render()
                    return
                }
                if (key === 'n' || key === 'N' || key === '\x1b') {
                    this.state.mcpConfirmDeleteName = null
                    this.render()
                    return
                }
                return
            }

            // 3. Add Custom mode
            if (this.state.mcpMode === 'add_custom') {
                if (key === '\t' || key === '\x1b[B') {
                    // M13: 5 fields, no button row (enter adds from any field)
                    this.state.mcpCustomActiveField = (this.state.mcpCustomActiveField + 1) % 5
                    this.render()
                    return
                }
                if (key === '\x1b[Z' || key === '\x1b[A') {
                    this.state.mcpCustomActiveField = (this.state.mcpCustomActiveField - 1 + 5) % 5
                    this.render()
                    return
                }
                if (key === ' ') {
                    if (this.state.mcpCustomActiveField === 2) {
                        this.state.mcpCustomScope =
                            this.state.mcpCustomScope === 'global' ? 'project' : 'global'
                        this.render()
                        return
                    }
                    if (this.state.mcpCustomActiveField === 3) {
                        this.state.mcpCustomEager = !this.state.mcpCustomEager
                        this.render()
                        return
                    }
                    if (this.state.mcpCustomActiveField === 0) {
                        this.state.mcpCustomName += ' '
                        this.render()
                        return
                    }
                    if (this.state.mcpCustomActiveField === 1) {
                        this.state.mcpCustomCommand += ' '
                        this.render()
                        return
                    }
                    if (this.state.mcpCustomActiveField === 4) {
                        this.state.mcpCustomEnv += ' '
                        this.render()
                        return
                    }
                    return
                }
                if (key === '\r' || key === '\n') {
                    const name = this.state.mcpCustomName.trim()
                    const target = this.state.mcpCustomCommand.trim()
                    if (!name || !target) {
                        this.showToast('Server name and command/URL are required.', 'error')
                        return
                    }

                    let env: Record<string, string> | undefined
                    if (this.state.mcpCustomEnv.trim()) {
                        env = {}
                        const pairs = this.state.mcpCustomEnv.split(',')
                        for (const pair of pairs) {
                            const [k, v] = pair.split('=')
                            if (k && v !== undefined) env[k.trim()] = v.trim()
                        }
                    }

                    if (this.options?.onAddMcpServer) {
                        this.options
                            .onAddMcpServer({
                                name,
                                target,
                                scope: this.state.mcpCustomScope,
                                eager: this.state.mcpCustomEager,
                                env,
                            })
                            .then(async () => {
                                this.showToast(`Added MCP server "${name}".`, 'info')
                                this.state.mcpMode = 'list'
                                await this.loadMcpServers()
                            })
                            .catch((err: any) => {
                                this.showToast(
                                    `Failed to add server: ${err?.message || err}`,
                                    'error'
                                )
                            })
                    } else {
                        this.state.mcpMode = 'list'
                        this.render()
                    }
                    return
                }
                if (key === '\x7f' || key === '\b') {
                    if (this.state.mcpCustomActiveField === 0) {
                        this.state.mcpCustomName = this.state.mcpCustomName.slice(0, -1)
                    } else if (this.state.mcpCustomActiveField === 1) {
                        this.state.mcpCustomCommand = this.state.mcpCustomCommand.slice(0, -1)
                    } else if (this.state.mcpCustomActiveField === 4) {
                        this.state.mcpCustomEnv = this.state.mcpCustomEnv.slice(0, -1)
                    }
                    this.render()
                    return
                }
                if (key.length === 1 && key >= ' ') {
                    if (this.state.mcpCustomActiveField === 0) {
                        this.state.mcpCustomName += key
                    } else if (this.state.mcpCustomActiveField === 1) {
                        this.state.mcpCustomCommand += key
                    } else if (this.state.mcpCustomActiveField === 4) {
                        this.state.mcpCustomEnv += key
                    }
                    this.render()
                    return
                }
                return
            }

            // 4. Detail mode
            if (this.state.mcpIsDetailView || this.state.mcpMode === 'detail') {
                if (key === '\x1b[A' || key === 'k') {
                    this.state.mcpScrollOffset = Math.max(0, this.state.mcpScrollOffset - 1)
                    this.render()
                    return
                }
                if (key === '\x1b[B' || key === 'j') {
                    this.state.mcpScrollOffset += 1
                    this.render()
                    return
                }
                if (key === ' ') {
                    if (curServer && this.options?.onToggleMcpServer) {
                        this.options
                            .onToggleMcpServer(curServer.name)
                            .then(async () => {
                                const newAction =
                                    curServer.status === 'connected' ? 'Stopped' : 'Started'
                                this.showToast(
                                    `${newAction} MCP server "${curServer.name}".`,
                                    'info'
                                )
                                await this.loadMcpServers()
                            })
                            .catch((err: any) => {
                                this.showToast(
                                    `Failed to toggle server: ${err?.message || err}`,
                                    'error'
                                )
                            })
                    }
                    return
                }
                if (key === 'r' || key === 'R') {
                    if (curServer && this.options?.onRestartMcpServer) {
                        this.options
                            .onRestartMcpServer(curServer.name)
                            .then(async () => {
                                this.showToast(`Restarted MCP server "${curServer.name}".`, 'info')
                                await this.loadMcpServers()
                            })
                            .catch((err: any) => {
                                this.showToast(
                                    `Failed to restart server: ${err?.message || err}`,
                                    'error'
                                )
                            })
                    }
                    return
                }
                if (key === 'd' || key === 'D') {
                    if (curServer?.plugin) {
                        this.showToast(
                            `${curServer.name} comes from the ${curServer.plugin} plugin. Uninstall it in /plugin.`,
                            'info'
                        )
                    } else if (curServer) {
                        this.state.mcpConfirmDeleteName = curServer.name
                        this.render()
                    }
                    return
                }
                if (key === '\x1b') {
                    this.state.mcpIsDetailView = false
                    this.state.mcpMode = 'list'
                    this.state.mcpScrollOffset = 0
                    this.render()
                    return
                }
                return
            }

            // 5. List mode
            const total = servers.length
            if (key === '\x1b[A' || key === 'k') {
                if (this.state.mcpSelectedIndex > 0) {
                    this.state.mcpSelectedIndex -= 1
                    if (this.state.mcpSelectedIndex < this.state.mcpWindowStart) {
                        this.state.mcpWindowStart = this.state.mcpSelectedIndex
                    }
                    this.render()
                }
                return
            }

            if (key === '\x1b[B' || key === 'j') {
                if (this.state.mcpSelectedIndex < total - 1) {
                    this.state.mcpSelectedIndex += 1
                    const maxWin = Math.max(1, (this.screen?.rows ?? 24) - 8)
                    if (this.state.mcpSelectedIndex >= this.state.mcpWindowStart + maxWin) {
                        this.state.mcpWindowStart += 1
                    }
                    this.render()
                }
                return
            }

            if (key === '\r' || key === '\n') {
                if (total > 0) {
                    this.state.mcpIsDetailView = true
                    this.state.mcpMode = 'detail'
                    this.state.mcpScrollOffset = 0
                    this.render()
                }
                return
            }

            if (key === ' ') {
                if (curServer && this.options?.onToggleMcpServer) {
                    this.options
                        .onToggleMcpServer(curServer.name)
                        .then(async () => {
                            const newAction =
                                curServer.status === 'connected' ? 'Stopped' : 'Started'
                            this.showToast(`${newAction} MCP server "${curServer.name}".`, 'info')
                            await this.loadMcpServers()
                        })
                        .catch((err: any) => {
                            this.showToast(
                                `Failed to toggle server: ${err?.message || err}`,
                                'error'
                            )
                        })
                }
                return
            }

            if (key === 'r' || key === 'R') {
                if (curServer && this.options?.onRestartMcpServer) {
                    this.options
                        .onRestartMcpServer(curServer.name)
                        .then(async () => {
                            this.showToast(`Restarted MCP server "${curServer.name}".`, 'info')
                            await this.loadMcpServers()
                        })
                        .catch((err: any) => {
                            this.showToast(
                                `Failed to restart server: ${err?.message || err}`,
                                'error'
                            )
                        })
                } else {
                    this.loadMcpServers().catch(() => {
                        // Intentionally swallowed: reload error
                    })
                }
                return
            }

            if (key === 'a' || key === 'A') {
                this.state.mcpMode = 'add_custom'
                this.state.mcpCustomName = ''
                this.state.mcpCustomCommand = ''
                this.state.mcpCustomScope = 'global'
                this.state.mcpCustomEager = false
                this.state.mcpCustomEnv = ''
                this.state.mcpCustomActiveField = 0
                this.render()
                return
            }

            if (key === 'd' || key === 'D') {
                if (curServer?.plugin) {
                    this.showToast(
                        `${curServer.name} comes from the ${curServer.plugin} plugin. Uninstall it in /plugin.`,
                        'info'
                    )
                } else if (curServer) {
                    this.state.mcpConfirmDeleteName = curServer.name
                    this.render()
                }
                return
            }

            if (key === '\x1b') {
                this.closeOrPopOverlay()
                return
            }

            return
        }

        if (overlay === 'plugin') {
            this.handlePluginKey(key)
            return
        }

        if (overlay === 'model') {
            const models = this.state.models
            const filtered = ModelSelectMenuView.getFilteredModels(
                models,
                this.state.modelSearchQuery
            )

            if (this.state.modelToolsConfirm) {
                const target = this.state.modelToolsConfirm
                if (key === 'y' || key === 'Y' || key === '\r' || key === '\n') {
                    this.state.modelToolsConfirm = null
                    this.applyModelSelection(target)
                    return
                }
                if (key === 'n' || key === 'N' || key === '\x1b') {
                    this.state.modelToolsConfirm = null
                    this.render()
                }
                return
            }

            if (this.state.modelSwitchConfirm) {
                const pending = this.state.modelSwitchConfirm
                if (key === 'y' || key === 'Y' || key === '\r' || key === '\n') {
                    this.state.modelSwitchConfirm = null
                    this.applyModelSelection(pending.fallback)
                    return
                }
                if (key === 'n' || key === 'N' || key === '\x1b') {
                    this.state.modelSwitchConfirm = null
                    this.render()
                }
                return
            }

            if (this.state.isModelSearching) {
                if (key === '\r' || key === '\n' || key === '\x1b[B') {
                    this.state.isModelSearching = false
                    this.render()
                    return
                }
                if (key === '\x7f' || key === '\b') {
                    this.state.modelSearchQuery = this.state.modelSearchQuery.slice(0, -1)
                    this.state.modelSelectedIndex = 0
                    this.state.modelWindowStart = 0
                    this.render()
                    return
                }
                if (key === '\x1b') {
                    this.state.isModelSearching = false
                    this.render()
                    return
                }
                if (!key.startsWith('\x1b') && key.length > 0) {
                    this.state.modelSearchQuery += key
                    this.state.modelSelectedIndex = 0
                    this.state.modelWindowStart = 0
                    this.render()
                }
                return
            }

            if (key === '/' || key === 's') {
                this.state.isModelSearching = true
                this.render()
                return
            }

            if (key === '\x1b[A' || key === 'k') {
                if (this.state.modelSelectedIndex > 0) {
                    this.state.modelSelectedIndex -= 1
                    if (this.state.modelSelectedIndex < this.state.modelWindowStart) {
                        this.state.modelWindowStart = this.state.modelSelectedIndex
                    }
                    this.render()
                }
                return
            }

            if (key === '\x1b[B' || key === 'j') {
                if (this.state.modelSelectedIndex < filtered.length - 1) {
                    this.state.modelSelectedIndex += 1
                    if (
                        this.state.modelSelectedIndex >=
                        this.state.modelWindowStart + MODEL_WINDOW_SIZE
                    ) {
                        this.state.modelWindowStart =
                            this.state.modelSelectedIndex - MODEL_WINDOW_SIZE + 1
                    }
                    this.render()
                }
                return
            }

            if (key === '\r' || key === '\n') {
                const selected = filtered[this.state.modelSelectedIndex]
                if (!selected) return
                const check = this.onCheckModelCallback?.(selected)
                if (check && !check.available) {
                    if (check.fallback) {
                        this.state.modelSwitchConfirm = {
                            failed: selected,
                            fallback: check.fallback,
                        }
                    } else {
                        this.showToast(
                            `${selected.label} is not available on this key. Use /switch to change provider.`,
                            'error'
                        )
                    }
                    this.render()
                    return
                }
                // decision 2c: a model without tools is allowed, after an inline confirm
                if (selected.tools === false) {
                    this.state.modelToolsConfirm = selected
                    this.render()
                    return
                }
                this.applyModelSelection(selected)
                return
            }

            if ((key === 'r' || key === 'R') && this.onModelRefreshCallback) {
                if (this.state.modelRefreshing) return
                this.state.modelRefreshing = true
                this.render()
                Promise.resolve(this.onModelRefreshCallback())
                    .catch(() => {
                        // Intentionally swallowed: the cli reports refresh failures in a toast
                    })
                    .finally(() => {
                        this.state.modelRefreshing = false
                        this.render()
                    })
                return
            }

            if (key === '\x1b') {
                if (this.state.modelSearchQuery) {
                    this.state.modelSearchQuery = ''
                    this.state.modelSelectedIndex = 0
                    this.state.modelWindowStart = 0
                    this.render()
                    return
                }
                this.state.activeOverlay = 'none'
                this.render()
                return
            }
            return
        }

        if (overlay === 'diff') {
            const files = this.state.diffFiles

            if (this.state.isDiffDetailView) {
                // Cycle files with Left / Right arrow or h / l
                if (key === '\x1b[D' || key === 'h') {
                    this.cycleDiffFile(-1)
                    return
                }
                if (key === '\x1b[C' || key === 'l') {
                    this.cycleDiffFile(1)
                    return
                }

                const currentFile = files[this.state.diffSelectedIndex]
                if (currentFile) {
                    const fullContent = this.getDiffFullContent(currentFile.path)
                    const parsed = parseUnifiedDiffToRows(currentFile.diff || '', {
                        fullContent,
                        expandAllFolds: this.state.isDiffFullFile,
                    })
                    const diffRows = parsed.rows
                    const changeBlocks = parsed.changeBlocks
                    const visibleDiffHeight = Math.max(2, this.screen.height - 4)

                    // Helper to adjust scroll offset when cursor moves so cursor is kept inside the visible area
                    const keepCursorInView = (cursorIdx: number) => {
                        this.state.diffCursorLineIndex = cursorIdx
                        if (cursorIdx < this.state.diffScrollOffset) {
                            this.state.diffScrollOffset = cursorIdx
                        } else if (cursorIdx >= this.state.diffScrollOffset + visibleDiffHeight) {
                            this.state.diffScrollOffset = cursorIdx - visibleDiffHeight + 1
                        }
                    }

                    // Toggle full file diff view with 'f'
                    if (key === 'f') {
                        const currentRow = diffRows[this.state.diffCursorLineIndex]
                        const targetLineNum =
                            currentRow?.type === 'line'
                                ? currentRow.data.newLineNumber || currentRow.data.oldLineNumber
                                : currentRow?.type === 'fold'
                                  ? currentRow.data.startNew || currentRow.data.startOld
                                  : undefined

                        this.state.isDiffFullFile = !this.state.isDiffFullFile

                        const parsedAfter = parseUnifiedDiffToRows(currentFile.diff || '', {
                            fullContent,
                            expandAllFolds: this.state.isDiffFullFile,
                        })

                        if (targetLineNum !== undefined) {
                            const newRowIdx = parsedAfter.rows.findIndex(
                                (r) =>
                                    (r.type === 'line' &&
                                        (r.data.newLineNumber === targetLineNum ||
                                            r.data.oldLineNumber === targetLineNum)) ||
                                    (r.type === 'fold' &&
                                        targetLineNum >= r.data.startNew &&
                                        targetLineNum < r.data.startNew + r.data.count)
                            )
                            if (newRowIdx >= 0) {
                                keepCursorInView(newRowIdx)
                            }
                        } else {
                            keepCursorInView(
                                Math.min(
                                    this.state.diffCursorLineIndex,
                                    Math.max(0, parsedAfter.rows.length - 1)
                                )
                            )
                        }

                        this.render()
                        return
                    }

                    // Jump next diff change block with 'n'
                    if (key === 'n') {
                        if (changeBlocks.length > 0) {
                            const cursor = this.state.diffCursorLineIndex
                            const currentBlock = changeBlocks.find(
                                (b) => cursor >= b.startIndex && cursor <= b.endIndex
                            )
                            const nextBlock = currentBlock
                                ? changeBlocks.find((b) => b.startIndex > currentBlock.endIndex)
                                : changeBlocks.find((b) => b.startIndex > cursor)

                            if (nextBlock) {
                                keepCursorInView(nextBlock.startIndex)
                                this.render()
                            }
                        }
                        return
                    }

                    // Jump prev diff change block with 'p' or 'N'
                    if (key === 'p' || key === 'N') {
                        if (changeBlocks.length > 0) {
                            const cursor = this.state.diffCursorLineIndex
                            const currentBlock = changeBlocks.find(
                                (b) => cursor >= b.startIndex && cursor <= b.endIndex
                            )
                            let prevBlock: ChangeBlock | undefined
                            if (currentBlock) {
                                const currentIdx = changeBlocks.indexOf(currentBlock)
                                if (currentIdx > 0) {
                                    prevBlock = changeBlocks[currentIdx - 1]
                                } else if (cursor > currentBlock.startIndex) {
                                    prevBlock = currentBlock
                                }
                            } else {
                                const prevBlocks = changeBlocks.filter((b) => b.startIndex < cursor)
                                prevBlock = prevBlocks[prevBlocks.length - 1]
                            }

                            if (prevBlock) {
                                keepCursorInView(prevBlock.startIndex)
                                this.render()
                            }
                        }
                        return
                    }

                    // Cursor Up (↑ or k)
                    if (key === '\x1b[A' || key === 'k') {
                        if (this.state.diffCursorLineIndex > 0) {
                            keepCursorInView(this.state.diffCursorLineIndex - 1)
                            this.render()
                        }
                        return
                    }

                    // Cursor Down (↓ or j)
                    if (key === '\x1b[B' || key === 'j') {
                        if (this.state.diffCursorLineIndex < diffRows.length - 1) {
                            keepCursorInView(this.state.diffCursorLineIndex + 1)
                            this.render()
                        }
                        return
                    }

                    // Page navigation: PageDown / PageUp, Ctrl+d, Ctrl+u
                    if (key === '\x1b[6~' || key === '\x04') {
                        const step = Math.max(1, Math.floor(visibleDiffHeight / 2))
                        const target = Math.min(
                            diffRows.length - 1,
                            this.state.diffCursorLineIndex + step
                        )
                        keepCursorInView(target)
                        this.render()
                        return
                    }

                    if (key === '\x1b[5~' || key === '\x15') {
                        const step = Math.max(1, Math.floor(visibleDiffHeight / 2))
                        const target = Math.max(0, this.state.diffCursorLineIndex - step)
                        keepCursorInView(target)
                        this.render()
                        return
                    }

                    // Top / Bottom: g / G
                    if (key === 'g') {
                        keepCursorInView(0)
                        this.render()
                        return
                    }

                    if (key === 'G') {
                        keepCursorInView(Math.max(0, diffRows.length - 1))
                        this.render()
                        return
                    }

                    // Enter / Tab / c: insert context into input bar and dismiss overlay
                    if (key === '\r' || key === '\n' || key === '\t' || key === 'c') {
                        const currentRow = diffRows[this.state.diffCursorLineIndex]
                        if (currentRow && currentRow.type === 'line') {
                            const line = currentRow.data
                            const lineNum =
                                line.type === 'delete' ? line.oldLineNumber : line.newLineNumber
                            const mention = lineNum
                                ? `@${currentFile.path}:${lineNum} `
                                : `@${currentFile.path} `
                            this.state.activeOverlay = 'none'
                            this.state.input = this.state.input
                                ? `${this.state.input}${this.state.input.endsWith(' ') ? '' : ' '}${mention}`
                                : mention
                            this.state.cursorPos = this.state.input.length
                            this.showToast(
                                `Inserted reference to ${currentFile.path}${lineNum ? `:${lineNum}` : ''}`,
                                'success'
                            )
                            if (this.onInsertContextCallback) {
                                this.onInsertContextCallback(currentFile.path, lineNum || 1)
                            }
                            this.render()
                            return
                        }
                    }
                }
                return
            }

            if (key === '\x1b[A' || key === 'k') {
                if (this.state.diffSelectedIndex > 0) {
                    this.state.diffSelectedIndex -= 1
                    if (this.state.diffSelectedIndex < this.state.diffWindowStart) {
                        this.state.diffWindowStart = this.state.diffSelectedIndex
                    }
                    this.render()
                }
                return
            }

            const diffWindowSize = DIFF_WINDOW_SIZE

            if (key === '\x1b[B' || key === 'j') {
                if (this.state.diffSelectedIndex < files.length - 1) {
                    this.state.diffSelectedIndex += 1
                    if (
                        this.state.diffSelectedIndex >=
                        this.state.diffWindowStart + diffWindowSize
                    ) {
                        this.state.diffWindowStart =
                            this.state.diffSelectedIndex - diffWindowSize + 1
                    }
                    this.render()
                }
                return
            }

            // Tab: insert context
            if (key === '\t') {
                const currentFile = files[this.state.diffSelectedIndex]
                if (currentFile) {
                    const mention = `@${currentFile.path} `
                    this.state.activeOverlay = 'none'
                    this.state.input = this.state.input
                        ? `${this.state.input}${this.state.input.endsWith(' ') ? '' : ' '}${mention}`
                        : mention
                    this.state.cursorPos = this.state.input.length
                    this.showToast(`Inserted reference to ${currentFile.path}`, 'success')
                    if (this.onInsertContextCallback) {
                        this.onInsertContextCallback(currentFile.path, 1)
                    }
                    this.render()
                    return
                }
            }

            // Enter / Right arrow / l: open detail view
            if (key === '\r' || key === '\n' || key === '\x1b[C' || key === 'l') {
                if (files.length > 0) {
                    this.state.isDiffDetailView = true
                    const currentFile = files[this.state.diffSelectedIndex]
                    const saved = currentFile
                        ? this.state.diffFilePositions[currentFile.path]
                        : null
                    if (saved) {
                        this.state.diffCursorLineIndex = saved.cursorIndex
                        this.state.diffScrollOffset = saved.scrollOffset
                        if (saved.isFullFile !== undefined) {
                            this.state.isDiffFullFile = saved.isFullFile
                        }
                    } else {
                        this.state.diffScrollOffset = 0
                        this.state.diffCursorLineIndex = 0
                    }
                    this.render()
                }
                return
            }

            // s: switch between this session's changes and all changes
            if (key === 's' || key === 'S') {
                if (!this.state.isDiffLoading) {
                    this.setDiffScope(this.state.diffScope === 'session' ? 'all' : 'session')
                    this.render()
                }
                return
            }

            // Left arrow / h: dismiss diff overlay
            if (key === '\x1b[D' || key === 'h') {
                this.state.activeOverlay = 'none'
                this.render()
                return
            }
            return
        }

        if (overlay === 'tasks') {
            const tasks = this.state.tasks
            const selectedTask = tasks[this.state.tasksSelectedIndex]

            // Stop confirmation: y stops, anything else cancels
            if (this.state.tasksConfirmStop) {
                const mode = this.state.tasksConfirmStop
                this.state.tasksConfirmStop = null
                if (key === 'y' || key === 'Y') {
                    const targets =
                        mode === 'all'
                            ? tasks.filter((t) => t.status === 'running')
                            : selectedTask && selectedTask.status === 'running'
                              ? [selectedTask]
                              : []
                    for (const t of targets) {
                        this.onKillTaskCallback?.(t.id)
                    }
                    if (targets.length > 0) {
                        this.showToast(
                            mode === 'all'
                                ? `Stopped ${targets.length} task${targets.length === 1 ? '' : 's'}.`
                                : `Stopped ${targets[0]!.id}.`,
                            'info'
                        )
                    }
                }
                this.render()
                return
            }

            if (key === '\x1b[A' || key === 'k') {
                if (this.state.tasksSelectedIndex > 0) {
                    this.state.tasksSelectedIndex -= 1
                    this.clampTasksSelection()
                    this.render()
                }
                return
            }
            if (key === '\x1b[B' || key === 'j') {
                if (this.state.tasksSelectedIndex < tasks.length - 1) {
                    this.state.tasksSelectedIndex += 1
                    this.clampTasksSelection()
                    this.render()
                }
                return
            }
            if (key === 'd') {
                if (selectedTask && selectedTask.status === 'running') {
                    this.state.tasksConfirmStop = 'one'
                    this.render()
                } else if (selectedTask) {
                    this.showToast(`${selectedTask.id} is not running.`, 'info')
                }
                return
            }
            if (key === 'D') {
                if (tasks.some((t) => t.status === 'running')) {
                    this.state.tasksConfirmStop = 'all'
                    this.render()
                } else {
                    this.showToast('No running tasks to stop.', 'info')
                }
                return
            }
            if (key === 'x' || key === 'X') {
                const cleared = tasks.filter((t) => t.status !== 'running').length
                if (cleared === 0) {
                    this.showToast('No finished tasks to clear.', 'info')
                    return
                }
                // the task manager owns the list: clearing only the view would let the
                // next sync bring the tasks back
                this.onClearCompletedTasksCallback?.()
                this.state.tasks = tasks.filter((t) => t.status === 'running')
                this.clampTasksSelection()
                this.showToast(
                    `Cleared ${cleared} finished task${cleared === 1 ? '' : 's'}.`,
                    'info'
                )
                this.render()
                return
            }
            if (key === 'c' || key === 'C') {
                if (selectedTask && selectedTask.output) {
                    writeToClipboard(selectedTask.output)
                    this.showToast('Copied task log to clipboard.', 'success')
                } else {
                    this.showToast('No task log to copy.', 'info')
                }
                return
            }
            if (key === '\r' || key === '\n' || key === ' ') {
                if (selectedTask) {
                    const lines = getTaskLogLines(selectedTask)
                    // open at the end so the log follows new output
                    void this.openFileView(
                        getTaskLogTitle(selectedTask, true),
                        lines.length,
                        'tasks',
                        undefined,
                        undefined,
                        lines
                    )
                    this.state.fileViewTaskId = selectedTask.id
                    this.state.fileViewScrollOffset = Math.max(
                        0,
                        lines.length - this.getFileViewVisibleLineCount()
                    )
                    this.render()
                }
                return
            }
            return
        }

        if (overlay === 'session') {
            if (this.state.sessionConfirmDeleteId !== null) {
                if (key === 'y' || key === 'Y') {
                    const idToDelete = this.state.sessionConfirmDeleteId
                    this.state.sessionConfirmDeleteId = null
                    this.state.sessions = this.state.sessions.filter((s) => s.id !== idToDelete)
                    if (this.state.sessionSelectedIndex >= this.state.sessions.length) {
                        this.state.sessionSelectedIndex = Math.max(
                            0,
                            this.state.sessions.length - 1
                        )
                    }
                    if (this.onSessionDeleteCallback) {
                        this.onSessionDeleteCallback(idToDelete)
                    }
                    this.showToast('Deleted session.', 'info')
                    this.render()
                    return
                }
                if (key === 'n' || key === 'N' || key === '\x1b') {
                    this.state.sessionConfirmDeleteId = null
                    this.render()
                    return
                }
                return
            }

            if (this.state.sessionRenameMode) {
                if (key === '\r' || key === '\n') {
                    const filtered = SessionSelectMenuView.getFiltered(
                        this.state.sessions,
                        this.state.sessionSearchQuery
                    )
                    const cur = filtered[this.state.sessionSelectedIndex]
                    if (cur) {
                        const newTitle = this.state.sessionRenameValue.replace(/\s+/g, ' ').trim()
                        if (newTitle && newTitle !== cur.title) {
                            cur.title = newTitle
                            if (cur.id === this.state.sessionId) {
                                this.setSessionTitle(newTitle)
                            }
                            if (this.onSessionRenameCallback) {
                                const res = this.onSessionRenameCallback(cur.id, newTitle)
                                if (res && typeof (res as Promise<void>).catch === 'function') {
                                    ;(res as Promise<void>).catch(() => {
                                        // Intentionally swallowed: the CLI callback reports its own errors
                                    })
                                }
                            }
                            this.showToast('Renamed session.', 'success')
                        }
                    }
                    this.state.sessionRenameMode = false
                    this.render()
                    return
                }
                if (key === '\x1b') {
                    this.state.sessionRenameMode = false
                    this.render()
                    return
                }
                if (key === '\x7f' || key === '\b') {
                    this.state.sessionRenameValue = this.state.sessionRenameValue.slice(0, -1)
                    this.render()
                    return
                }
                if (!key.startsWith('\x1b') && key.length > 0) {
                    this.state.sessionRenameValue += key
                    this.render()
                }
                return
            }

            if (this.state.isSessionSearching) {
                if (key === '\r' || key === '\n' || key === '\x1b[B') {
                    this.state.isSessionSearching = false
                    this.render()
                    return
                }
                if (key === '\x1b') {
                    this.state.isSessionSearching = false
                    this.render()
                    return
                }
                if (key === '\x7f' || key === '\b') {
                    this.state.sessionSearchQuery = this.state.sessionSearchQuery.slice(0, -1)
                    this.state.sessionSelectedIndex = 0
                    this.state.sessionWindowStart = 0
                    this.render()
                    return
                }
                if (!key.startsWith('\x1b') && key.length > 0) {
                    this.state.sessionSearchQuery += key
                    this.state.sessionSelectedIndex = 0
                    this.state.sessionWindowStart = 0
                    this.render()
                }
                return
            }

            const filtered = SessionSelectMenuView.getFiltered(
                this.state.sessions,
                this.state.sessionSearchQuery
            )

            if (key === '/' || key === 's') {
                this.state.isSessionSearching = true
                this.render()
                return
            }

            if (key === 'r' || key === 'R') {
                const cur = filtered[this.state.sessionSelectedIndex]
                if (cur) {
                    this.state.sessionRenameMode = true
                    this.state.sessionRenameValue = getSessionDisplayTitle(cur)
                    this.render()
                }
                return
            }

            if (key === 'd' || key === 'D' || key === '\x1b[3~') {
                const cur = filtered[this.state.sessionSelectedIndex]
                if (cur) {
                    this.state.sessionConfirmDeleteId = cur.id
                    this.render()
                }
                return
            }

            if (key === '\x1b[A' || key === 'k') {
                if (this.state.sessionSelectedIndex > 0) {
                    this.state.sessionSelectedIndex -= 1
                    if (this.state.sessionSelectedIndex < this.state.sessionWindowStart) {
                        this.state.sessionWindowStart = this.state.sessionSelectedIndex
                    }
                    this.render()
                }
                return
            }

            if (key === '\x1b[B' || key === 'j') {
                if (this.state.sessionSelectedIndex < filtered.length - 1) {
                    this.state.sessionSelectedIndex += 1
                    if (
                        this.state.sessionSelectedIndex >=
                        this.state.sessionWindowStart + SESSION_WINDOW_SIZE
                    ) {
                        this.state.sessionWindowStart =
                            this.state.sessionSelectedIndex - SESSION_WINDOW_SIZE + 1
                    }
                    this.render()
                }
                return
            }

            if (key === '\r' || key === '\n') {
                const cur = filtered[this.state.sessionSelectedIndex]
                if (cur) {
                    this.state.activeOverlay = 'none'
                    this.state.sessionId = cur.id
                    if (this.onSessionSelectCallback) {
                        this.onSessionSelectCallback(cur.id)
                    }
                    this.showToast(`Switched to session ${cur.preview || cur.id}.`, 'success')
                }
                return
            }

            if (key === 'q' || key === 'Q' || key === '\x1b') {
                this.state.activeOverlay = 'none'
                this.render()
                return
            }
            return
        }

        if (overlay === 'usage') {
            if (key === 'b' || key === 'B') {
                const dashboard = this.getUsageDashboard()
                if (this.onOpenBillingPortalCallback) {
                    this.onOpenBillingPortalCallback(dashboard.url)
                } else {
                    openBrowserUrl(dashboard.url)
                }
                this.showToast(`Opening ${dashboard.name} usage dashboard in browser…`, 'info')
                return
            }
            if (key === 'q' || key === 'Q' || key === '\r' || key === '\n' || key === '\x1b') {
                this.closeOrPopOverlay()
                return
            }
            return
        }

        if (overlay === 'rewind') {
            const turns = this.state.rewindTurns

            if (this.state.rewindConfirming) {
                if (key === 'y' || key === 'Y' || key === '\r' || key === '\n') {
                    const turn = turns[this.state.rewindSelectedIndex]
                    this.state.rewindConfirming = false
                    this.state.activeOverlay = 'none'
                    if (turn && this.onRewindTurnCallback) {
                        const res = this.onRewindTurnCallback(turn.id)
                        if (res && typeof (res as Promise<any>).catch === 'function') {
                            ;(res as Promise<any>).catch((err: any) => {
                                this.showToast(`Failed to rewind: ${err.message || err}`, 'error')
                                this.render()
                            })
                        }
                    }
                    this.render()
                    return
                }
                if (key === 'n' || key === 'N' || key === '\x1b') {
                    this.state.rewindConfirming = false
                    this.render()
                }
                return
            }

            if (key === '\x1b[A' || key === 'k') {
                if (this.state.rewindSelectedIndex > 0) {
                    this.state.rewindSelectedIndex -= 1
                    if (this.state.rewindSelectedIndex < this.state.rewindWindowStart) {
                        this.state.rewindWindowStart = this.state.rewindSelectedIndex
                    }
                    this.render()
                }
                return
            }
            if (key === '\x1b[B' || key === 'j') {
                if (this.state.rewindSelectedIndex < turns.length - 1) {
                    this.state.rewindSelectedIndex += 1
                    if (
                        this.state.rewindSelectedIndex >=
                        this.state.rewindWindowStart + REWIND_WINDOW_SIZE
                    ) {
                        this.state.rewindWindowStart =
                            this.state.rewindSelectedIndex - REWIND_WINDOW_SIZE + 1
                    }
                    this.render()
                }
                return
            }
            if (key === '\r' || key === '\n') {
                if (turns[this.state.rewindSelectedIndex]) {
                    this.state.rewindConfirming = true
                    this.render()
                }
                return
            }
            if (key === 'q' || key === 'Q' || key === '\x1b') {
                this.state.activeOverlay = 'none'
                this.render()
                return
            }
            return
        }

        if (overlay === 'memory') {
            // Arrow Up / k
            if (key === '\x1b[A' || key === 'k') {
                if (this.state.memoryCursorLine > 0) {
                    this.state.memoryCursorLine -= 1
                    if (this.state.memoryCursorLine < this.state.memoryScrollOffset) {
                        this.state.memoryScrollOffset = this.state.memoryCursorLine
                    }
                    this.render()
                }
                return
            }

            // Arrow Down / j
            if (key === '\x1b[B' || key === 'j') {
                const visibleRows = Math.max(5, this.screen.height - 6)
                const content = this.state.memoryFile?.content || ''
                const totalLines = content ? content.split('\n').length : 0
                if (this.state.memoryCursorLine < totalLines - 1) {
                    this.state.memoryCursorLine += 1
                    if (
                        this.state.memoryCursorLine >=
                        this.state.memoryScrollOffset + visibleRows
                    ) {
                        this.state.memoryScrollOffset =
                            this.state.memoryCursorLine - visibleRows + 1
                    }
                    this.render()
                }
                return
            }

            // [c]: Create starter AGENTS.md, only once loading finished and no rule file was found
            if (key === 'c' || key === 'C') {
                const canScaffold =
                    !this.state.memoryIsLoading &&
                    this.state.memoryFile === null &&
                    Boolean(this.options?.onScaffoldRules)
                if (canScaffold) {
                    this.options!.onScaffoldRules!()
                        .then(async (res) => {
                            if (res.success) {
                                this.showToast('Created starter AGENTS.md.', 'success')
                                await this.loadAgentsFile()
                            } else {
                                this.showToast(res.message, 'error')
                            }
                        })
                        .catch((error: unknown) => {
                            const reason = error instanceof Error ? error.message : String(error)
                            this.showToast(`Could not create AGENTS.md: ${reason}`, 'error')
                        })
                }
                return
            }

            // [q]: Back / close memory viewer
            if (key === 'q' || key === 'Q') {
                this.state.activeOverlay = this.state.memoryReturnOverlay || 'none'
                this.render()
                this.state.memoryReturnOverlay = 'none'
                return
            }
            return
        }

        if (overlay === 'ask_question') {
            const qList = this.state.pendingQuestions
            if (!qList) return
            const currentQ = qList[this.state.currentQuestionIndex]
            if (!currentQ) return
            const optionsCount = currentQ.options.length
            const isMulti = Boolean(currentQ.is_multi_select)
            // The last row is "Type your own answer…" (S21)
            const customIndex = optionsCount

            if (this.state.questionCustomText !== null) {
                const typed = this.state.questionCustomText
                if (key === '\r' || key === '\n') {
                    const answer = typed.trim()
                    if (!answer) return
                    if (isMulti) {
                        const chosen = Array.from(this.state.questionSelectedMulti)
                            .map((i) => currentQ.options[i])
                            .filter(Boolean) as string[]
                        this.submitCurrentQuestionAnswer([...chosen, answer])
                    } else {
                        this.submitCurrentQuestionAnswer(answer)
                    }
                    return
                }
                if (key === '\x7f' || key === '\b') {
                    this.state.questionCustomText = typed.slice(0, -1)
                    this.render()
                    return
                }
                if (key === '\x1b[A') {
                    this.state.questionCustomText = null
                    this.state.questionSelectedIndex = Math.max(0, customIndex - 1)
                    this.render()
                    return
                }
                if (!key.startsWith('\x1b') && [...key].every((c) => c.charCodeAt(0) >= 32)) {
                    this.state.questionCustomText = typed + key
                    this.render()
                }
                return
            }

            if (key === '\x1b[A' || key === 'k') {
                if (this.state.questionSelectedIndex > 0) {
                    this.state.questionSelectedIndex -= 1
                    this.render()
                }
                return
            }
            if (key === '\x1b[B' || key === 'j') {
                if (this.state.questionSelectedIndex < customIndex) {
                    this.state.questionSelectedIndex += 1
                    this.render()
                }
                return
            }
            if (
                (key === '\r' || key === '\n') &&
                this.state.questionSelectedIndex === customIndex
            ) {
                this.state.questionCustomText = ''
                this.render()
                return
            }
            if (key === ' ' && isMulti && this.state.questionSelectedIndex < customIndex) {
                if (this.state.questionSelectedMulti.has(this.state.questionSelectedIndex)) {
                    this.state.questionSelectedMulti.delete(this.state.questionSelectedIndex)
                } else {
                    this.state.questionSelectedMulti.add(this.state.questionSelectedIndex)
                }
                this.render()
                return
            }
            if (/^[1-9]$/.test(key)) {
                const idx = parseInt(key, 10) - 1
                if (idx < optionsCount) {
                    this.state.questionSelectedIndex = idx
                    if (isMulti) {
                        if (this.state.questionSelectedMulti.has(idx)) {
                            this.state.questionSelectedMulti.delete(idx)
                        } else {
                            this.state.questionSelectedMulti.add(idx)
                        }
                        this.render()
                        return
                    } else {
                        this.submitCurrentQuestionAnswer(currentQ.options[idx] || '')
                        return
                    }
                }
            }
            if (key === '\r' || key === '\n') {
                if (isMulti) {
                    const selectedIdxs = Array.from(this.state.questionSelectedMulti)
                    const chosen =
                        selectedIdxs.length > 0
                            ? (selectedIdxs
                                  .map((i) => currentQ.options[i])
                                  .filter(Boolean) as string[])
                            : [currentQ.options[this.state.questionSelectedIndex] || '']
                    this.submitCurrentQuestionAnswer(chosen)
                } else {
                    const chosen = currentQ.options[this.state.questionSelectedIndex] || ''
                    this.submitCurrentQuestionAnswer(chosen)
                }
                return
            }
            return
        }

        if (overlay === 'tool_permission') {
            const opts = getPermissionOptions(
                this.state.pendingToolCall?.toolName || '',
                this.state.pendingToolCall?.commandOrTarget
            )
            if (
                key === '\x1b[A' ||
                key === '\x1b[D' ||
                key === 'k' ||
                key === 'h' ||
                key === '\x1b[Z'
            ) {
                this.state.toolPermissionSelectedIndex =
                    (this.state.toolPermissionSelectedIndex - 1 + opts.length) % opts.length
                this.render()
                return
            }
            if (
                key === '\x1b[B' ||
                key === '\x1b[C' ||
                key === 'j' ||
                key === 'l' ||
                key === '\t'
            ) {
                this.state.toolPermissionSelectedIndex =
                    (this.state.toolPermissionSelectedIndex + 1) % opts.length
                this.render()
                return
            }
            if (key === 'y' || key === 'Y') {
                this.resolveToolPermission('approve')
                return
            }
            if (key === 'a' || key === 'A') {
                this.resolveToolPermission('always')
                return
            }
            if ((key === 'g' || key === 'G') && opts.some((o) => o.value === 'git_tracked')) {
                this.resolveToolPermission('git_tracked')
                return
            }
            if (key === 'd' || key === 'D' || key === 'n' || key === 'N') {
                this.resolveToolPermission('deny')
                return
            }
            if (key === '\r' || key === '\n' || key === ' ') {
                const opt = opts[this.state.toolPermissionSelectedIndex]
                this.resolveToolPermission(opt?.value || 'deny')
                return
            }
            return
        }

        if (overlay === 'plan_approve') {
            const opts = PLAN_APPROVE_OPTIONS
            if (
                key === '\x1b[A' ||
                key === '\x1b[D' ||
                key === 'k' ||
                key === 'h' ||
                key === '\x1b[Z'
            ) {
                this.state.planApproveSelectedIndex =
                    (this.state.planApproveSelectedIndex - 1 + opts.length) % opts.length
                this.render()
                return
            }
            if (
                key === '\x1b[B' ||
                key === '\x1b[C' ||
                key === 'j' ||
                key === 'l' ||
                key === '\t'
            ) {
                this.state.planApproveSelectedIndex =
                    (this.state.planApproveSelectedIndex + 1) % opts.length
                this.render()
                return
            }
            if (key === '1' || key === 'y' || key === 'a') {
                this.resolvePlanApproval('approve')
                return
            }
            if (key === '2' || key === 'r') {
                this.resolvePlanApproval('refine')
                return
            }
            if (key === '3' || key === 'v') {
                this.resolvePlanApproval('view')
                return
            }
            if (key === '4' || key === 'n' || key === 'd') {
                this.resolvePlanApproval('reject')
                return
            }
            if (key === '\r' || key === '\n' || key === ' ') {
                const opt = opts[this.state.planApproveSelectedIndex]
                this.resolvePlanApproval(opt?.value || 'reject')
                return
            }
            return
        }

        if (overlay === 'auth') {
            if (this.state.authViewMode === 'menu') {
                if (key === '\x1b[A' || key === 'k') {
                    if (this.state.authMenuSelectedIndex > 0) {
                        this.state.authMenuSelectedIndex -= 1
                        this.render()
                    }
                    return
                }
                if (key === '\x1b[B' || key === 'j') {
                    if (this.state.authMenuSelectedIndex < MAIN_MENU_OPTIONS.length - 1) {
                        this.state.authMenuSelectedIndex += 1
                        this.render()
                    }
                    return
                }
                if (key === '\r' || key === '\n' || key === ' ') {
                    if (this.state.authMenuSelectedIndex === 0) {
                        this.state.authViewMode = 'subscription'
                        this.state.authProviders = SUBSCRIPTION_PROVIDER_ITEMS
                        this.state.authProviderSelectedIndex = 0
                        this.state.authProviderWindowStart = 0
                        this.state.authProviderSearchQuery = ''
                        this.state.isSearchingAuthProviders = false
                        this.state.authConfirmDeleteValue = null
                        this.state.authConfirmTarget = null
                        this.render()
                    } else if (this.state.authMenuSelectedIndex === 1) {
                        this.state.authViewMode = 'byok_provider'
                        this.state.authProviders = BYOK_PROVIDER_ITEMS
                        this.state.authProviderSelectedIndex = 0
                        this.state.authProviderWindowStart = 0
                        this.state.authProviderSearchQuery = ''
                        this.state.isSearchingAuthProviders = false
                        this.state.authConfirmDeleteValue = null
                        this.state.authConfirmTarget = null
                        this.render()
                    } else {
                        this.startDecemberLogin()
                    }
                    return
                }
                if (key === '\x1b') {
                    this.state.activeOverlay = 'none'
                    this.render()
                    return
                }
                return
            }

            if (this.state.authViewMode === 'subscription') {
                if (this.state.authConfirmDeleteValue) {
                    if (key === 'y' || key === 'Y') {
                        const targetValue = this.state.authConfirmDeleteValue
                        this.state.authConfirmDeleteValue = null
                        if (this.onDeleteProviderCallback) {
                            Promise.resolve(this.onDeleteProviderCallback(targetValue)).catch(
                                () => {
                                    // Intentionally swallowed: delete provider callback error handled
                                }
                            )
                        }
                        const subKey = targetValue.replace(/^subscription:/, '')
                        const idx = this.state.switchItems.findIndex(
                            (it) =>
                                it.value === targetValue || it.value === `subscription:${subKey}`
                        )
                        if (idx !== -1) {
                            this.state.switchItems.splice(idx, 1)
                        }
                        this.showToast('Disconnected subscription.', 'success')
                        this.render()
                        return
                    }
                    if (key === 'n' || key === 'N' || key === '\x1b') {
                        this.state.authConfirmDeleteValue = null
                        this.render()
                        return
                    }
                    return
                }

                if (key === 'd' || key === 'D') {
                    const sel = SUBSCRIPTION_PROVIDER_ITEMS[this.state.authProviderSelectedIndex]
                    const configuredSubs = this.getConfiguredSubscriptionValues()
                    if (sel && configuredSubs.includes(sel.value)) {
                        this.state.authConfirmDeleteValue = `subscription:${sel.value}`
                        this.render()
                    }
                    return
                }

                if (key === '\x1b[A' || key === 'k') {
                    if (this.state.authProviderSelectedIndex > 0) {
                        this.state.authProviderSelectedIndex -= 1
                        this.render()
                    }
                    return
                }
                if (key === '\x1b[B' || key === 'j') {
                    if (
                        this.state.authProviderSelectedIndex <
                        SUBSCRIPTION_PROVIDER_ITEMS.length - 1
                    ) {
                        this.state.authProviderSelectedIndex += 1
                        this.render()
                    }
                    return
                }
                if (key === '\r' || key === '\n' || key === ' ') {
                    const sel = SUBSCRIPTION_PROVIDER_ITEMS[this.state.authProviderSelectedIndex]
                    if (sel) {
                        const configuredSubs = this.getConfiguredSubscriptionValues()
                        if (configuredSubs.includes(sel.value)) {
                            const configuredItem = this.state.switchItems.find(
                                (it) =>
                                    it.value === `subscription:${sel.value}` ||
                                    (it as any).provider === sel.value
                            )
                            this.state.authConfirmTarget = {
                                label: sel.label,
                                value: sel.value,
                                account: (configuredItem as any)?.account,
                            }
                            this.state.authViewMode = 'confirm_switch_subscription'
                            this.render()
                            return
                        }

                        if (this.onSubscriptionLoginCallback) {
                            this.startSubscriptionLogin(sel.value, sel.label)
                            return
                        }
                        this.showToast(
                            `Run \`december login ${sel.value}\` in your terminal.`,
                            'info'
                        )
                        this.state.activeOverlay = 'none'
                        this.render()
                        return
                    }
                    return
                }
                if (key === '\x1b') {
                    this.state.activeOverlay = 'login'
                    this.render()
                    return
                }
                return
            }

            if (this.state.authViewMode === 'confirm_switch_subscription') {
                if (key === 'y' || key === 'Y') {
                    const target = this.state.authConfirmTarget
                    this.state.authConfirmTarget = null
                    this.state.authViewMode = 'subscription'
                    if (target && this.onSubscriptionLoginCallback) {
                        this.startSubscriptionLogin(target.value, target.label)
                        return
                    }
                    this.render()
                    return
                }
                if (key === 'n' || key === 'N' || key === '\r' || key === '\n') {
                    const target = this.state.authConfirmTarget
                    this.state.authConfirmTarget = null
                    this.state.authViewMode = 'subscription'
                    this.state.activeOverlay = 'none'
                    if (this.onSwitchSelectCallback && target) {
                        Promise.resolve(
                            this.onSwitchSelectCallback(`subscription:${target.value}`)
                        ).catch(() => {
                            // Intentionally swallowed: switch provider error handled
                        })
                    }
                    this.showToast(`Switched to ${target?.label || 'subscription'}.`, 'success')
                    this.render()
                    return
                }
                if (key === '\x1b') {
                    this.state.authConfirmTarget = null
                    this.state.authViewMode = 'subscription'
                    this.render()
                    return
                }
                return
            }

            if (this.state.authViewMode === 'byok_provider') {
                const providers =
                    this.state.authProviders.length > 0
                        ? this.state.authProviders
                        : DEFAULT_AUTH_PROVIDERS
                const filtered = AuthMenuView.getFilteredProviders(
                    providers,
                    this.state.authProviderSearchQuery
                )

                if (this.state.authConfirmDeleteValue) {
                    if (key === 'y' || key === 'Y') {
                        const targetValue = this.state.authConfirmDeleteValue
                        this.state.authConfirmDeleteValue = null
                        if (this.onDeleteProviderCallback) {
                            Promise.resolve(this.onDeleteProviderCallback(targetValue)).catch(
                                () => {
                                    // Intentionally swallowed: delete provider callback error handled
                                }
                            )
                        }
                        const provKey = targetValue.replace(/^(provider|byok):/, '')
                        const idx = this.state.switchItems.findIndex(
                            (it) =>
                                it.value === targetValue ||
                                it.value === `provider:${provKey}` ||
                                it.value === `byok:${provKey}`
                        )
                        if (idx !== -1) {
                            this.state.switchItems.splice(idx, 1)
                        }
                        this.showToast('Removed API key.', 'success')
                        this.render()
                        return
                    }
                    if (key === 'n' || key === 'N' || key === '\x1b') {
                        this.state.authConfirmDeleteValue = null
                        this.render()
                        return
                    }
                    return
                }

                if (this.state.isSearchingAuthProviders) {
                    if (key === '\r' || key === '\n' || key === '\x1b[B') {
                        this.state.isSearchingAuthProviders = false
                        this.render()
                        return
                    }
                    if (key === '\x7f' || key === '\b') {
                        this.state.authProviderSearchQuery =
                            this.state.authProviderSearchQuery.slice(0, -1)
                        this.state.authProviderSelectedIndex = 0
                        this.state.authProviderWindowStart = 0
                        this.render()
                        return
                    }
                    if (!key.startsWith('\x1b') && key.length > 0) {
                        this.state.authProviderSearchQuery += key
                        this.state.authProviderSelectedIndex = 0
                        this.state.authProviderWindowStart = 0
                        this.render()
                    }
                    return
                }

                if (key === 'd' || key === 'D') {
                    const sel = filtered[this.state.authProviderSelectedIndex]
                    const configuredKeys = this.getConfiguredProviderValues()
                    if (sel && configuredKeys.includes(sel.value)) {
                        this.state.authConfirmDeleteValue = `provider:${sel.value}`
                        this.render()
                    }
                    return
                }

                if (key === '/' || key === 's') {
                    this.state.isSearchingAuthProviders = true
                    this.render()
                    return
                }

                if (key === '\x1b[A' || key === 'k') {
                    if (this.state.authProviderSelectedIndex > 0) {
                        this.state.authProviderSelectedIndex -= 1
                        if (
                            this.state.authProviderSelectedIndex <
                            this.state.authProviderWindowStart
                        ) {
                            this.state.authProviderWindowStart =
                                this.state.authProviderSelectedIndex
                        }
                        this.render()
                    }
                    return
                }

                if (key === '\x1b[B' || key === 'j') {
                    if (this.state.authProviderSelectedIndex < filtered.length - 1) {
                        this.state.authProviderSelectedIndex += 1
                        if (
                            this.state.authProviderSelectedIndex >=
                            this.state.authProviderWindowStart + AUTH_PROVIDER_WINDOW_SIZE
                        ) {
                            this.state.authProviderWindowStart =
                                this.state.authProviderSelectedIndex - AUTH_PROVIDER_WINDOW_SIZE + 1
                        }
                        this.render()
                    }
                    return
                }

                if (key === '\r' || key === '\n') {
                    const sel = filtered[this.state.authProviderSelectedIndex]
                    if (sel) {
                        if (sel.isSubscription) {
                            if (this.onSubscriptionLoginCallback) {
                                this.startSubscriptionLogin(sel.value, sel.label)
                                return
                            }
                            this.showToast(
                                `Run \`december login ${sel.value}\` in your terminal.`,
                                'info'
                            )
                            this.state.activeOverlay = 'none'
                            this.render()
                            return
                        }

                        const configuredKeys = this.getConfiguredProviderValues()
                        if (configuredKeys.includes(sel.value)) {
                            this.state.authConfirmTarget = {
                                label: sel.label,
                                value: sel.value,
                            }
                            this.state.authViewMode = 'confirm_replace_byok'
                            this.render()
                            return
                        }

                        this.state.authViewMode = 'byok_key'
                        this.state.authApiKeyInput = ''
                        this.state.authKeyError = null
                        this.render()
                    }
                    return
                }

                if (key === '\x1b') {
                    if (this.state.authProviderSearchQuery) {
                        this.state.authProviderSearchQuery = ''
                        this.state.authProviderSelectedIndex = 0
                        this.state.authProviderWindowStart = 0
                        this.render()
                        return
                    }
                    this.state.activeOverlay = 'login'
                    this.render()
                    return
                }
                return
            }

            if (this.state.authViewMode === 'confirm_replace_byok') {
                if (key === 'y' || key === 'Y') {
                    this.state.authConfirmTarget = null
                    this.state.authViewMode = 'byok_key'
                    this.state.authApiKeyInput = ''
                    this.state.authKeyError = null
                    this.render()
                    return
                }
                if (key === 'n' || key === 'N' || key === '\r' || key === '\n') {
                    const target = this.state.authConfirmTarget
                    this.state.authConfirmTarget = null
                    this.state.authViewMode = 'byok_provider'
                    this.state.activeOverlay = 'none'
                    if (this.onSwitchSelectCallback && target) {
                        Promise.resolve(
                            this.onSwitchSelectCallback(`provider:${target.value}`)
                        ).catch(() => {
                            // Intentionally swallowed: switch provider error handled
                        })
                    }
                    this.showToast(
                        `Using existing API key for ${target?.label || 'provider'}.`,
                        'success'
                    )
                    this.render()
                    return
                }
                if (key === '\x1b') {
                    this.state.authConfirmTarget = null
                    this.state.authViewMode = 'byok_provider'
                    this.render()
                    return
                }
                return
            }

            if (this.state.authViewMode === 'byok_key') {
                // the key is with the provider: wait for the answer (esc is handled in handleOverlayEsc)
                if (this.state.authKeyChecking) return
                if (key === '\x1b') {
                    this.state.authViewMode = 'byok_provider'
                    this.render()
                    return
                }
                if (key === '\x7f' || key === '\b') {
                    this.state.authApiKeyInput = this.state.authApiKeyInput.slice(0, -1)
                    this.state.authKeyError = null
                    this.render()
                    return
                }
                if (key === '\r' || key === '\n') {
                    const trimmed = this.state.authApiKeyInput.trim()
                    if (!trimmed) {
                        this.state.authKeyError = 'API key cannot be empty'
                        this.render()
                        return
                    }
                    const currentProviders =
                        this.state.authProviders.length > 0
                            ? this.state.authProviders
                            : UNIFIED_PROVIDER_MENU_ITEMS
                    const filtered = AuthMenuView.getFilteredProviders(
                        currentProviders,
                        this.state.authProviderSearchQuery
                    )
                    const sel = filtered[this.state.authProviderSelectedIndex]
                    const provider = sel?.value || 'custom'
                    this.submitApiKey(provider, trimmed)
                    return
                }
                if (!key.startsWith('\x1b') && key.length > 0) {
                    this.state.authApiKeyInput += key
                    this.state.authKeyError = null
                    this.render()
                }
                return
            }
        }
    }

    submitPrompt(overridePrompt?: string): void {
        const raw = (overridePrompt ?? this.state.input).trim()
        if (!raw) return
        if (this.updateInProgress) {
            // npm is replacing this package's files; a new turn could load parts of
            // the app that are mid-replacement. Keep the text so nothing is lost.
            this.showToast('Wait for the update to finish, then send your prompt.', 'info')
            return
        }
        const text = expandPastes(raw)

        // Direct shell command (!<command>)
        if (text.startsWith('!')) {
            const rawCmd = text.slice(1).trim()
            if (!rawCmd) {
                this.showToast('Usage: !<command> (e.g. !git status)', 'info')
                return
            }

            this.state.promptHistory.push(raw)
            this.state.historyIndex = -1

            this.state.input = ''
            this.state.cursorPos = 0
            this.state.scrollOffset = undefined
            this.state.isReadingMode = false
            this.state.isFileAutocompleteVisible = false

            if (this.state.isStreaming) {
                this.state.promptQueue.push(text)
                this.queuedRawInputs.set(text, raw)
                this.showToast(
                    `Command queued (#${this.state.promptQueue.length}). Will run after turn finishes.`,
                    'info'
                )
                this.render()
                return
            }

            this.state.messages.push({
                role: 'user',
                content: text,
            })
            this.render()

            if (this.onExecuteDirectCommandCallback) {
                this.onExecuteDirectCommandCallback(rawCmd)
            } else if (this.onSubmitCallback) {
                this.onSubmitCallback(text)
            }
            return
        }

        // Safeguard: slash commands must NEVER be sent to chat!
        if (text.startsWith('/')) {
            this.executeCommand(text.slice(1))
            return
        }

        // Plan mode: the prompt starts a plan, same as /plan <prompt>
        const outgoing = this.state.planMode ? `/plan ${text}` : text

        this.state.promptHistory.push(raw)
        this.state.historyIndex = -1

        this.state.input = ''
        this.state.cursorPos = 0
        this.state.overlayHistory = []
        this.state.scrollOffset = undefined
        this.state.isReadingMode = false
        this.state.isFileAutocompleteVisible = false

        if (this.state.isStreaming) {
            this.state.promptQueue.push(outgoing)
            this.queuedRawInputs.set(outgoing, raw)
            this.showToast(
                `Prompt queued (#${this.state.promptQueue.length}). Will run after turn finishes.`,
                'info'
            )
            this.render()
            return
        }

        this.state.messages.push({
            role: 'user',
            content: outgoing,
        })

        this.render()

        if (this.onSubmitCallback) {
            this.onSubmitCallback(outgoing)
        }
    }

    /** `/compact [focus]`: summarizes the conversation now and marks the point in the transcript. */
    runCompact(focus?: string): void {
        if (this.state.isStreaming) {
            this.showToast('Wait for the current turn to finish, then run /compact.', 'info')
            return
        }
        const onCompact = this.options?.onCompact
        if (!onCompact) {
            this.showToast('Compaction is not available in this session.', 'error')
            return
        }
        this.state.isStreaming = true
        this.startSpinner()
        this.setStatusMessage('Compacting conversation…')
        onCompact(focus)
            .then((res) => {
                if (res.compacted) {
                    this.appendCompactionMarker({
                        manual: true,
                        focus,
                        tokensBefore: res.tokensBefore,
                        tokensAfter: res.tokensAfter,
                    })
                } else {
                    this.showToast('Nothing to compact yet. The conversation is too short.', 'info')
                }
            })
            .catch((err: any) => {
                const message = err?.message || String(err)
                this.showToast(
                    message === 'Aborted'
                        ? 'Compaction cancelled.'
                        : `Compaction failed: ${message}`,
                    message === 'Aborted' ? 'info' : 'error'
                )
            })
            .finally(() => {
                this.finishStream()
            })
    }

    /** Shows a one-line marker in the transcript where the conversation was compacted. */
    appendCompactionMarker(info: {
        manual?: boolean
        focus?: string
        tokensBefore?: number
        tokensAfter?: number
    }): void {
        const fmt = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n))
        let text = info.manual ? 'Conversation compacted' : 'Conversation compacted automatically'
        if (info.tokensBefore !== undefined && info.tokensAfter !== undefined) {
            text += ` · ~${fmt(info.tokensBefore)} → ~${fmt(info.tokensAfter)} tokens`
        }
        if (info.focus) text += ` · focus: ${info.focus}`
        this.state.messages.push({ role: 'compaction', content: text })
        if (info.tokensAfter !== undefined) this.state.contextTokens = info.tokensAfter
        if (!this.state.isReadingMode) this.state.scrollOffset = undefined
        this.render()
    }

    /**
     * /skills: lists every skill grouped by where it comes from, with skills that failed to load.
     * `reload` scans again. The agent keeps its skill list until the next session, so the
     * system prompt (and its prompt cache) does not change in the middle of a session.
     */
    openSkillsReport(reload = false): void {
        const previous = new Set(this.getEnabledSkills().map((s) => s.name))
        let discovered: ReturnType<SkillDiscoveryEngine['discoverAllSkills']>
        let errors: { path: string; message: string }[]
        try {
            const engine = new SkillDiscoveryEngine({
                workspaceDir: this.state.cwd || process.cwd(),
                includeDisabled: true,
            })
            discovered = engine.discoverAllSkills()
            errors = engine.getErrors()
        } catch (err: any) {
            discovered = []
            errors = [{ path: 'skills', message: err?.message || String(err) }]
        }

        const enabled = discovered.filter((s) => s.enabled !== false)
        if (reload && !this.options?.skills) {
            this.enabledSkillsCache = enabled.map((s) => ({
                name: s.name,
                description: s.metadata?.description || '',
                origin: s.origin,
                directoryPath: s.directoryPath,
                entryFilePath: s.entryFilePath,
            }))
        }

        const groups: { label: string; origins: string[] }[] = [
            { label: 'Project', origins: ['workspace', 'declared'] },
            { label: 'Project plugins', origins: ['workspace-plugin'] },
            { label: 'User', origins: ['global'] },
            { label: 'User plugins', origins: ['global-plugin'] },
            { label: 'Built-in', origins: ['builtin'] },
        ]
        const rows: ReportRow[] = []
        for (const group of groups) {
            const items = discovered.filter((s) => group.origins.includes(s.origin))
            if (items.length === 0) continue
            if (rows.length > 0) rows.push({ text: '' })
            rows.push({ text: `${group.label} (${items.length})`, tone: 'heading' })
            for (const skill of items) {
                const off = skill.enabled === false
                rows.push({
                    id: `skill:${skill.name}`,
                    text: skill.name,
                    tone: off ? 'muted' : 'normal',
                    detail: `${off ? '(off) ' : ''}${skill.metadata?.description || ''}`,
                })
            }
        }
        if (errors.length > 0) {
            if (rows.length > 0) rows.push({ text: '' })
            rows.push({ text: `Could not load (${errors.length})`, tone: 'heading' })
            for (const e of errors) {
                rows.push({ text: toTildePath(e.path), tone: 'fail', detail: e.message })
            }
        }

        const byId = new Map(discovered.map((s) => [`skill:${s.name}`, s]))
        this.openReport({
            kind: 'skills',
            title: 'Skills',
            subtitle: `${enabled.length} on${discovered.length > enabled.length ? `, ${discovered.length - enabled.length} off` : ''}`,
            rows,
            isLoading: false,
            emptyText:
                'No skills found. Add one in .december/skills/<name>/SKILL.md or install a plugin with /plugin.',
            footer: [
                { key: '↑/↓', label: 'select' },
                { key: 'enter', label: 'view' },
                { key: 'r', label: 'reload' },
                { key: 'esc', label: 'close' },
            ],
            onEnter: (row) => {
                const skill = row?.id ? byId.get(row.id) : undefined
                if (!skill) return
                this.state.overlayHistory.push('report')
                this.state.activeOverlay = 'skills'
                this.openSkillDetail({
                    name: skill.name,
                    description: skill.metadata?.description || '',
                    origin: skill.origin,
                    directoryPath: skill.directoryPath,
                    entryFilePath: skill.entryFilePath,
                }).catch(() => {
                    // Intentionally swallowed: openSkillDetail shows its own error state
                })
            },
            onKey: (key) => {
                if (key !== 'r') return false
                this.openSkillsReport(true)
                return true
            },
        })

        if (reload) {
            const now = new Set(enabled.map((s) => s.name))
            const added = [...now].filter((n) => !previous.has(n)).length
            const removed = [...previous].filter((n) => !now.has(n)).length
            const change =
                added || removed ? ` (${added} new, ${removed} removed)` : ' (no changes)'
            this.showToast(
                `Found ${now.size} skills${change}. /skill:<name> uses the new list now; the agent picks it up in the next session.`,
                'info'
            )
        }
    }

    /** /check: runs the host's health checks and shows them grouped, with fixes for problems. */
    openCheckReport(): void {
        const onRunChecks = this.options?.onRunChecks
        const footer = [
            { key: '↑/↓', label: 'scroll' },
            { key: 'r', label: 'run again' },
            { key: 'esc', label: 'close' },
        ]
        const onKey = (key: string) => {
            if (key !== 'r') return false
            this.openCheckReport()
            return true
        }
        this.openReport({
            kind: 'check',
            title: 'Check',
            rows: [],
            isLoading: true,
            loadingText: 'Running checks…',
            footer,
            onKey,
        })
        if (!onRunChecks) {
            this.updateReport('check', {
                isLoading: false,
                emptyText: 'Run `december doctor` in your terminal.',
            })
            return
        }
        onRunChecks()
            .then((checks) => {
                const rows: ReportRow[] = []
                const groups: string[] = []
                for (const c of checks) if (!groups.includes(c.group)) groups.push(c.group)
                for (const group of groups) {
                    if (rows.length > 0) rows.push({ text: '' })
                    rows.push({ text: group, tone: 'heading' })
                    for (const c of checks.filter((x) => x.group === group)) {
                        rows.push({ text: c.label, tone: c.status, detail: c.detail })
                        if (c.fix && c.status !== 'ok') {
                            rows.push({ text: `└ ${c.fix}`, tone: 'muted' })
                        }
                    }
                }
                const fails = checks.filter((c) => c.status === 'fail').length
                const warns = checks.filter((c) => c.status === 'warn').length
                this.updateReport('check', {
                    isLoading: false,
                    rows,
                    subtitle:
                        fails + warns === 0
                            ? 'all checks passed'
                            : `${fails} problem${fails === 1 ? '' : 's'}, ${warns} warning${warns === 1 ? '' : 's'}`,
                })
            })
            .catch((err: any) => {
                this.updateReport('check', {
                    isLoading: false,
                    rows: [{ text: 'Checks failed to run', tone: 'fail', detail: err?.message }],
                })
            })
    }

    /**
     * /permissions: allow and deny rules from the project and global files.
     * tab switches lists, a / g add a project / global rule, d removes the selected rule,
     * m switches between always-proceed and always-ask.
     */
    openPermissionsReport(kind: 'allow' | 'deny', keepSelection = false): void {
        const onLoad = this.options?.onLoadPermissions
        const onChange = this.options?.onChangePermissionRule
        const previous =
            keepSelection && this.state.report?.kind === 'permissions'
                ? {
                      selected: this.state.report.selectedIndex,
                      scroll: this.state.report.scrollOffset,
                  }
                : null

        const footer = [
            { key: 'tab', label: kind === 'allow' ? 'deny rules' : 'allow rules' },
            { key: 'a', label: 'add project rule' },
            { key: 'g', label: 'add global rule' },
            { key: 'd', label: 'remove' },
            { key: 'm', label: 'mode' },
            { key: 'esc', label: 'close' },
        ]
        const tabs = [
            { label: 'Allow', active: kind === 'allow' },
            { label: 'Deny', active: kind === 'deny' },
        ]
        this.openReport({
            kind: 'permissions',
            title: 'Permissions',
            tabs,
            rows: [],
            isLoading: true,
            footer,
        })
        if (!onLoad) {
            this.updateReport('permissions', {
                isLoading: false,
                emptyText: 'Permissions are not available in this session.',
            })
            return
        }

        const apply = async (change: PermissionRuleChange, done: string) => {
            if (!onChange) return
            try {
                await onChange(change)
                this.showToast(done, 'success')
            } catch (err: any) {
                this.showToast(err?.message || String(err), 'error')
            }
            this.openPermissionsReport(kind, true)
        }

        const promptRule = (scope: 'global' | 'project') => {
            const report = this.state.report
            if (!report || report.kind !== 'permissions') return
            report.input = {
                prompt: `Add ${scope} ${kind} rule:`,
                value: '',
                onSubmit: (value) => {
                    const pattern = value.trim()
                    if (!pattern) return
                    void apply(
                        { action: 'add', kind, scope, pattern },
                        `Added ${scope} ${kind} rule "${pattern}".`
                    )
                },
            }
            this.render()
        }

        onLoad()
            .then((data) => {
                const rows: ReportRow[] = []
                const modeText =
                    data.toolPermission === 'always-ask'
                        ? 'always-ask: edits and commands ask first, unless an allow rule matches'
                        : 'always-proceed: edits and commands run without asking'
                rows.push({ text: 'Mode', tone: 'heading', detail: modeText })
                if (kind === 'allow' && data.toolPermission === 'always-proceed') {
                    rows.push({
                        text: 'Allow rules only matter in always-ask mode (press m to switch).',
                        tone: 'muted',
                    })
                }
                if (kind === 'deny') {
                    rows.push({
                        text: 'Deny rules block matching calls in every mode, before anything else.',
                        tone: 'muted',
                    })
                }
                rows.push({
                    text: 'Rule format: a command (bun test), a prefix (bun test*), <tool>: <path>, or a tool name.',
                    tone: 'muted',
                })
                for (const scope of ['project', 'global'] as const) {
                    const list = data[kind][scope]
                    rows.push({ text: '' })
                    rows.push({
                        text: `${scope === 'project' ? 'Project' : 'Global'} (${list.length})`,
                        tone: 'heading',
                        detail: scope === 'project' ? data.projectPath : data.globalPath,
                    })
                    if (list.length === 0) {
                        rows.push({ text: 'No rules', tone: 'muted' })
                    }
                    for (const pattern of list) {
                        rows.push({ id: `${scope}\u0000${pattern}`, text: pattern })
                    }
                }

                const report = this.state.report
                if (!report || report.kind !== 'permissions') return
                report.rows = rows
                report.isLoading = false
                report.subtitle = data.toolPermission
                const firstRule = firstSelectableRow(rows)
                report.selectedIndex =
                    previous && rows[previous.selected]?.id
                        ? previous.selected
                        : previous
                          ? nextSelectableRow(
                                rows,
                                Math.min(previous.selected, rows.length - 1),
                                -1
                            )
                          : firstRule
                if (!rows[report.selectedIndex]?.id) report.selectedIndex = firstRule
                report.scrollOffset = previous?.scroll ?? 0
                report.onKey = (key, row) => {
                    if (key === '\t' || key === '\x1b[Z' || key === '\x1b[C' || key === '\x1b[D') {
                        this.openPermissionsReport(kind === 'allow' ? 'deny' : 'allow')
                        return true
                    }
                    if (key === 'a') {
                        promptRule('project')
                        return true
                    }
                    if (key === 'g') {
                        promptRule('global')
                        return true
                    }
                    if ((key === 'd' || key === 'x' || key === '\x7f') && row?.id) {
                        const [scope, pattern] = row.id.split('\u0000') as [
                            'global' | 'project',
                            string,
                        ]
                        void apply(
                            { action: 'remove', kind, scope, pattern },
                            `Removed ${scope} ${kind} rule "${pattern}".`
                        )
                        return true
                    }
                    if (key === 'm') {
                        const next =
                            data.toolPermission === 'always-ask' ? 'always-proceed' : 'always-ask'
                        const setting = this.state.settings.find((s) => s.id === 'tool_permission')
                        const previous = setting?.value
                        if (setting) setting.value = next
                        Promise.resolve(this.options?.onSettingChange?.('tool_permission', next))
                            .then(() => {
                                this.showToast(`Tool permission mode: ${next}.`, 'success')
                                this.openPermissionsReport(kind, true)
                            })
                            .catch((err: any) => {
                                if (setting && previous !== undefined && setting.value === next) {
                                    setting.value = previous
                                }
                                this.showToast(err?.message || String(err), 'error')
                            })
                        return true
                    }
                    return false
                }
                this.render()
            })
            .catch((err: any) => {
                this.updateReport('permissions', {
                    isLoading: false,
                    rows: [{ text: 'Could not load rules', tone: 'fail', detail: err?.message }],
                })
            })
    }

    /**
     * /github: checks gh, the repo, the workflow file, and the secrets, then runs each step
     * on a key press: w writes the workflow, k / u set the API key secret, s / i set the
     * Slack / Discord webhook secrets. Secrets are sent to GitHub only on these key presses.
     */
    openGithubReport(keepSelection = false): void {
        const onLoad = this.options?.onLoadGithubSetup
        const onAction = this.options?.onGithubSetupAction
        const previousScroll =
            keepSelection && this.state.report?.kind === 'github'
                ? this.state.report.scrollOffset
                : 0
        let confirmOverwrite = false

        this.openReport({
            kind: 'github',
            title: 'GitHub Action',
            rows: [],
            isLoading: true,
            loadingText: 'Checking gh, the repository, and its secrets…',
            footer: [{ key: 'esc', label: 'close' }],
        })
        if (!onLoad || !onAction) {
            this.updateReport('github', {
                isLoading: false,
                emptyText: 'GitHub setup is not available in this session.',
            })
            return
        }

        const run = (action: GithubSetupAction) => {
            this.updateReport('github', { isLoading: true, loadingText: 'Working…' })
            onAction(action)
                .then((message) => {
                    this.showToast(message, 'success')
                    this.openGithubReport(true)
                })
                .catch((err: any) => {
                    this.showToast(err?.message || String(err), 'error')
                    this.openGithubReport(true)
                })
        }

        const askSecret = (name: string, prompt: string) => {
            const report = this.state.report
            if (!report || report.kind !== 'github') return
            report.input = {
                prompt,
                value: '',
                mask: true,
                onSubmit: (value) => {
                    if (!value.trim()) return
                    run({ type: 'set-secret', name, value })
                },
            }
            this.render()
        }

        onLoad()
            .then((data) => {
                const rows: ReportRow[] = []
                const footer: MenuFooterItem[] = []
                rows.push({ text: 'Setup', tone: 'heading' })
                rows.push(
                    data.ghInstalled
                        ? { text: 'GitHub CLI (gh)', tone: 'ok', detail: 'installed' }
                        : { text: 'GitHub CLI (gh)', tone: 'fail', detail: 'not found' }
                )
                if (!data.ghInstalled) {
                    rows.push({ text: '└ Install it from https://cli.github.com', tone: 'muted' })
                } else {
                    rows.push(
                        data.ghAuthed
                            ? { text: 'Signed in to GitHub', tone: 'ok' }
                            : {
                                  text: 'Signed in to GitHub',
                                  tone: 'fail',
                                  detail: data.ghAuthDetail || 'not signed in',
                              }
                    )
                    if (!data.ghAuthed) {
                        rows.push({ text: '└ Run `!gh auth login`, then press r', tone: 'muted' })
                    }
                }
                if (!data.inGitRepo) {
                    rows.push({ text: 'Repository', tone: 'fail', detail: 'not a git repository' })
                } else if (data.ghAuthed) {
                    rows.push(
                        data.repo
                            ? { text: 'Repository', tone: 'ok', detail: data.repo }
                            : {
                                  text: 'Repository',
                                  tone: 'fail',
                                  detail: 'no GitHub remote found for this repository',
                              }
                    )
                }

                const ready = data.ghInstalled && data.ghAuthed && Boolean(data.repo)
                if (data.inGitRepo) {
                    rows.push(
                        data.workflowExists
                            ? { text: 'Workflow file', tone: 'ok', detail: data.workflowPath }
                            : { text: 'Workflow file', tone: 'warn', detail: 'not created' }
                    )
                    footer.push({
                        key: 'w',
                        label: data.workflowExists ? 'rewrite workflow' : 'write workflow',
                    })
                }

                if (ready) {
                    rows.push(
                        data.secretSet
                            ? { text: `Secret ${data.secretName}`, tone: 'ok', detail: 'set' }
                            : {
                                  text: `Secret ${data.secretName}`,
                                  tone: 'warn',
                                  detail: data.secretsError || 'not set',
                              }
                    )
                    if (data.providerNote)
                        rows.push({ text: `└ ${data.providerNote}`, tone: 'muted' })
                    rows.push({
                        text: 'Slack / Discord alerts (optional)',
                        tone: data.slackSet || data.discordSet ? 'ok' : 'muted',
                        detail:
                            [data.slackSet ? 'Slack set' : '', data.discordSet ? 'Discord set' : '']
                                .filter(Boolean)
                                .join(', ') || 'not set',
                    })
                    footer.push({ key: 'k', label: 'set API key' })
                    if (data.savedKeyAvailable) footer.push({ key: 'u', label: 'use saved key' })
                    footer.push({ key: 's', label: 'Slack' }, { key: 'i', label: 'Discord' })
                    rows.push({ text: '' })
                    rows.push({
                        text: 'Keys and webhooks are sent to GitHub as repository secrets only when you press k, u, s, or i.',
                        tone: 'muted',
                    })
                }

                rows.push({ text: '' })
                rows.push({ text: 'Next steps', tone: 'heading' })
                rows.push({
                    text: `1. Commit and push .github/workflows/december.yml to ${data.defaultBranch}`,
                    tone: 'normal',
                })
                rows.push({
                    text: '2. Comment "@trydecember <task>" on an issue or pull request',
                    tone: 'normal',
                })
                footer.push({ key: 'r', label: 'refresh' }, { key: 'esc', label: 'close' })

                const report = this.state.report
                if (!report || report.kind !== 'github') return
                report.rows = rows
                report.footer = footer
                report.isLoading = false
                report.subtitle = data.repo
                report.scrollOffset = previousScroll
                report.onKey = (key) => {
                    if (key === 'r') {
                        this.openGithubReport(true)
                        return true
                    }
                    if (key === 'w' && data.inGitRepo) {
                        if (data.workflowExists && !confirmOverwrite) {
                            confirmOverwrite = true
                            this.showToast(
                                'december.yml exists. Press w again to overwrite it.',
                                'info'
                            )
                            return true
                        }
                        run({ type: 'write-workflow', overwrite: data.workflowExists })
                        return true
                    }
                    if (!ready) return false
                    if (key === 'k') {
                        askSecret(data.secretName, `${data.secretName}:`)
                        return true
                    }
                    if (key === 'u' && data.savedKeyAvailable) {
                        run({ type: 'use-saved-key' })
                        return true
                    }
                    if (key === 's') {
                        askSecret('DECEMBER_SLACK_WEBHOOK', 'Slack webhook URL:')
                        return true
                    }
                    if (key === 'i') {
                        askSecret('DECEMBER_DISCORD_WEBHOOK', 'Discord webhook URL:')
                        return true
                    }
                    return false
                }
                this.render()
            })
            .catch((err: any) => {
                this.updateReport('github', {
                    isLoading: false,
                    rows: [
                        { text: 'Could not check the setup', tone: 'fail', detail: err?.message },
                    ],
                })
            })
    }

    /** /hooks: active hooks grouped by event, with their source file. Editing is done in the file. */
    openHooksReport(): void {
        const onLoad = this.options?.onLoadHooks
        this.openReport({
            kind: 'hooks',
            title: 'Hooks',
            rows: [],
            isLoading: true,
            footer: [{ key: 'esc', label: 'close' }],
        })
        if (!onLoad) {
            this.updateReport('hooks', {
                isLoading: false,
                emptyText: 'Hooks are not available in this session.',
            })
            return
        }
        onLoad()
            .then((data) => {
                const rows: ReportRow[] = []
                const events = [
                    'SessionStart',
                    'UserPromptSubmit',
                    'PreToolUse',
                    'PostToolUse',
                    'Stop',
                    'Notification',
                ]
                for (const event of events) {
                    const list = data.hooks.filter((h) => h.event === event)
                    if (list.length === 0) continue
                    if (rows.length > 0) rows.push({ text: '' })
                    rows.push({ text: `${event} (${list.length})`, tone: 'heading' })
                    for (const h of list) {
                        const match =
                            event === 'PreToolUse' || event === 'PostToolUse'
                                ? `${h.matcher && h.matcher !== '*' ? h.matcher : 'all tools'} · `
                                : ''
                        rows.push({
                            text: h.command,
                            detail: `${match}${h.source} · ${h.timeoutSeconds}s`,
                        })
                    }
                }
                if (data.projectSkipped) {
                    if (rows.length > 0) rows.push({ text: '' })
                    rows.push({
                        text: `Project hooks in ${data.projectPath} do not run: this workspace is not trusted.`,
                        tone: 'warn',
                    })
                }
                if (data.problems.length > 0) {
                    if (rows.length > 0) rows.push({ text: '' })
                    rows.push({ text: 'Problems', tone: 'heading' })
                    for (const p of data.problems) rows.push({ text: p, tone: 'fail' })
                }
                rows.push({ text: '' })
                rows.push({
                    text: 'Exit code 2 blocks a tool call or prompt (stderr is the reason). The event is sent as JSON on stdin.',
                    tone: 'muted',
                })

                const openFile = (file: string) => {
                    const onOpenEditor = this.options?.onOpenEditor
                    if (!onOpenEditor) return
                    try {
                        fs.mkdirSync(path.dirname(file), { recursive: true })
                        if (!fs.existsSync(file)) {
                            fs.writeFileSync(file, '{\n    "hooks": {}\n}\n', 'utf-8')
                        }
                    } catch (err: any) {
                        this.showToast(err?.message || String(err), 'error')
                        return
                    }
                    onOpenEditor(file)
                        .then(() =>
                            this.showToast(
                                `Opened ${file}. Changes apply to the next event.`,
                                'info'
                            )
                        )
                        .catch((err: any) => this.showToast(err?.message || String(err), 'error'))
                }

                const report = this.state.report
                if (!report || report.kind !== 'hooks') return
                report.rows = rows
                report.isLoading = false
                report.subtitle = `${data.hooks.length} active`
                report.emptyText = undefined
                report.footer = [
                    { key: '↑/↓', label: 'scroll' },
                    { key: 'p', label: `edit ${data.projectPath}` },
                    { key: 'g', label: `edit ${data.globalPath}` },
                    { key: 'r', label: 'reload' },
                    { key: 'esc', label: 'close' },
                ]
                report.onKey = (key) => {
                    if (key === 'r') {
                        this.openHooksReport()
                        return true
                    }
                    if (key === 'p') {
                        openFile(data.projectFile)
                        return true
                    }
                    if (key === 'g') {
                        openFile(data.globalFile)
                        return true
                    }
                    return false
                }
                if (data.hooks.length === 0 && data.problems.length === 0 && !data.projectSkipped) {
                    report.rows = [{ text: 'No hooks yet.', tone: 'muted' }, { text: '' }, ...rows]
                }
                this.render()
            })
            .catch((err: any) => {
                this.updateReport('hooks', {
                    isLoading: false,
                    rows: [{ text: 'Could not load hooks', tone: 'fail', detail: err?.message }],
                })
            })
    }

    private keymap = new Keymap()
    private keymapMtime = -1
    private keymapCheckedAt = 0

    /** the keymap from keybindings.json, read again (at most once a second) when the file changes */
    private getKeymap(): Keymap {
        const filePath = this.options?.keybindingsPath
        if (!filePath) return this.keymap
        const now = Date.now()
        if (now - this.keymapCheckedAt < 1000) return this.keymap
        this.keymapCheckedAt = now
        let mtime: number
        try {
            mtime = fs.statSync(filePath).mtimeMs
        } catch {
            // Intentionally swallowed: no file means the default keys
            mtime = 0
        }
        if (mtime !== this.keymapMtime) {
            this.keymapMtime = mtime
            this.keymap = mtime ? Keymap.fromFile(filePath) : new Keymap()
            if (this.keymap.problems.length > 0) {
                this.showToast(
                    `keybindings.json: ${this.keymap.problems[0]}${this.keymap.problems.length > 1 ? ` (+${this.keymap.problems.length - 1} more, see /check)` : ''}`,
                    'error'
                )
            }
        }
        return this.keymap
    }

    /** /keybindings: opens keybindings.json, creating it with the default keys first */
    openKeybindingsFile(): void {
        const filePath = this.options?.keybindingsPath
        const onOpenEditor = this.options?.onOpenEditor
        if (!filePath || !onOpenEditor) {
            this.showToast('Keybindings are not available in this session.', 'error')
            return
        }
        try {
            if (!fs.existsSync(filePath)) {
                fs.mkdirSync(path.dirname(filePath), { recursive: true })
                fs.writeFileSync(filePath, defaultKeybindingsFileContent(), 'utf-8')
            }
        } catch (err: any) {
            this.showToast(`Could not create ${filePath}: ${err?.message || err}`, 'error')
            return
        }
        onOpenEditor(filePath)
            .then(() => {
                this.showToast(
                    `Opened ${filePath}. Saved changes apply right away; /help shows the keys in use.`,
                    'info'
                )
            })
            .catch((err: any) => {
                this.showToast(`Could not open ${filePath}: ${err?.message || err}`, 'error')
            })
    }

    /** Opens the shared report overlay. Later changes go through updateReport. */
    openReport(report: Omit<ReportState, 'selectedIndex' | 'scrollOffset'>): void {
        this.state.report = {
            ...report,
            selectedIndex: firstSelectableRow(report.rows),
            scrollOffset: 0,
        }
        this.state.activeOverlay = 'report'
        this.render()
    }

    /** Changes the open report. Ignored when the user closed it or opened another kind. */
    updateReport(kind: ReportState['kind'], patch: Partial<ReportState>): void {
        const report = this.state.report
        if (!report || report.kind !== kind || this.state.activeOverlay !== 'report') return
        Object.assign(report, patch)
        if (patch.rows) {
            const current = report.rows[report.selectedIndex]
            if (!current?.id) report.selectedIndex = firstSelectableRow(report.rows)
            report.selectedIndex = Math.min(
                report.selectedIndex,
                Math.max(0, report.rows.length - 1)
            )
        }
        this.render()
    }

    closeReport(): void {
        this.state.report = null
        this.closeOrPopOverlay()
    }

    private handleReportKey(key: string): void {
        const report = this.state.report
        if (!report) {
            this.state.activeOverlay = 'none'
            this.render()
            return
        }

        // Text input mode
        if (report.input) {
            const input = report.input
            if (key === '\r' || key === '\n') {
                const value = input.value
                report.input = undefined
                this.render()
                input.onSubmit(value)
                return
            }
            if (key === '\x7f' || key === '\b') {
                input.value = input.value.slice(0, -1)
                this.render()
                return
            }
            if (key === '\x15') {
                input.value = ''
                this.render()
                return
            }
            // printable text, including a paste
            const printable = [...key].every((ch) => ch.charCodeAt(0) >= 0x20 && ch !== '\x7f')
            if (printable && key.length > 0) {
                input.value += key
                this.render()
            }
            return
        }

        const viewport = getReportViewportHeight(
            this.screen.rows,
            Boolean(report.tabs?.length),
            false
        )
        const hasSelectable = report.rows.some((r) => r.id)
        const isUp = key === '\x1b[A' || key === 'k'
        const isDown = key === '\x1b[B' || key === 'j'

        if (isUp || isDown) {
            if (hasSelectable) {
                report.selectedIndex = nextSelectableRow(
                    report.rows,
                    report.selectedIndex,
                    isUp ? -1 : 1
                )
                // show the heading above the first selectable row
                const target = isUp ? Math.max(0, report.selectedIndex - 1) : report.selectedIndex
                report.scrollOffset = clampReportScroll(target, report.scrollOffset, viewport)
            } else {
                const maxScroll = Math.max(0, report.rows.length - viewport)
                report.scrollOffset = Math.max(
                    0,
                    Math.min(maxScroll, report.scrollOffset + (isUp ? -1 : 1))
                )
            }
            this.render()
            return
        }

        if (key === '\x1b[5~' || key === '\x1b[6~') {
            const maxScroll = Math.max(0, report.rows.length - viewport)
            const delta = key === '\x1b[5~' ? -viewport : viewport
            report.scrollOffset = Math.max(0, Math.min(maxScroll, report.scrollOffset + delta))
            this.render()
            return
        }

        const row = report.rows[report.selectedIndex]
        const selectedRow = row?.id ? row : undefined

        if (key === '\r' || key === '\n') {
            report.onEnter?.(selectedRow)
            return
        }

        if (report.onKey?.(key, selectedRow)) return

        if (key === 'q') {
            this.closeReport()
        }
    }

    /** Turns plan mode on or off. In plan mode, plain prompts are sent as /plan <prompt>. */
    togglePlanMode(): void {
        this.state.planMode = !this.state.planMode
        this.showToast(
            this.state.planMode
                ? 'Plan mode on. Prompts start a plan for your review (shift+tab to turn off).'
                : 'Plan mode off.',
            'info'
        )
        this.render()
    }

    drainPromptQueue(): boolean {
        if (this.state.isStreaming || this.state.promptQueue.length === 0) {
            return false
        }
        const nextPrompt = this.state.promptQueue.shift()
        if (!nextPrompt) return false

        this.state.messages.push({
            role: 'user',
            content: nextPrompt,
        })
        this.state.scrollOffset = undefined
        this.state.isReadingMode = false
        this.render()

        if (nextPrompt.startsWith('!') && this.onExecuteDirectCommandCallback) {
            const rawCmd = nextPrompt.slice(1).trim()
            this.onExecuteDirectCommandCallback(rawCmd)
        } else if (this.onSubmitCallback) {
            this.onSubmitCallback(nextPrompt)
        }
        return true
    }

    private static readonly APPROVAL_OVERLAYS = new Set([
        'tool_permission',
        'ask_question',
        'plan_approve',
    ])

    /**
     * The activity block (L0) for this frame. `turn` (the activity line and the plan
     * checklist) is drawn at the end of the chat (L20); `queued` stays above the prompt box.
     * Also settles the paused time while an approval prompt is open.
     */
    private getActivityBlock(
        width: number,
        hideHint = false
    ): { turn: FormattedLine[]; queued: FormattedLine[] } {
        const now = Date.now()
        const waiting =
            this.state.isStreaming &&
            DifferentialApp.APPROVAL_OVERLAYS.has(this.state.activeOverlay)
        if (waiting && this.turnPauseStartedAt === undefined) this.turnPauseStartedAt = now
        if (!waiting && this.turnPauseStartedAt !== undefined) {
            this.turnPausedMs += now - this.turnPauseStartedAt
            this.turnPauseStartedAt = undefined
        }
        const locale = process.env.LC_ALL || process.env.LC_CTYPE || process.env.LANG || ''
        return this.activityTracker.getBlock(
            {
                messages: this.state.messages,
                isStreaming: this.state.isStreaming,
                statusMessage: this.state.statusMessage,
                statusSetAt: this.statusSetAt,
                waitingForUser: waiting,
                now,
                turnStartedAt: this.streamStartTime || now,
                pausedMs: this.turnPausedMs,
                pauseStartedAt: this.turnPauseStartedAt,
                lastActivityAt: this.lastStreamActivityAt,
                firstTokenAt: this.firstTokenAt,
                isColdStart: !this.hasReceivedToken,
                tip: this.state.activeTip,
                queued: this.state.promptQueue,
                contextTokens: this.getEffectiveContextTokens(),
                retry: this.retryInfo,
                seededPlan: this.seededPlan?.items,
                hideHint,
                reduceMotion: Boolean(process.env.NO_COLOR || process.env.DECEMBER_REDUCE_MOTION),
                wideAmbiguous: /^(zh|ja|ko)/i.test(locale),
            },
            Math.max(10, width - THEME.padding.paddingLeft - THEME.padding.paddingRight)
        )
    }

    private drawActivityLines(lines: FormattedLine[], y: number, width: number): void {
        const buffer = this.screen.backBuffer
        lines.forEach((line, i) => {
            let x: number = THEME.padding.paddingLeft
            for (const seg of line) {
                const room = width - x
                if (room <= 0) break
                // Clip by terminal columns, so wide characters (CJK, emoji) do not overflow
                x = buffer.write(x, y + i, sliceToWidth(seg.text, room), seg.style).x
            }
        })
    }

    /** Redraws while /btw waits for its first token, so its ✱ breathes (M25, Q8 A) */
    private startBtwLoaderTimer(): void {
        if (this.btwLoaderTimer) return
        this.btwLoaderTimer = setInterval(() => {
            if (this.state.btwState?.status !== 'loading') {
                clearInterval(this.btwLoaderTimer!)
                this.btwLoaderTimer = null
                return
            }
            this.render()
        }, 130)
    }

    /** Records stream or tool activity for the activity line's stall and first-token checks */
    private markStreamActivity(): void {
        const now = Date.now()
        this.lastStreamActivityAt = now
        if (this.firstTokenAt === 0) {
            this.firstTokenAt = now
            if (this.streamStartTime > 0) this.perfStats.ttftMs = now - this.streamStartTime
        }
        this.hasReceivedToken = true
        // Output resumed (text, thinking or a tool), so a retry in progress is over
        this.retryInfo = undefined
    }

    private resetActivityTiming(): void {
        this.activityTracker.reset()
        this.lastStreamActivityAt = 0
        this.firstTokenAt = 0
        this.statusSetAt = 0
        this.turnPausedMs = 0
        this.turnPauseStartedAt = undefined
        this.previewedPaths.clear()
        this.retryInfo = undefined
        this.turnOutputTokens = 0
    }

    /** Adds one model call's output tokens to the current turn (shown in the L16 line) */
    addTurnOutputTokens(tokens: number): void {
        if (Number.isFinite(tokens) && tokens > 0) this.turnOutputTokens += tokens
    }

    scheduleStreamRender(): void {
        this.markStreamActivity()
        const now = performance.now()
        const elapsed = now - this.lastStreamRenderTime

        if (elapsed >= DifferentialApp.STREAM_THROTTLE_MS) {
            if (this.streamRenderTimer) {
                clearTimeout(this.streamRenderTimer)
                this.streamRenderTimer = null
            }
            this.lastStreamRenderTime = now
            this.render()
        } else if (!this.streamRenderTimer) {
            const waitTime = Math.max(1, DifferentialApp.STREAM_THROTTLE_MS - elapsed)
            this.streamRenderTimer = setTimeout(() => {
                this.streamRenderTimer = null
                this.lastStreamRenderTime = performance.now()
                this.render()
            }, waitTime)
        }
    }

    flushStream(): void {
        if (this.streamRenderTimer) {
            clearTimeout(this.streamRenderTimer)
            this.streamRenderTimer = null
        }
        for (let i = this.state.messages.length - 1; i >= 0; i--) {
            const m = this.state.messages[i]
            if (m && m.role === 'thinking' && m.isStreaming) {
                m.isStreaming = false
                if (m.timestamp) {
                    m.durationMs = Math.max(100, Date.now() - m.timestamp)
                }
                break
            }
            if (m && m.role === 'assistant' && m.isStreaming) {
                m.isStreaming = false
            }
        }
        this.render()
    }

    /** #617: the current turn has no error and was not interrupted */
    private turnEndedNormally(): boolean {
        const messages = this.state.messages
        for (let i = messages.length - 1; i >= 0; i--) {
            const m = messages[i]!
            if (m.role === 'user') return true
            if (m.role === 'error') return false
            if (
                m.role === 'assistant' &&
                (m.content || '').includes('Interrupted · What should December do instead?')
            ) {
                return false
            }
        }
        return true
    }

    /** End-of-turn line (L16): only for turns over 10s, or turns that changed files */
    private appendTurnSummary(): void {
        if (!this.streamStartTime) return
        const now = Date.now()
        const paused =
            this.turnPausedMs + (this.turnPauseStartedAt ? now - this.turnPauseStartedAt : 0)
        const durationMs = Math.max(0, now - this.streamStartTime - paused)
        const messages = this.state.messages
        let start = messages.length
        while (start > 0 && messages[start - 1]?.role !== 'user') start--
        const turn = messages.slice(start)
        if (turn.length === 0) return
        // An interrupted turn already ends with the interrupt notice
        if (
            turn.some(
                (m) =>
                    m.role === 'assistant' &&
                    (m.content || '').includes('Interrupted · What should December do instead?')
            )
        )
            return

        const files = new Map<string, { path: string; added: number; removed: number }>()
        let outputTokens = this.turnOutputTokens
        for (const m of turn) {
            if (!this.turnOutputTokens) outputTokens += m.usage?.completionTokens || 0
            if (!m.toolCall || m.toolCall.status === 'error') continue
            const change = toolCallChanges(m.toolCall)
            if (!change || !change.path) continue
            const entry = files.get(change.path) ?? { path: change.path, added: 0, removed: 0 }
            entry.added += change.added
            entry.removed += change.removed
            files.set(change.path, entry)
        }
        if (durationMs <= 10_000 && files.size === 0) return
        messages.push({
            role: 'turn_summary',
            summary: {
                durationMs,
                outputTokens: outputTokens || undefined,
                files: [...files.values()],
            },
        })
    }

    finishStream(): void {
        this.flushStream()
        this.appendTurnSummary()
        if (this.streamStartTime) {
            const now = Date.now()
            this.lastTurnStartedAt = this.streamStartTime
            this.lastTurnEndedAt = now
            // #617: a queued prompt starts the next turn at once, so the user is not needed yet
            if (this.turnEndedNormally() && this.state.promptQueue.length === 0) {
                this.attention.notify('turn_finished', now - this.streamStartTime)
            }
        }
        // The seeded checklist lasts until the turn that carries out the plan ends (F2)
        if (this.seededPlan && this.streamStartTime && this.seededPlan.at <= this.streamStartTime) {
            this.seededPlan = undefined
        }
        this.clearStatusMessage()
        this.stopSpinner()
        this.state.isStreaming = false
        this.flushTaskNotices()
        this.streamStartTime = 0
        this.resetActivityTiming()
        this.state.activeTip = null
        this.refreshUsageStats()
        this.render()
        this.drainPromptQueue()
    }

    handleAbortStream(): void {
        if (this.toolRenderTimer) {
            clearTimeout(this.toolRenderTimer)
            this.toolRenderTimer = null
        }
        this.flushStream()
        this.stopSpinner()
        this.state.isStreaming = false
        this.flushTaskNotices()
        this.streamStartTime = 0
        this.resetActivityTiming()
        this.state.activeTip = null
        this.state.promptQueue = []
        this.clearStatusMessage()
        if (this.onAbortCallback) {
            this.onAbortCallback()
        } else {
            this.applyStreamDelta('\n\nInterrupted · What should December do instead?')
            // The notice is final text, not a live stream: settle it so nothing stays live
            const notice = this.state.messages[this.state.messages.length - 1]
            if (notice) notice.isStreaming = false
            if (this.streamRenderTimer) {
                clearTimeout(this.streamRenderTimer)
                this.streamRenderTimer = null
            }
        }
        this.showToast('Aborted.', 'info')
        this.render()
    }

    appendStreamDelta(delta: string): void {
        if (!delta) return

        // Finalize any in-progress thinking block before streaming answer text
        for (let i = this.state.messages.length - 1; i >= 0; i--) {
            const m = this.state.messages[i]
            if (m && m.role === 'thinking' && m.isStreaming) {
                m.isStreaming = false
                if (m.timestamp) {
                    m.durationMs = Math.max(100, Date.now() - m.timestamp)
                }
                break
            }
        }

        this.applyStreamDelta(delta)
    }

    private applyStreamDelta(delta: string): void {
        if (!delta) return

        const lastMsg = this.state.messages[this.state.messages.length - 1]
        if (lastMsg && lastMsg.role === 'assistant') {
            lastMsg.content = (lastMsg.content || '') + delta
            lastMsg.isStreaming = true
        } else {
            this.state.messages.push({
                role: 'assistant',
                content: delta,
                isStreaming: true,
            })
        }

        if (!this.state.isReadingMode) {
            this.state.scrollOffset = undefined
        }

        this.scheduleStreamRender()
    }

    appendThinkingChunk(chunk: string): void {
        if (!chunk) return

        const lastMsg = this.state.messages[this.state.messages.length - 1]
        if (lastMsg && lastMsg.role === 'thinking' && lastMsg.isStreaming) {
            lastMsg.content = (lastMsg.content || '') + chunk
        } else {
            this.state.messages.push({
                role: 'thinking',
                content: chunk,
                isStreaming: true,
                timestamp: Date.now(),
            })
        }

        if (!this.state.isReadingMode) {
            this.state.scrollOffset = undefined
        }

        this.scheduleStreamRender()
    }

    appendMessage(message: MessageItem): void {
        this.state.messages.push(message)
        this.render()
    }

    appendToolCall(toolCall: {
        id: string
        name: string
        input?: any
        command?: string
        mcpServer?: string
        mcpTool?: string
    }): void {
        // Finalize any in-progress thinking block before tool execution
        for (let i = this.state.messages.length - 1; i >= 0; i--) {
            const m = this.state.messages[i]
            if (m && m.role === 'thinking' && m.isStreaming) {
                m.isStreaming = false
                break
            }
        }

        this.markStreamActivity()
        const fallbackSummary = toolCall.command || `${toolCall.name}()`

        this.state.messages.push({
            role: 'tool',
            toolCall: {
                id: toolCall.id,
                name: toolCall.name,
                input: toolCall.input,
                command: fallbackSummary,
                status: 'running',
                output: '',
                startTime: Date.now(),
                ...(toolCall.mcpServer
                    ? { mcpServer: toolCall.mcpServer, mcpTool: toolCall.mcpTool }
                    : {}),
            },
        })

        if (!this.state.isReadingMode) {
            this.state.scrollOffset = undefined
        }

        this.render()
    }

    updateToolExecution(toolCallId: string, chunk: string): void {
        const msg = this.findToolMessage(toolCallId)
        if (msg && msg.toolCall) {
            this.markStreamActivity()
            const prev = msg.toolCall.output || ''
            if (prev.length > 200_000) {
                msg.toolCall.output = prev.slice(-100_000) + chunk
            } else {
                msg.toolCall.output = prev + chunk
            }

            const now = performance.now()
            const elapsed = now - this.lastToolRenderTime
            if (elapsed >= DifferentialApp.TOOL_THROTTLE_MS) {
                if (this.toolRenderTimer) {
                    clearTimeout(this.toolRenderTimer)
                    this.toolRenderTimer = null
                }
                this.lastToolRenderTime = now
                this.render()
            } else if (!this.toolRenderTimer) {
                const waitTime = Math.max(1, DifferentialApp.TOOL_THROTTLE_MS - elapsed)
                this.toolRenderTimer = setTimeout(() => {
                    this.toolRenderTimer = null
                    this.lastToolRenderTime = performance.now()
                    this.render()
                }, waitTime)
            }
        }
    }

    updateToolResult(
        toolCallId: string,
        result: { output?: string; isError?: boolean; durationMs?: number }
    ): void {
        if (this.toolRenderTimer) {
            clearTimeout(this.toolRenderTimer)
            this.toolRenderTimer = null
        }
        const msg = this.findToolMessage(toolCallId)
        if (msg && msg.toolCall) {
            msg.toolCall.status = result.isError ? 'error' : 'success'
            if (result.output) {
                msg.toolCall.output = result.output
            }
            if (result.durationMs !== undefined) {
                msg.toolCall.durationMs = result.durationMs
            } else if (msg.toolCall.startTime && msg.toolCall.durationMs === undefined) {
                msg.toolCall.durationMs = Date.now() - msg.toolCall.startTime
            }
            if (result.isError && !this.state.isReadingMode) {
                this.state.scrollOffset = undefined
            }
            this.render()
        }
    }

    /** The running tool is almost always near the end, so search from there */
    private findToolMessage(toolCallId: string): MessageItem | undefined {
        const messages = this.state.messages
        for (let i = messages.length - 1; i >= 0; i--) {
            const m = messages[i]!
            if (m.role === 'tool' && m.toolCall?.id === toolCallId) return m
        }
        return undefined
    }

    requestRender(): void {
        this.render()
    }

    /**
     * Older turns may not be laid out yet (virtualized history). Scrolling needs the real
     * line count, so finish the layout and repaint before reading maxScroll.
     */
    private ensureHistoryLaidOut(): void {
        if (this.lineCache.isComplete()) return
        this.lineCache.layoutPending(Number.POSITIVE_INFINITY)
        if (this.isRunning && !this.isDetached) this.paint()
    }

    /** Lays out skipped older turns in small idle slices, so input stays responsive */
    private scheduleHistoryLayout(): void {
        if (this.historyLayoutScheduled) return
        this.historyLayoutScheduled = true
        setImmediate(() => {
            this.historyLayoutScheduled = false
            if (!this.isRunning) return
            const done = this.lineCache.layoutPending(DifferentialApp.HISTORY_LAYOUT_BUDGET_MS)
            // A finished pass changes only the line count (and the header above the oldest
            // turn), which matter once the user scrolls; ensureHistoryLaidOut() covers that
            if (!done) this.scheduleHistoryLayout()
        })
    }

    scrollUp(delta = 1): void {
        this.ensureHistoryLaidOut()
        const current = this.state.scrollOffset ?? this.maxScroll
        const next = Math.max(0, current - delta)
        this.state.scrollOffset = next
        this.state.isReadingMode = next < this.maxScroll
        this.requestRender()
    }

    scrollDown(delta = 1): void {
        this.ensureHistoryLaidOut()
        const current = this.state.scrollOffset ?? this.maxScroll
        const next = Math.min(this.maxScroll, current + delta)
        if (next >= this.maxScroll) {
            this.state.scrollOffset = undefined
            this.state.isReadingMode = false
        } else {
            this.state.scrollOffset = next
            this.state.isReadingMode = true
        }
        this.requestRender()
    }

    /** Line layout depends on width and tool expansion; a change re-anchors the new-lines count. */
    private getScrollLayoutKey(width: number): string {
        return `${width}`
    }

    private getNewLinesAnchor(width: number): number | undefined {
        if (this.state.scrollOffset === undefined || !this.scrollAnchor) return undefined
        if (this.scrollAnchor.layoutKey !== this.getScrollLayoutKey(width)) return undefined
        return this.scrollAnchor.totalLines
    }

    private updateScrollAnchor(width: number, totalLines: number): void {
        if (this.state.scrollOffset === undefined) {
            this.scrollAnchor = null
            return
        }
        const layoutKey = this.getScrollLayoutKey(width)
        if (!this.scrollAnchor || this.scrollAnchor.layoutKey !== layoutKey) {
            this.scrollAnchor = { totalLines, layoutKey }
        }
    }

    scrollToBottom(): void {
        this.state.scrollOffset = undefined
        this.state.isReadingMode = false
        this.requestRender()
    }

    private getHeaderHeight(): number {
        return HeaderView.getHeight({
            width: this.screen.columns,
            cliVersion: this.state.cliVersion,
            latestVersion: this.state.latestVersion,
            announcement: this.state.announcement,
            userEmail: this.state.userEmail,
            activeModel: this.state.activeModel,
            modelLabel: this.state.modelLabel,
            authMethod: this.state.authMethod,
            selectedProvider: this.state.selectedProvider,
            isAuthenticated: this.state.isAuthenticated,
            branch: this.state.branch,
            cwd: this.state.cwd,
        })
    }

    /**
     * Requests a frame. All calls in the same tick are coalesced into one paint, so
     * call sites can mark the UI dirty freely without each one costing a full frame.
     */
    render(): void {
        if (this.isBatchingInput || this.isDetached) return
        this.syncWaitingTitle()

        if (!this.scheduleFrame) {
            this.paint()
            return
        }

        if (this.renderScheduled || !this.isRunning) return
        this.renderScheduled = true
        const scheduleFrame = this.scheduleFrame
        const run = () => {
            this.renderScheduled = false
            if (!this.isRunning) return
            // The terminal has not taken the last frame: paint the latest state once it drains
            if (this.terminal.isBlocked) {
                this.paintOnDrain = true
                this.perfStats.droppedFrames++
                return
            }
            this.terminal.lastWriteMs = 0
            const startedAt = performance.now()
            const bytesBefore = this.terminal.bytesWritten
            this.paint()
            if (this.perfHud) this.recordFrame(performance.now() - startedAt, bytesBefore)
            this.paceNextFrame()
        }
        const wait = this.nextPaintAt - performance.now()
        if (wait > 1) {
            setTimeout(() => scheduleFrame(run), wait)
        } else {
            scheduleFrame(run)
        }
    }

    /**
     * TTY writes block on Linux and macOS until the terminal takes them. When a frame write
     * was slow, wait about as long before the next paint, so frames never queue up behind
     * input on a slow terminal (for example WSL with ConPTY). Fast terminals keep full rate.
     */
    private recordFrame(frameMs: number, bytesBefore: number): void {
        const stats = this.perfStats
        stats.frameMs = frameMs
        stats.avgFrameMs = stats.avgFrameMs ? stats.avgFrameMs * 0.9 + frameMs * 0.1 : frameMs
        stats.maxFrameMs = Math.max(stats.maxFrameMs * 0.995, frameMs)
        stats.frameBytes = this.terminal.bytesWritten - bytesBefore
        if (this.terminal.lastWriteMs > DifferentialApp.SLOW_WRITE_MS) stats.slowWrites++
    }

    /** Sends the back buffer to the terminal, with the performance overlay when enabled */
    private flushFrame(): void {
        if (this.perfHud) {
            const s = this.perfStats
            const ttft = s.ttftMs ? `${(s.ttftMs / 1000).toFixed(2)}s` : '-'
            const text =
                ` frame ${s.frameMs.toFixed(1)}ms avg ${s.avgFrameMs.toFixed(1)} max ${s.maxFrameMs.toFixed(1)}` +
                ` · ${s.frameBytes}B · slow ${s.slowWrites} · drop ${s.droppedFrames} · ttft ${ttft} `
            const x = Math.max(0, this.screen.columns - text.length)
            this.screen.backBuffer.write(x, 0, text.slice(0, this.screen.columns), {
                fg: THEME.colors.muted,
                bg: THEME.colors.surface,
            })
        }
        this.screen.render()
    }

    private paceNextFrame(): void {
        const writeMs = this.terminal.lastWriteMs
        this.nextPaintAt =
            writeMs > DifferentialApp.SLOW_WRITE_MS
                ? performance.now() + Math.min(writeMs, DifferentialApp.MAX_FRAME_DELAY_MS)
                : 0
    }

    private paint(): void {
        const width = this.screen.columns
        const height = this.screen.rows
        this.syncTasksTicker()
        if (this.state.activeOverlay === 'fileview' && this.state.fileViewTaskId) {
            const task = this.state.tasks.find((t) => t.id === this.state.fileViewTaskId)
            if (task) this.state.fileViewPath = getTaskLogTitle(task, this.isTaskLogFollowing())
        }

        this.screen.backBuffer.clear()
        // A panel asks for the real cursor while it draws (G11); start each frame with none
        takePanelCursor()

        const overlay = this.state.activeOverlay
        const isPagerMode =
            overlay === 'fileview' ||
            overlay === 'memory' ||
            (overlay === 'diff' && this.state.isDiffDetailView) ||
            overlay === 'skills' ||
            overlay === 'report' ||
            (overlay === 'mcp' &&
                (this.state.mcpIsDetailView ||
                    this.state.mcpMode === 'detail' ||
                    this.state.mcpMode === 'add_custom'))

        // 1. TRUE 100% FULL SCREEN PAGER MODE (LESS / VIM STYLE)
        // When viewing actual code (fileview / diff detail / memory / skill detail), take over 100% of the screen from row 0 to bottom,
        // replacing even the multi-line brand header. Terminal cursor is hidden.
        if (isPagerMode) {
            this.screen.setCursor(0, 0, false)

            if (overlay === 'fileview') {
                const isCodesearchReturn = this.state.fileViewReturnOverlay === 'codesearch'
                const searchGroups = isCodesearchReturn
                    ? this.state.codeSearchGroups.length > 0
                        ? this.state.codeSearchGroups
                        : groupCodeSearchResults(this.state.codeSearchResults)
                    : []
                FileViewMenuView.render(this.screen.backBuffer, {
                    x: 0,
                    y: 0,
                    width,
                    height,
                    filePath: this.state.fileViewPath,
                    lines: this.state.fileViewLines,
                    cursorLineIndex: this.state.fileViewCursorLine,
                    scrollOffset: this.state.fileViewScrollOffset,
                    isLoading: this.state.fileViewIsLoading,
                    error: this.state.fileViewError,
                    returnOverlay: this.state.fileViewReturnOverlay,
                    searchQuery: this.state.fileViewSearchQuery,
                    matchLines: this.state.fileViewMatchLines,
                    currentMatchIndex: this.state.fileViewCurrentMatchIndex,
                    fileIndex: isCodesearchReturn ? this.state.codeSearchSelectedIndex : undefined,
                    totalFiles: isCodesearchReturn ? searchGroups.length : undefined,
                })
            } else if (overlay === 'diff') {
                const currentDiffFile = this.state.diffFiles[this.state.diffSelectedIndex]
                DiffViewMenuView.render(this.screen.backBuffer, {
                    x: 0,
                    y: 0,
                    width,
                    height,
                    files: this.state.diffFiles,
                    scope: this.state.diffScope,
                    isLoading: this.state.isDiffLoading,
                    selectedFileIndex: this.state.diffSelectedIndex,
                    windowStart: this.state.diffWindowStart,
                    isDetailView: true,
                    isFullFile: this.state.isDiffFullFile,
                    fullContent: currentDiffFile
                        ? this.getDiffFullContent(currentDiffFile.path)
                        : null,
                    detailScrollOffset: this.state.diffScrollOffset,
                    cursorLineIndex: this.state.diffCursorLineIndex,
                })
            } else if (overlay === 'skills') {
                SkillsMenuView.render(this.screen.backBuffer, {
                    x: 0,
                    y: 0,
                    width,
                    height,
                    skill: this.state.skillsDetailSkill,
                    detailLines: this.state.skillsDetailLines,
                    cursorLineIndex: this.state.skillsCursorLine,
                    scrollOffset: this.state.skillsScrollOffset,
                    isLoadingDetail: this.state.skillsDetailLoading,
                    detailError: this.state.skillsDetailError,
                })
            } else if (
                overlay === 'mcp' &&
                (this.state.mcpIsDetailView ||
                    this.state.mcpMode === 'detail' ||
                    this.state.mcpMode === 'add_custom')
            ) {
                McpMenuView.render(this.screen.backBuffer, {
                    x: 0,
                    y: 0,
                    width,
                    height,
                    selectedIndex: this.state.mcpSelectedIndex,
                    windowStart: this.state.mcpWindowStart,
                    servers: this.state.mcpServersList,
                    isDetailView: this.state.mcpIsDetailView,
                    scrollOffset: this.state.mcpScrollOffset,
                    mode: this.state.mcpMode,
                    confirmDeleteName: this.state.mcpConfirmDeleteName,
                    customName: this.state.mcpCustomName,
                    customCommand: this.state.mcpCustomCommand,
                    customScope: this.state.mcpCustomScope,
                    customEager: this.state.mcpCustomEager,
                    customEnv: this.state.mcpCustomEnv,
                    customActiveField: this.state.mcpCustomActiveField,
                })
            } else if (overlay === 'report' && this.state.report) {
                const report = this.state.report
                ReportView.render(this.screen.backBuffer, {
                    x: 0,
                    y: 0,
                    width,
                    height,
                    title: report.title,
                    subtitle: report.subtitle,
                    rows: report.rows,
                    selectedIndex: report.selectedIndex,
                    scrollOffset: report.scrollOffset,
                    isLoading: report.isLoading,
                    loadingText: report.loadingText,
                    emptyText: report.emptyText,
                    tabs: report.tabs,
                    input: report.input,
                    footer: report.footer,
                })
            } else if (overlay === 'memory') {
                MemoryViewMenuView.render(this.screen.backBuffer, {
                    x: 0,
                    y: 0,
                    width,
                    height,
                    file: this.state.memoryFile,
                    cursorLineIndex: this.state.memoryCursorLine,
                    scrollOffset: this.state.memoryScrollOffset,
                    isLoading: this.state.memoryIsLoading,
                    canGoBack: this.state.memoryReturnOverlay !== 'none',
                })
            }
            this.placePanelCursor()
            this.flushFrame()
            return
        }

        // 2. Build Header View props (prepended to scrollable messages in MessageListView)
        const headerProps: HeaderViewProps = {
            width,
            cliVersion: this.state.cliVersion,
            latestVersion: this.state.latestVersion,
            announcement: this.state.announcement,
            userEmail: this.state.userEmail,
            activeModel: this.state.activeModel,
            modelLabel: this.state.modelLabel,
            authMethod: this.state.authMethod,
            selectedProvider: this.state.selectedProvider,
            isAuthenticated: this.state.isAuthenticated,
            branch: this.state.branch,
            cwd: this.state.cwd,
        }

        const isOverlayActive = this.state.activeOverlay !== 'none'

        if (!isOverlayActive) {
            // PROMPT MODE:
            // 2. Input Bar (dynamically scales 4 to 11 rows based on prompt multiline content)
            const inputHeight = InputBarView.getHeight(this.state.input, width)
            const inputY = Math.max(0, height - inputHeight)

            // 3. Compute floating overlay heights
            let fileMenuHeight = 0
            if (
                this.state.isFileAutocompleteVisible &&
                this.state.fileAutocompleteItems.length > 0
            ) {
                fileMenuHeight = FileAutocompleteMenuView.getHeight(
                    this.state.fileAutocompleteItems.length
                )
            }

            let commandMenuHeight = 0
            const isCommandMenuVisible =
                !this.state.isFileAutocompleteVisible &&
                this.state.input.startsWith('/') &&
                !this.state.input.includes(' ')
            if (isCommandMenuVisible) {
                const query = this.state.input.slice(1).trim()
                commandMenuHeight = CommandMenuView.getHeight(query)
            }

            let btwHeight = 0
            if (this.state.btwState) {
                const contentWidth = Math.max(10, width - (THEME.padding.paddingLeft ?? 2) - 4)
                btwHeight = BtwOverlayView.getHeight(this.state.btwState, undefined, contentWidth)
            }

            // 4. Activity block (L0). The activity line and the plan end the chat (L20); queued
            // messages stay above the prompt box and any floating menu, one blank row above it
            const activity = this.getActivityBlock(width)
            const activityLines = activity.queued
            const activityHeight = activityLines.length > 0 ? activityLines.length + 1 : 0

            // 5. Message List View (full height above interactive area)
            // Insert a 1-line separation gap above the interactive area (both floating menus and the prompt box)
            const bottomFloating = Math.max(fileMenuHeight, commandMenuHeight)
            const interactiveGap = height >= 10 ? 1 : 0
            const topOfInteractive =
                inputY - bottomFloating - btwHeight - activityHeight - interactiveGap
            const bodyHeight = Math.max(1, topOfInteractive)

            const { maxScroll, totalLines, complete } = MessageListView.render(
                this.screen.backBuffer,
                {
                    x: 0,
                    y: 0,
                    width,
                    height: bodyHeight,
                    newLinesAnchor: this.getNewLinesAnchor(width),
                    messages: this.state.messages,
                    scrollOffset: this.state.scrollOffset,
                    isStreaming: this.state.isStreaming,
                    headerProps,
                    lineCache: this.lineCache,
                    previewedPaths: this.previewedPaths,
                    virtualize: this.virtualizeHistory,
                    trailingLines: activity.turn,
                }
            )
            this.maxScroll = maxScroll
            this.updateScrollAnchor(width, totalLines)
            if (!complete) this.scheduleHistoryLayout()

            // Clear the 1-row separator line so chat text does not bleed into the gap
            if (interactiveGap > 0 && topOfInteractive >= 0 && topOfInteractive < height) {
                this.screen.backBuffer.clearArea(0, topOfInteractive, width, 1)
            }

            if (activityHeight > 0) {
                const activityY = Math.max(0, inputY - bottomFloating - btwHeight - activityHeight)
                this.screen.backBuffer.clearArea(0, activityY, width, activityHeight)
                this.drawActivityLines(activityLines, activityY, width)
            }

            // 5. Render floating overlays on top of chat area (with clearArea)
            if (this.state.btwState && btwHeight > 0) {
                const btwY = Math.max(0, inputY - bottomFloating - btwHeight)
                this.screen.backBuffer.clearArea(0, btwY, width, btwHeight)
                BtwOverlayView.render(this.screen.backBuffer, {
                    x: 0,
                    y: btwY,
                    width,
                    state: this.state.btwState,
                    scrollOffset: this.state.btwScrollOffset,
                    now: Date.now(),
                })
            }

            if (fileMenuHeight > 0) {
                const fileMenuY = Math.max(0, inputY - fileMenuHeight)
                this.screen.backBuffer.clearArea(0, fileMenuY, width, fileMenuHeight)
                FileAutocompleteMenuView.render(this.screen.backBuffer, {
                    x: 0,
                    y: fileMenuY,
                    width,
                    files: this.state.fileAutocompleteItems,
                    selectedIndex: this.state.fileAutocompleteSelectedIndex,
                    windowStart: this.state.fileAutocompleteWindowStart,
                })
            }

            if (isCommandMenuVisible && commandMenuHeight > 0) {
                const query = this.state.input.slice(1).trim()
                const cmdY = Math.max(0, inputY - commandMenuHeight)
                this.screen.backBuffer.clearArea(0, cmdY, width, commandMenuHeight)
                CommandMenuView.render(this.screen.backBuffer, {
                    x: 0,
                    y: cmdY,
                    width,
                    query,
                    selectedIndex: this.state.commandSelectedIndex,
                    windowStart: this.state.commandWindowStart,
                })
            }

            // 6. Input Bar View
            const cursor = InputBarView.render(this.screen.backBuffer, {
                x: 0,
                y: inputY,
                width,
                input: this.state.input,
                cursorPos: this.state.cursorPos,
                modeTag: this.state.planMode ? 'plan' : undefined,
                isStreaming: this.state.isStreaming,
                // L21: the Esc hint lives here during a turn, not in the activity line
                placeholder: this.state.isStreaming
                    ? 'Type to queue a message · esc to interrupt'
                    : undefined,
                activeModel: this.state.activeModel,
                modelLabel: this.state.modelLabel,
                isAuthenticated: this.state.isAuthenticated,
                isDeepEffort:
                    normalizeReasoningLevel(this.state.thinkingLevel) === 'deep' &&
                    getReasoningSupportType(this.state.activeModel || this.state.modelLabel) ===
                        'controllable',
                authMethod: this.state.authMethod,
                contextTokens: this.getEffectiveContextTokens(),
                maxContextTokens: this.state.maxContextTokens,
                tasksCount: this.state.tasks.length,
                runningTasksCount: this.state.tasks.filter((t) => t.status === 'running').length,
                queuedPromptsCount: this.state.promptQueue.length,
                backgroundStatus: this.getUpdateStatusText(),
                showExitConfirm: this.state.showExitConfirm,
                toast: this.state.toast,
                pendingModelFallback: this.state.pendingModelFallback,
                restartNotice:
                    this.state.pendingRestart && !this.state.pendingRestart.dismissed
                        ? `Updated to v${this.state.pendingRestart.version} · [Enter] restart now · [Esc] later`
                        : undefined,
            })

            // Position terminal cursor in input box
            this.screen.setCursor(cursor.x, cursor.y, cursor.visible)
        } else {
            // OVERLAY MODE: Prompt box is completely HIDDEN! Terminal cursor is HIDDEN!
            this.screen.setCursor(0, 0, false)

            const overlay = this.state.activeOverlay

            // Card/panel overlay: positioned at bottom interactive area taking over prompt space
            let naturalHeight = 11
            if (overlay === 'help') {
                naturalHeight = HelpMenuView.getHeight()
            } else if (overlay === 'context') {
                naturalHeight = ContextMenuView.getHeight()
            } else if (overlay === 'settings') {
                naturalHeight = SettingsMenuView.getHeight(this.state.settings.length)
            } else if (overlay === 'model') {
                naturalHeight = ModelSelectMenuView.getHeight(this.state.models.length)
            } else if (overlay === 'tasks') {
                naturalHeight = TasksModeMenuView.getHeight(this.state.tasks)
            } else if (overlay === 'mcp') {
                naturalHeight = McpMenuView.getHeight(
                    this.state.mcpMode,
                    this.state.mcpServersList.length,
                    this.state.mcpIsDetailView
                )
            } else if (overlay === 'plugin') {
                naturalHeight = PluginMenuView.getHeight({
                    screen: this.state.pluginScreen,
                    list: this.getPluginList(),
                    detailRow: this.findInstalledRow(this.state.pluginDetailKey),
                    detailActions: this.pluginDetailActionLabels(),
                })
            } else if (overlay === 'codesearch') {
                const count =
                    this.state.codeSearchGroups.length > 0
                        ? this.state.codeSearchGroups.length
                        : this.state.codeSearchResults.length
                naturalHeight = CodeSearchMenuView.getHeight(count)
            } else if (overlay === 'diff') {
                naturalHeight = DiffViewMenuView.getHeight(this.state.diffFiles.length)
            } else if (overlay === 'effort') {
                const support = getReasoningSupportType(
                    this.state.activeModel || this.state.modelLabel
                )
                naturalHeight = EffortMenuView.getHeight(support)
            } else if (overlay === 'login') {
                naturalHeight = LoginMenuView.getHeight(this.state.loginConfirmSwitch)
            } else if (overlay === 'session') {
                const filtered = SessionSelectMenuView.getFiltered(
                    this.state.sessions,
                    this.state.sessionSearchQuery
                )
                naturalHeight = SessionSelectMenuView.getHeight(filtered.length)
            } else if (overlay === 'usage') {
                naturalHeight = UsageSelectMenuView.getHeight(this.state.usageOverview, width)
            } else if (overlay === 'rewind') {
                naturalHeight = RewindSelectMenuView.getHeight(this.state.rewindTurns.length)
            } else if (overlay === 'ask_question') {
                const q = this.state.pendingQuestions?.[this.state.currentQuestionIndex]
                naturalHeight = AskQuestionMenuView.getHeight(q?.options?.length || 0)
            } else if (overlay === 'tool_permission') {
                naturalHeight = ToolPermissionMenuView.getHeight(
                    this.state.pendingToolCall?.toolName || '',
                    this.state.pendingToolCall?.diffLines || [],
                    this.state.pendingToolCall?.commandOrTarget
                )
            } else if (overlay === 'plan_approve') {
                naturalHeight = PlanApproveMenuView.getHeight(this.state.pendingPlan?.fullPlan)
            } else if (overlay === 'auth') {
                naturalHeight = AuthMenuView.getHeight(
                    this.state.authViewMode,
                    this.state.authProviders.length
                )
            } else if (overlay === 'switch') {
                naturalHeight = SwitchSelectMenuView.getHeight(this.state.switchItems.length)
            }

            const overlayGap = height >= 12 ? 1 : 0
            const clampedOverlayHeight = Math.min(
                naturalHeight,
                Math.max(5, height - overlayGap - 1)
            )
            const overlayY = Math.max(overlayGap, height - clampedOverlayHeight)
            // L20: during a turn the activity line ends the chat above the panel. An approval
            // prompt shows "Waiting for you" (L10); other panels hide the hint (Esc closes them).
            const isApproval = DifferentialApp.APPROVAL_OVERLAYS.has(overlay)
            const overlayActivity = this.state.isStreaming
                ? this.getActivityBlock(width, !isApproval).turn.slice(0, 1)
                : []
            const chatHeight = Math.max(0, overlayY - overlayGap)

            // Render messages above the overlay card
            if (chatHeight > 0) {
                const { maxScroll, totalLines, complete } = MessageListView.render(
                    this.screen.backBuffer,
                    {
                        x: 0,
                        y: 0,
                        width,
                        height: chatHeight,
                        newLinesAnchor: this.getNewLinesAnchor(width),
                        messages: this.state.messages,
                        scrollOffset: this.state.scrollOffset,
                        isStreaming: this.state.isStreaming,
                        headerProps,
                        lineCache: this.lineCache,
                        previewedPaths: this.previewedPaths,
                        awaitingApproval:
                            this.state.isStreaming &&
                            DifferentialApp.APPROVAL_OVERLAYS.has(overlay),
                        virtualize: this.virtualizeHistory,
                        trailingLines: overlayActivity,
                    }
                )
                this.maxScroll = maxScroll
                this.updateScrollAnchor(width, totalLines)
                if (!complete) this.scheduleHistoryLayout()
            }

            // Clear the 1-line separation gap so no residual chat cells remain in the gap
            const gapY = overlayY - overlayGap
            if (overlayGap > 0 && gapY >= 0) {
                this.screen.backBuffer.clearArea(0, gapY, width, overlayGap)
            }

            // Clear overlay region completely so no residual chat cells remain
            this.screen.backBuffer.clearArea(0, overlayY, width, clampedOverlayHeight)

            // Render the active overlay card
            if (overlay === 'help') {
                HelpMenuView.render(this.screen.backBuffer, {
                    x: 0,
                    y: overlayY,
                    width,
                    height: clampedOverlayHeight,
                    activeTab: this.state.helpActiveTab,
                    cliVersion: this.state.cliVersion,
                    userEmail: this.state.userEmail,
                    activeModel: this.state.activeModel,
                    modelLabel: this.state.modelLabel,
                    authMethod: this.state.authMethod,
                    selectedProvider: this.state.selectedProvider,
                    cwd: this.state.cwd,
                    branch: this.state.branch,
                    sessionId: this.state.sessionId,
                    sessionTitle: this.state.sessionTitle,
                    configPath: this.state.configPath,
                    commands: this.getAllCommands(),
                    cmdSelectedIndex: this.state.helpCmdSelectedIndex,
                    cmdWindowStart: this.state.helpCmdWindowStart,
                    shortcuts: resolveShortcuts(this.keymap),
                    shortcutSelectedIndex: this.state.helpShortcutSelectedIndex,
                    shortcutWindowStart: this.state.helpShortcutWindowStart,
                })
            } else if (overlay === 'context') {
                ContextMenuView.render(this.screen.backBuffer, {
                    x: 0,
                    y: overlayY,
                    width,
                    height: clampedOverlayHeight,
                    activeModel: this.state.activeModel,
                    modelLabel: this.state.modelLabel,
                    contextTokens: this.getEffectiveContextTokens(),
                    maxContextTokens: this.state.maxContextTokens,
                    messageCount: this.state.messages.length,
                    usageStats: this.state.usageStats,
                })
            } else if (overlay === 'settings') {
                SettingsMenuView.render(this.screen.backBuffer, {
                    x: 0,
                    y: overlayY,
                    width,
                    height: clampedOverlayHeight,
                    selectedIndex: this.state.settingsSelectedIndex,
                    settings: this.getSettingsForDisplay(),
                })
            } else if (overlay === 'model') {
                const providerLabel = this.state.selectedProvider
                    ? formatProviderName(this.state.selectedProvider)
                    : undefined
                ModelSelectMenuView.render(this.screen.backBuffer, {
                    x: 0,
                    y: overlayY,
                    width,
                    height: clampedOverlayHeight,
                    models: this.state.models,
                    activeModel: this.state.activeModel,
                    providerName: providerLabel,
                    selectedIndex: this.state.modelSelectedIndex,
                    windowStart: this.state.modelWindowStart,
                    searchQuery: this.state.modelSearchQuery,
                    isSearching: this.state.isModelSearching,
                    confirmSwitch: this.state.modelSwitchConfirm
                        ? {
                              failedValue: this.state.modelSwitchConfirm.failed.value,
                              fallbackLabel: this.state.modelSwitchConfirm.fallback.label,
                          }
                        : null,
                    confirmNoTools: this.state.modelToolsConfirm?.value ?? null,
                    refreshing: this.state.modelRefreshing,
                })
            } else if (overlay === 'tasks') {
                TasksModeMenuView.render(this.screen.backBuffer, {
                    x: 0,
                    y: overlayY,
                    width,
                    height: clampedOverlayHeight,
                    tasks: this.state.tasks,
                    selectedTaskIndex: this.state.tasksSelectedIndex,
                    windowStart: this.state.tasksWindowStart,
                    confirmStop: this.state.tasksConfirmStop,
                })
            } else if (overlay === 'mcp') {
                McpMenuView.render(this.screen.backBuffer, {
                    x: 0,
                    y: overlayY,
                    width,
                    height: clampedOverlayHeight,
                    selectedIndex: this.state.mcpSelectedIndex,
                    windowStart: this.state.mcpWindowStart,
                    servers: this.state.mcpServersList,
                    isDetailView: this.state.mcpIsDetailView,
                    scrollOffset: this.state.mcpScrollOffset,
                    mode: this.state.mcpMode,
                    confirmDeleteName: this.state.mcpConfirmDeleteName,
                    customName: this.state.mcpCustomName,
                    customCommand: this.state.mcpCustomCommand,
                    customScope: this.state.mcpCustomScope,
                    customEager: this.state.mcpCustomEager,
                    customEnv: this.state.mcpCustomEnv,
                    customActiveField: this.state.mcpCustomActiveField,
                })
            } else if (overlay === 'plugin') {
                this.renderPluginOverlay(overlayY, width, clampedOverlayHeight)
            } else if (overlay === 'codesearch') {
                const groups =
                    this.state.codeSearchGroups.length > 0
                        ? this.state.codeSearchGroups
                        : groupCodeSearchResults(this.state.codeSearchResults)
                CodeSearchMenuView.render(this.screen.backBuffer, {
                    x: 0,
                    y: overlayY,
                    width,
                    height: clampedOverlayHeight,
                    query: this.state.codeSearchQuery,
                    results: this.state.codeSearchResults,
                    groups,
                    selectedIndex: this.state.codeSearchSelectedIndex,
                    windowStart: this.state.codeSearchWindowStart,
                })
            } else if (overlay === 'diff') {
                const currentDiffFile = this.state.diffFiles[this.state.diffSelectedIndex]
                DiffViewMenuView.render(this.screen.backBuffer, {
                    x: 0,
                    y: overlayY,
                    width,
                    height: clampedOverlayHeight,
                    files: this.state.diffFiles,
                    scope: this.state.diffScope,
                    isLoading: this.state.isDiffLoading,
                    selectedFileIndex: this.state.diffSelectedIndex,
                    windowStart: this.state.diffWindowStart,
                    isDetailView: this.state.isDiffDetailView,
                    isFullFile: this.state.isDiffFullFile,
                    fullContent: currentDiffFile
                        ? this.getDiffFullContent(currentDiffFile.path)
                        : null,
                    detailScrollOffset: this.state.diffScrollOffset,
                    cursorLineIndex: this.state.diffCursorLineIndex,
                })
            } else if (overlay === 'effort') {
                const support = getReasoningSupportType(
                    this.state.activeModel || this.state.modelLabel
                )
                EffortMenuView.render(this.screen.backBuffer, {
                    x: 0,
                    y: overlayY,
                    width,
                    height: clampedOverlayHeight,
                    modelLabel: this.state.modelLabel || this.state.activeModel,
                    currentLevel: this.state.thinkingLevel,
                    selectedIndex: this.state.effortSelectedIndex,
                    reasoningSupport: support,
                })
            } else if (overlay === 'login') {
                LoginMenuView.render(this.screen.backBuffer, {
                    x: 0,
                    y: overlayY,
                    width,
                    height: clampedOverlayHeight,
                    selectedIndex: this.state.loginSelectedIndex,
                    confirmSwitch: this.state.loginConfirmSwitch,
                    userEmail: this.state.userEmail,
                    decemberEmail: this.state.decemberEmail,
                    hasDecember: this.state.hasDecember,
                    isAuthenticated: this.state.isAuthenticated,
                    authMethod: this.state.authMethod,
                })
            } else if (overlay === 'session') {
                const sessionProps = {
                    x: 0,
                    y: overlayY,
                    width,
                    height: clampedOverlayHeight,
                    sessions: this.state.sessions,
                    selectedIndex: this.state.sessionSelectedIndex,
                    windowStart: this.state.sessionWindowStart,
                    searchQuery: this.state.sessionSearchQuery,
                    isSearching: this.state.isSessionSearching,
                    renameMode: this.state.sessionRenameMode,
                    renameValue: this.state.sessionRenameValue,
                    confirmDeleteId: this.state.sessionConfirmDeleteId,
                }
                SessionSelectMenuView.render(this.screen.backBuffer, sessionProps)
                // G11, M21.2: the real terminal cursor while searching or renaming
                const sessionCursor = SessionSelectMenuView.getCursorPosition(sessionProps)
                if (sessionCursor) this.screen.setCursor(sessionCursor.x, sessionCursor.y, true)
            } else if (overlay === 'usage') {
                UsageSelectMenuView.render(this.screen.backBuffer, {
                    x: 0,
                    y: overlayY,
                    width,
                    height: clampedOverlayHeight,
                    overview: this.state.usageOverview,
                    isLoading: this.state.usageLoading,
                })
            } else if (overlay === 'rewind') {
                RewindSelectMenuView.render(this.screen.backBuffer, {
                    x: 0,
                    y: overlayY,
                    width,
                    height: clampedOverlayHeight,
                    turns: this.state.rewindTurns,
                    selectedIndex: this.state.rewindSelectedIndex,
                    windowStart: this.state.rewindWindowStart,
                    confirming: this.state.rewindConfirming,
                })
            } else if (overlay === 'ask_question') {
                if (this.state.pendingQuestions) {
                    AskQuestionMenuView.render(this.screen.backBuffer, {
                        x: 0,
                        y: overlayY,
                        width,
                        height: clampedOverlayHeight,
                        questions: this.state.pendingQuestions,
                        currentQuestionIndex: this.state.currentQuestionIndex,
                        selectedIndex: this.state.questionSelectedIndex,
                        selectedMultiIndices: this.state.questionSelectedMulti,
                        customText: this.state.questionCustomText,
                    })
                }
            } else if (overlay === 'tool_permission') {
                ToolPermissionMenuView.render(this.screen.backBuffer, {
                    x: 0,
                    y: overlayY,
                    width,
                    height: clampedOverlayHeight,
                    toolName: this.state.pendingToolCall?.toolName || 'tool',
                    toolCommandOrTarget: this.state.pendingToolCall?.commandOrTarget,
                    diffPreviewLines: this.state.pendingToolCall?.diffLines,
                    selectedIndex: this.state.toolPermissionSelectedIndex,
                })
            } else if (overlay === 'plan_approve') {
                PlanApproveMenuView.render(this.screen.backBuffer, {
                    x: 0,
                    y: overlayY,
                    width,
                    height: clampedOverlayHeight,
                    planSummary: this.state.pendingPlan?.summary,
                    planText: this.state.pendingPlan?.fullPlan,
                    selectedIndex: this.state.planApproveSelectedIndex,
                })
            } else if (overlay === 'auth') {
                const currentProviders =
                    this.state.authViewMode === 'subscription'
                        ? SUBSCRIPTION_PROVIDER_ITEMS
                        : this.state.authProviders.length > 0
                          ? this.state.authProviders
                          : BYOK_PROVIDER_ITEMS
                const filtered = AuthMenuView.getFilteredProviders(
                    currentProviders,
                    this.state.authProviderSearchQuery
                )
                const currentSelected = filtered[this.state.authProviderSelectedIndex]
                const providerKeyUrl = currentSelected
                    ? PROVIDER_KEY_URLS[currentSelected.value]
                    : undefined
                const providerKeyNote = currentSelected
                    ? PROVIDER_KEY_NOTES[currentSelected.value]
                    : undefined

                AuthMenuView.render(this.screen.backBuffer, {
                    x: 0,
                    y: overlayY,
                    width,
                    height: clampedOverlayHeight,
                    mode: this.state.authViewMode,
                    userEmail: this.state.userEmail,
                    decemberEmail: this.state.decemberEmail,
                    hasDecember: this.state.hasDecember,
                    isAuthenticated: this.state.isAuthenticated,
                    authMethod: this.state.authMethod,
                    selectedProvider: this.state.selectedProvider,
                    providers: currentProviders,
                    providerSelectedIndex: this.state.authProviderSelectedIndex,
                    providerWindowStart: this.state.authProviderWindowStart,
                    providerSearchQuery: this.state.authProviderSearchQuery,
                    isSearchingProviders: this.state.isSearchingAuthProviders,
                    activeProviderName: currentSelected?.label || this.state.selectedProvider,
                    providerKeyUrl,
                    providerKeyNote,
                    apiKeyInput: this.state.authApiKeyInput,
                    keyError: this.state.authKeyError,
                    keyChecking: this.state.authKeyChecking,
                    menuSelectedIndex: this.state.authMenuSelectedIndex,
                    confirmDeleteValue: this.state.authConfirmDeleteValue,
                    confirmTarget: this.state.authConfirmTarget,
                    configuredSubscriptionValues: this.getConfiguredSubscriptionValues(),
                    configuredProviderValues: this.getConfiguredProviderValues(),
                })
            } else if (overlay === 'switch') {
                SwitchSelectMenuView.render(this.screen.backBuffer, {
                    x: 0,
                    y: overlayY,
                    width,
                    height: clampedOverlayHeight,
                    items: this.state.switchItems,
                    selectedIndex: this.state.switchSelectedIndex,
                    confirmDeleteValue: this.state.switchConfirmDeleteValue,
                })
            }
        }

        this.placePanelCursor()
        // Diff and flush to stdout
        this.flushFrame()
    }

    /** G11: shows the real terminal cursor where a panel's text field asked for it */
    private placePanelCursor(): void {
        const cursor = takePanelCursor()
        if (cursor) this.screen.setCursor(cursor.x, cursor.y, true)
    }
}
