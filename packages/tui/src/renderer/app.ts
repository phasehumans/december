import { exec } from 'node:child_process'
import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'

import { PROVIDER_BILLING_LINKS } from '@december/shared'

import { getAllAvailableCommands } from '../commands/filter-commands'
import {
    UNIFIED_PROVIDER_MENU_ITEMS,
    SUBSCRIPTION_PROVIDER_ITEMS,
    BYOK_PROVIDER_ITEMS,
    PROVIDER_KEY_URLS,
    PROVIDER_KEY_NOTES,
    formatProviderName,
} from '../constants/providers'
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
import { getFileQueryMatch, scoreAndSortFiles, type ScoredFile } from '../utils/fuzzy'

import { DifferentialScreen } from './screen'
import { TerminalController } from './terminal'
import { AskQuestionMenuView, type QuestionItem } from './views/ask-question-menu-view'
import {
    AuthMenuView,
    type AuthViewMode,
    type ProviderItem,
    MAIN_MENU_OPTIONS,
    DEFAULT_AUTH_PROVIDERS,
    AUTH_PROVIDER_WINDOW_SIZE,
} from './views/auth-menu-view'
import {
    BtwOverlayView,
    BTW_MAX_VISIBLE_LINES,
    BTW_EXPANDED_MAX_VISIBLE_LINES,
} from './views/btw-overlay-view'
import { CodeSearchMenuView, CODE_SEARCH_WINDOW_SIZE } from './views/code-search-menu-view'
import { CommandMenuView, WINDOW_SIZE as CMD_WINDOW_SIZE } from './views/command-menu-view'
import { ContextMenuView } from './views/context-menu-view'
import { DiffViewMenuView, DIFF_WINDOW_SIZE } from './views/diff-view-menu-view'
import { EffortMenuView, type ReasoningLevel, REASONING_OPTIONS } from './views/effort-menu-view'
import { FileAutocompleteMenuView, FILE_WINDOW_SIZE } from './views/file-autocomplete-menu-view'
import { FileViewMenuView } from './views/file-view-menu-view'
import { HeaderView } from './views/header-view'
import { HelpMenuView, type HelpTab, SHORTCUTS } from './views/help-menu-view'
import { InputBarView } from './views/input-bar-view'
import { LoginMenuView, LOGIN_OPTIONS } from './views/login-menu-view'
import {
    MemoryViewMenuView,
    MEMORY_CATEGORIES,
    type MemoryTab,
    type MemoryDocument,
    type MemoryDetailsProps,
    type RuleFileViewItem,
} from './views/memory-view-menu-view'
import { MessageListView, type MessageItem } from './views/message-list-view'
import {
    ModelSelectMenuView,
    MODEL_WINDOW_SIZE,
    type ModelItem,
    DEFAULT_MODELS,
} from './views/model-select-menu-view'
import { PlanApproveMenuView, PLAN_APPROVE_OPTIONS } from './views/plan-approve-menu-view'
import {
    RewindSelectMenuView,
    type RewindTurnEntry,
    REWIND_WINDOW_SIZE,
} from './views/rewind-select-menu-view'
import {
    SessionSelectMenuView,
    type SessionItem,
    SESSION_WINDOW_SIZE,
} from './views/session-select-menu-view'
import { SettingsMenuView, type SettingItem } from './views/settings-menu-view'
import { SkillsMenuView, loadWorkspaceSkills, type SkillItem } from './views/skills-menu-view'
import { SwitchSelectMenuView, type SwitchItem } from './views/switch-select-menu-view'
import { TasksModeMenuView, type TaskItem } from './views/tasks-mode-menu-view'
import {
    ToolPermissionMenuView,
    DEFAULT_PERMISSION_OPTIONS,
} from './views/tool-permission-menu-view'
import {
    UsageSelectMenuView,
    calculateUsageCost,
    type UsageStats,
    type DailyUsageEntry,
    type WeeklyStats,
} from './views/usage-select-menu-view'

import type { DifferentialScreenOptions } from './types'
import type { ReleaseAnnouncement } from '../constants/announcements'
import type { BtwState } from '../types'

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

export interface DifferentialAppState {
    input: string
    cursorPos: number
    messages: MessageItem[]
    promptHistory: string[]
    historyIndex: number
    scrollOffset?: number
    isReadingMode: boolean
    isStreaming: boolean
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
    diffFiles: DiffFileEntry[]
    diffSelectedIndex: number
    diffWindowStart: number
    isDiffDetailView: boolean
    diffScrollOffset: number
    diffCursorLineIndex: number
    diffFilePositions: Record<string, { cursorIndex: number; scrollOffset: number }>

    // Tasks view state
    tasks: TaskItem[]
    tasksSelectedIndex: number
    tasksWindowStart: number

    // Settings view state
    settingsSelectedIndex: number
    settings: SettingItem[]

    // Skills view state
    skillsSelectedIndex: number
    skillsWindowStart: number
    skills: SkillItem[]
    skillsSearchQuery: string
    skillsIsSearching: boolean
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
    dailyUsage: DailyUsageEntry[]
    weeklyStats?: WeeklyStats
    balance?: { supported: boolean; balance?: string; currency?: string; error?: string }

    // Memory view state
    memoryTab: MemoryTab
    memoryInitialTab: MemoryTab
    memoryReturnOverlay: OverlayType
    memoryDocuments: MemoryDocument[]
    workspaceMemoryDetails: MemoryDetailsProps | null
    memoryRuleFiles: RuleFileViewItem[]
    memoryActiveDocIndex: number
    memoryCursorLine: number
    memoryScrollOffset: number
    memoryRuleScrollOffset: number
    memorySelectedIndex: number
    isAddingMemory: boolean
    memoryNewEntryText: string
    memoryNewEntryCategoryIndex: number
    memoryIsLoading: boolean

    // Rewind view state
    rewindTurns: RewindTurnEntry[]
    rewindSelectedIndex: number
    rewindWindowStart: number

    // Ask question interactive state
    pendingQuestions: QuestionItem[] | null
    currentQuestionIndex: number
    questionSelectedIndex: number
    questionSelectedMulti: Set<number>

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

    sessionId?: string
    configPath?: string
}

export interface DifferentialAppOptions extends DifferentialScreenOptions {
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
    announcement?: ReleaseAnnouncement | null
    models?: ModelItem[]
    tasks?: TaskItem[]
    skills?: SkillItem[]
    thinkingLevel?: string
    sessionId?: string
    configPath?: string
    onSubmit?: (prompt: string) => void
    onExit?: () => void
    onModelSelect?: (model: ModelItem) => void
    getProviderModels?: (provider: string) => ModelItem[]
    onEffortSelect?: (level: ReasoningLevel) => void
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
    onSessionRename?: (sessionId: string, newName: string) => Promise<void> | void
    onRewindTurn?: (turnIndex: number) => Promise<void> | void
    onOpenBillingPortal?: (url?: string) => void
    sessionRepository?: any
    sessions?: SessionItem[]
    usageStats?: UsageStats
    dailyUsage?: DailyUsageEntry[]
    rewindTurns?: RewindTurnEntry[]
    memoryDocuments?: MemoryDocument[]
    onLoadMemoryDetails?: () => Promise<MemoryDetailsProps | null>
    onLoadProjectRules?: () => Promise<RuleFileViewItem[]>
    onRecordMemory?: (
        text: string,
        category: string
    ) => Promise<{ success: boolean; message: string }>
    onForgetMemory?: (text: string) => Promise<{ success: boolean; message: string }>
    onScaffoldRules?: () => Promise<{ success: boolean; message: string }>
    onOpenEditor?: (filePath: string) => Promise<void>
    workspaceFiles?: string[]
    recentFiles?: Set<string>
    onSaveApiKey?: (provider: string, apiKey: string) => Promise<void> | void
    switchItems?: SwitchItem[]
    onSwitchSelect?: (value: string) => Promise<void> | void
    onDeleteProvider?: (value: string) => Promise<void> | void
    onExecuteDirectCommand?: (command: string) => Promise<void> | void
    onUndo?: () => Promise<void> | void
    authRequiredNotice?: string
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

export const DEFAULT_SETTINGS: SettingItem[] = [
    { id: 'provider', title: 'Active Provider', value: 'Claude' },
    { id: 'model', title: 'Active Model', value: 'Claude 3.5 Sonnet' },
    { id: 'tool_permission', title: 'Tool Permission', value: 'always-proceed' },
    { id: 'pathguard', title: 'PathGuard Protection', value: 'on' },
    { id: 'non_workspace', title: 'Non-Workspace Access', value: 'off' },
    { id: 'thinking_level', title: 'Thinking Level', value: 'auto' },
    { id: 'steering_mode', title: 'Steering Mode', value: 'all' },
    { id: 'follow_up_mode', title: 'Follow-Up Mode', value: 'all' },
]

export class DifferentialApp {
    readonly screen: DifferentialScreen
    readonly terminal: TerminalController
    readonly state: DifferentialAppState
    private options?: DifferentialAppOptions
    private isRunning = false
    private stdinListener?: (chunk: Buffer | string) => void
    private maxScroll = 0
    private exitTimer: any = null
    private toastTimer: any = null
    private onSubmitCallback?: (prompt: string) => void
    private onExitCallback?: () => void
    private onModelSelectCallback?: (model: ModelItem) => void
    private getProviderModelsCallback?: (provider: string) => ModelItem[]
    private onCodeSearchCallback?: (query: string) => Promise<CodeSearchResultItem[]>
    private onOpenCodeSearchResultCallback?: (item: CodeSearchResultItem) => void
    private onInsertContextCallback?: (file: string, line?: number) => void
    private onEffortSelectCallback?: (level: ReasoningLevel) => void
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
    private onSessionRenameCallback?: (sessionId: string, newName: string) => Promise<void> | void
    private onRewindTurnCallback?: (turnIndex: number) => Promise<void> | void
    private onOpenBillingPortalCallback?: (url?: string) => void
    private questionResolveCallback?: (answers: string | string[]) => void
    sessionRepository?: any
    readonly workspaceFiles: string[] = []
    readonly recentFiles: Set<string> = new Set<string>()
    private onSaveApiKeyCallback?: (provider: string, apiKey: string) => Promise<void> | void
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
    private onUndoCallback?: () => Promise<void> | void
    private authRequiredNotice?: string

    constructor(options?: DifferentialAppOptions) {
        this.terminal = options?.terminal ?? new TerminalController()
        this.screen = new DifferentialScreen({
            terminal: this.terminal,
            width: options?.width,
            height: options?.height,
            synchronized: options?.synchronized,
        })

        this.options = options
        this.onSubmitCallback = options?.onSubmit
        this.onExitCallback = options?.onExit
        this.onModelSelectCallback = options?.onModelSelect
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
        this.onRewindTurnCallback = options?.onRewindTurn
        this.onOpenBillingPortalCallback = options?.onOpenBillingPortal
        this.sessionRepository = options?.sessionRepository
        this.onSaveApiKeyCallback = options?.onSaveApiKey
        this.onOpenEditorCallback = options?.onOpenEditor
        this.onExecuteDirectCommandCallback = options?.onExecuteDirectCommand
        this.onUndoCallback = options?.onUndo
        this.authRequiredNotice = options?.authRequiredNotice
        this.workspaceFiles = options?.workspaceFiles ? [...options.workspaceFiles] : []
        this.recentFiles = options?.recentFiles ? new Set(options.recentFiles) : new Set<string>()

        const initialThinking = options?.thinkingLevel || 'auto'
        const initialEffortIdx = REASONING_OPTIONS.findIndex((opt) => opt.value === initialThinking)

        this.state = {
            input: '',
            cursorPos: 0,
            messages: [],
            promptHistory: [],
            historyIndex: -1,
            isReadingMode: false,
            isStreaming: false,
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
            dailyUsage: options?.dailyUsage || [],

            // Memory view state
            memoryTab: 'memory',
            memoryInitialTab: 'memory',
            memoryReturnOverlay: 'none',
            memoryDocuments: options?.memoryDocuments || [],
            workspaceMemoryDetails: null,
            memoryRuleFiles: [],
            memoryActiveDocIndex: 0,
            memoryCursorLine: 0,
            memoryScrollOffset: 0,
            memoryRuleScrollOffset: 0,
            memorySelectedIndex: 0,
            isAddingMemory: false,
            memoryNewEntryText: '',
            memoryNewEntryCategoryIndex: 0,
            memoryIsLoading: false,

            // Rewind view state
            rewindTurns: options?.rewindTurns || [],
            rewindSelectedIndex: 0,
            rewindWindowStart: 0,

            // Ask question interactive state
            pendingQuestions: null,
            currentQuestionIndex: 0,
            questionSelectedIndex: 0,
            questionSelectedMulti: new Set(),

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
            authMenuSelectedIndex: 0,
            authConfirmDeleteValue: null,
            authConfirmTarget: null,

            // File autocomplete dropup state
            fileAutocompleteItems: [],
            fileAutocompleteSelectedIndex: 0,
            fileAutocompleteWindowStart: 0,
            isFileAutocompleteVisible: false,

            sessionId: options?.sessionId,
            configPath: options?.configPath,

            commandSelectedIndex: 0,
            commandWindowStart: 0,

            models: options?.models || DEFAULT_MODELS,
            modelSearchQuery: '',
            modelSelectedIndex: 0,
            modelWindowStart: 0,
            isModelSearching: false,

            diffFiles: [],
            diffSelectedIndex: 0,
            diffWindowStart: 0,
            isDiffDetailView: false,
            diffScrollOffset: 0,
            diffCursorLineIndex: 0,
            diffFilePositions: {},

            tasks: options?.tasks || [],
            tasksSelectedIndex: 0,
            tasksWindowStart: 0,

            settingsSelectedIndex: 0,
            settings: DEFAULT_SETTINGS,

            skillsSelectedIndex: 0,
            skillsWindowStart: 0,
            skills: options?.skills || loadWorkspaceSkills(),
            skillsSearchQuery: '',
            skillsIsSearching: false,
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
        }

        this.refreshModelsForProvider(this.state.selectedProvider)

        this.screen.onResize(() => {
            this.render()
        })
    }

    start(): void {
        if (this.isRunning) return
        this.isRunning = true

        this.screen.start()

        this.stdinListener = (data) => {
            const str = data.toString()
            this.handleKey(str)
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

        if (this.exitTimer) {
            clearTimeout(this.exitTimer)
            this.exitTimer = null
        }
        if (this.toastTimer) {
            clearTimeout(this.toastTimer)
            this.toastTimer = null
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

    getAllCommands(): { name: string; description: string }[] {
        try {
            return getAllAvailableCommands(this.state.cwd || process.cwd())
        } catch {
            return []
        }
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

    async openFileView(
        filePath: string,
        targetLine = 1,
        returnOverlay: OverlayType = 'none',
        searchQuery?: string,
        matchLines?: number[]
    ): Promise<void> {
        this.state.activeOverlay = 'fileview'
        this.state.fileViewPath = filePath
        this.state.fileViewReturnOverlay = returnOverlay
        this.state.fileViewSearchQuery = searchQuery
        this.state.fileViewMatchLines = matchLines || []
        this.state.fileViewIsLoading = true
        this.state.fileViewError = null
        this.state.fileViewLines = []
        const line0 = Math.max(0, targetLine - 1)
        this.state.fileViewCursorLine = line0
        this.state.fileViewScrollOffset = Math.max(0, line0 - 5)

        if (matchLines && matchLines.length > 0) {
            const foundIdx = matchLines.indexOf(targetLine)
            this.state.fileViewCurrentMatchIndex = foundIdx !== -1 ? foundIdx : 0
        } else {
            this.state.fileViewCurrentMatchIndex = 0
        }

        this.render()

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

        const totalTokens = inputTokens + outputTokens
        const cost = calculateUsageCost(
            this.state.activeModel,
            inputTokens,
            outputTokens,
            cacheReadTokens
        )

        this.state.usageStats = {
            requests,
            inputTokens,
            outputTokens,
            cacheReadTokens,
            totalTokens,
            cost,
        }
    }

    async loadUsageTrackerData(): Promise<void> {
        try {
            const configDir =
                process.env.DECEMBER_CONFIG_DIR || path.join(os.homedir(), '.december')
            const usagePath = path.join(configDir, 'usage.json')
            const raw = await fs.promises.readFile(usagePath, 'utf8')
            const parsed = JSON.parse(raw)
            if (parsed && parsed.version === 1 && parsed.days) {
                const now = new Date()
                const items: DailyUsageEntry[] = []
                let inputTokens = 0
                let outputTokens = 0
                let cacheReadTokens = 0
                let requests = 0
                let activeDays = 0
                const modelTokensMap: Record<string, number> = {}

                for (let i = 6; i >= 0; i--) {
                    const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000)
                    const dateKey = d.toISOString().slice(0, 10)
                    const dayName = d.toLocaleDateString('en-US', { weekday: 'short' })
                    const formattedDate = d.toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                    })
                    const day = parsed.days[dateKey]
                    const dayTokens = day ? (day.inputTokens || 0) + (day.outputTokens || 0) : 0

                    if (day && (day.requests > 0 || dayTokens > 0)) {
                        activeDays++
                        inputTokens += day.inputTokens || 0
                        outputTokens += day.outputTokens || 0
                        cacheReadTokens += day.cacheReadTokens || 0
                        requests += day.requests || 0
                        if (day.models) {
                            for (const [modelName, bucket] of Object.entries(
                                day.models as Record<string, any>
                            )) {
                                const modelTotal =
                                    (bucket.inputTokens || 0) + (bucket.outputTokens || 0)
                                modelTokensMap[modelName] =
                                    (modelTokensMap[modelName] || 0) + modelTotal
                            }
                        }
                    }

                    items.push({
                        date: dateKey,
                        dayName,
                        formattedDate,
                        tokens: dayTokens,
                        isToday: i === 0,
                    })
                }

                const totalTokens = inputTokens + outputTokens
                const topModels = Object.entries(modelTokensMap)
                    .map(([model, tokens]) => ({
                        model,
                        totalTokens: tokens,
                        percentage: totalTokens > 0 ? Math.round((tokens / totalTokens) * 100) : 0,
                    }))
                    .sort((a, b) => b.totalTokens - a.totalTokens)

                this.state.dailyUsage = items
                this.state.weeklyStats = {
                    totalTokens,
                    activeDays,
                    topModels,
                }
                this.render()
            }
        } catch {
            // Intentionally swallowed: fallback to generated default daily usage
        }
    }

    async openSkillDetail(skill: SkillItem): Promise<void> {
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

    async openMemoryView(
        initialTab: MemoryTab = 'memory',
        returnOverlay: OverlayType = 'none'
    ): Promise<void> {
        this.state.activeOverlay = 'memory'
        this.state.memoryTab = initialTab
        this.state.memoryInitialTab = initialTab
        this.state.memoryReturnOverlay = returnOverlay
        this.state.memorySelectedIndex = 0
        this.state.memoryScrollOffset = 0
        this.state.memoryCursorLine = 0
        this.state.memoryRuleScrollOffset = 0
        this.state.isAddingMemory = false
        this.state.memoryNewEntryText = ''
        this.state.memoryIsLoading = true
        this.render()

        await this.loadMemoryAndRules()
    }

    async loadMemoryAndRules(): Promise<void> {
        this.state.memoryIsLoading = true
        this.render()
        try {
            if (this.options?.onLoadMemoryDetails) {
                this.state.workspaceMemoryDetails = await this.options.onLoadMemoryDetails()
            }
            if (this.options?.onLoadProjectRules) {
                this.state.memoryRuleFiles = await this.options.onLoadProjectRules()
            }
        } catch {
            // Intentionally swallowed: ignore memory loading error
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
            content: 'Generating December login code...',
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
                    content: `Confirm code: \`${code}\`\nOpen URL: [${fullUrl}](${fullUrl})\n\nWaiting for approval in your browser...`,
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

    refreshModelsForProvider(provider?: string): void {
        const prov = provider || this.state.selectedProvider
        if (this.getProviderModelsCallback && prov) {
            const providerModels = this.getProviderModelsCallback(prov)
            if (providerModels && providerModels.length > 0) {
                this.state.models = providerModels
                return
            }
        }
        if (!this.state.models || this.state.models.length === 0) {
            this.state.models = DEFAULT_MODELS
        }
    }

    async startSubscriptionLogin(provider: string, label?: string): Promise<void> {
        this.state.activeOverlay = 'none'
        const loginFn = this.onSubscriptionLoginCallback
        const displayLabel = label || formatProviderName(provider)

        const msgIndex = this.state.messages.length
        this.state.messages.push({
            role: 'assistant',
            content: `Initiating ${displayLabel} subscription verification...`,
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
                    promptText = `Opening browser to authorize ${displayLabel} subscription...\n(Link copied to clipboard - paste in browser if it did not open automatically)\n\nAuthorization URL:\n${targetUrl}\n\nWaiting for authorization and subscription verification...`
                } else {
                    writeToClipboard(code)
                    promptText = `To authorize ${displayLabel}:\n1. Open: ${targetUrl}\n2. Enter code: \`${code}\` (code copied to clipboard)\n\nWaiting for authorization and subscription verification...`
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
            this.pendingQuestionAnswers = {}
            this.pendingQuestionResolver = resolve
            this.state.activeOverlay = 'ask_question'
            this.render()
        })
    }

    requestToolPermission(call: {
        toolName: string
        commandOrTarget?: string
        diffLines?: string[]
    }): Promise<'approve' | 'always' | 'git_tracked' | 'deny'> {
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
        })
    }

    requestPlanApproval(plan: {
        summary: string
    }): Promise<'approve' | 'refine' | 'view' | 'reject'> {
        return new Promise((resolve) => {
            this.state.pendingPlan = {
                summary: plan.summary,
                resolve,
            }
            this.state.planApproveSelectedIndex = 0
            this.pendingPlanApprovalResolver = resolve
            this.state.activeOverlay = 'plan_approve'
            this.render()
        })
    }

    private submitCurrentQuestionAnswer(answer: string | string[]): void {
        const qList = this.state.pendingQuestions
        if (!qList) return
        const currentQ = qList[this.state.currentQuestionIndex]
        if (!currentQ) return

        this.pendingQuestionAnswers[currentQ.question] = answer

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

    handleKey(key: string): void {
        // Ctrl+C
        if (key === '\x03') {
            if (this.state.isStreaming) {
                this.state.isStreaming = false
                this.showToast('Aborted streaming.', 'info')
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

        // Esc: Close overlay, cancel exit confirm, dismiss btw, or clear input
        if (key === '\x1b') {
            if (this.state.showExitConfirm) {
                this.state.showExitConfirm = false
                this.render()
                return
            }

            if (this.state.btwState) {
                this.state.btwState = null
                this.render()
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

            if (this.state.input.startsWith('/')) {
                this.state.input = ''
                this.state.cursorPos = 0
                this.render()
                return
            }

            if (this.state.isReadingMode) {
                this.scrollToBottom()
                return
            }

            if (this.state.input.length > 0) {
                this.state.input = ''
                this.state.cursorPos = 0
                this.render()
                return
            }
            return
        }

        // Handle Active Overlay Key Events
        if (this.state.activeOverlay !== 'none') {
            this.handleOverlayKey(key)
            return
        }

        // Handle Btw Side Question navigation & copy when active in prompt mode
        if (this.state.btwState) {
            if ((key === 'e' || key === 'E') && this.state.btwState.status !== 'loading') {
                this.state.btwState.isExpanded = !this.state.btwState.isExpanded
                this.render()
                return
            }
            if ((key === 'c' || key === 'C' || key === 'y') && this.state.btwState.answer) {
                writeToClipboard(this.state.btwState.answer)
                this.showToast('Copied answer to clipboard.', 'success')
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
                const pageSize = this.state.btwState.isExpanded
                    ? BTW_EXPANDED_MAX_VISIBLE_LINES
                    : BTW_MAX_VISIBLE_LINES
                this.state.btwScrollOffset = Math.max(0, this.state.btwScrollOffset - pageSize)
                this.render()
                return
            }
            if (key === '\x1b[6~') {
                const pageSize = this.state.btwState.isExpanded
                    ? BTW_EXPANDED_MAX_VISIBLE_LINES
                    : BTW_MAX_VISIBLE_LINES
                this.state.btwScrollOffset += pageSize
                this.render()
                return
            }
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

        // Arrow Up: Prompt history or scroll message history
        if (key === '\x1b[A') {
            if (!this.state.input && this.state.messages.length > 0) {
                this.scrollUp(1)
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

        // Arrow Down: Prompt history or scroll message history
        if (key === '\x1b[B') {
            if (!this.state.input && this.state.messages.length > 0) {
                this.scrollDown(1)
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

        // Page Up: \x1b[5~
        if (key === '\x1b[5~') {
            this.scrollUp(5)
            return
        }

        // Page Down: \x1b[6~
        if (key === '\x1b[6~') {
            this.scrollDown(5)
            return
        }

        // Enter: Submit prompt or execute slash command
        if (key === '\r' || key === '\n') {
            const trimmed = this.state.input.trim()
            if (trimmed) {
                if (trimmed.startsWith('/')) {
                    this.executeCommand(trimmed.slice(1))
                } else {
                    this.submitPrompt()
                }
            }
            return
        }

        // Backspace: \x7f or \b
        if (key === '\x7f' || key === '\b') {
            if (this.state.cursorPos > 0) {
                const before = this.state.input.slice(0, this.state.cursorPos - 1)
                const after = this.state.input.slice(this.state.cursorPos)
                this.state.input = before + after
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
                this.showToast('Usage: /plan <goal> (e.g. /plan refactor authentication)', 'info')
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

        if (cmd === 'exit') {
            if (this.onExitCallback) {
                this.onExitCallback()
            } else {
                this.stop()
                process.exit(0)
            }
            return
        }

        if (cmd === 'clear') {
            this.state.messages = []
            this.showToast('Cleared conversation history.', 'success')
            return
        }

        if (cmd === 'new') {
            this.state.messages = []
            this.showToast('Started a new conversation.', 'success')
            return
        }

        if (cmd === 'fork') {
            this.showToast('Forked conversation into a new branch.', 'success')
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
            const url = 'https://trydecember.com/docs/changelog'
            openBrowserUrl(url)
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
            const url = 'https://github.com/phasehumans/december/issues/new'
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
            if (args) {
                const normalized = (
                    args === 'minimal' ? 'low' : args
                ).toLowerCase() as ReasoningLevel
                if (['auto', 'off', 'low', 'medium', 'high'].includes(normalized)) {
                    this.state.thinkingLevel = normalized
                    const idx = REASONING_OPTIONS.findIndex((opt) => opt.value === normalized)
                    if (idx >= 0) this.state.effortSelectedIndex = idx
                    const setting = this.state.settings.find((s) => s.id === 'thinking_level')
                    if (setting) setting.value = normalized
                    if (this.onEffortSelectCallback) {
                        this.onEffortSelectCallback(normalized)
                    }
                    const label = normalized.charAt(0).toUpperCase() + normalized.slice(1)
                    this.showToast(`Reasoning set to ${label}.`, 'success')
                    return
                } else {
                    this.showToast(
                        'Invalid reasoning level. Valid options: auto, off, low, medium, high',
                        'error'
                    )
                    return
                }
            }

            this.state.activeOverlay = 'effort'
            const idx = REASONING_OPTIONS.findIndex((opt) => opt.value === this.state.thinkingLevel)
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
            this.render()
            return
        }

        if (cmd === 'skills' || cmd === 'skill' || cmd === 'skills list') {
            this.state.activeOverlay = 'skills'
            this.state.skillsSelectedIndex = 0
            this.state.skillsWindowStart = 0
            if (!this.state.skills || this.state.skills.length === 0) {
                this.state.skills = loadWorkspaceSkills()
            }
            this.state.skillsSearchQuery = ''
            this.state.skillsIsSearching = false
            this.state.skillsIsDetailView = false
            this.state.skillsDetailContent = null
            this.state.skillsDetailLines = []
            this.state.skillsDetailLoading = false
            this.state.skillsDetailError = null
            this.state.skillsCursorLine = 0
            this.state.skillsScrollOffset = 0
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
            this.state.diffScrollOffset = 0
            this.state.diffSelectedIndex = 0
            this.state.diffWindowStart = 0
            this.state.diffCursorLineIndex = 0
            fetchGitStatusFiles()
                .then((files) => {
                    this.state.diffFiles = files
                    this.render()
                })
                .catch(() => {
                    // Intentionally swallowed: ignore background git fetch failure
                })
            this.render()
            return
        }

        if (cmd === 'tasks') {
            this.state.activeOverlay = 'tasks'
            this.state.tasksSelectedIndex = 0
            this.state.tasksWindowStart = 0
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
            this.refreshUsageStats()
            this.loadUsageTrackerData().catch(() => {
                // Intentionally swallowed: ignore usage tracker load failure
            })
            this.render()
            return
        }

        if (cmd === 'memory' || cmd === 'rules') {
            const returnOverlay =
                this.state.activeOverlay !== 'none' ? this.state.activeOverlay : 'none'
            this.openMemoryView(cmd === 'rules' ? 'rules' : 'memory', returnOverlay).catch(() => {
                // Intentionally swallowed: openMemoryView error
            })
            return
        }

        if (cmd === 'undo') {
            if (this.onUndoCallback) {
                this.onUndoCallback()
            } else {
                this.state.activeOverlay = 'rewind'
                this.state.rewindSelectedIndex = 0
                this.state.rewindWindowStart = 0
                this.render()
            }
            return
        }

        if (cmd === 'rewind') {
            this.state.activeOverlay = 'rewind'
            this.state.rewindSelectedIndex = 0
            this.state.rewindWindowStart = 0
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
                this.showToast(`File not found: ${targetPath}`, 'error')
                return
            }

            this.openFileView(targetPath, targetLine, 'none')
            return
        }

        if (cmd === 'codesearch') {
            if (!args) {
                this.showToast('Usage: /codesearch <query>', 'info')
                return
            }
            this.showToast(`Searching for "${args}"...`, 'info')
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
            }
            this.state.btwScrollOffset = 0
            this.render()

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
                            `• Answers can be scrolled using the arrow keys or j/k navigation.`,
                            `• Press "e" to toggle expand mode for viewing longer technical responses.`,
                            `• Press "c" to copy the answer to your clipboard.`,
                        ].join('\n')
                        this.render()
                    }
                }, 100)
            }
            return
        }

        // Check if command matches an installed skill (e.g. /skill:tdd or /tdd [args])
        const skills = this.state.skills.length > 0 ? this.state.skills : loadWorkspaceSkills()
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
            }
        }

        const nextIdx = (this.state.diffSelectedIndex + delta + files.length) % files.length
        this.state.diffSelectedIndex = nextIdx

        const nextFile = files[nextIdx]
        const saved = nextFile ? this.state.diffFilePositions[nextFile.path] : null
        if (saved) {
            this.state.diffCursorLineIndex = saved.cursorIndex
            this.state.diffScrollOffset = saved.scrollOffset
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

    closeOrPopOverlay(): void {
        if (this.state.overlayHistory && this.state.overlayHistory.length > 0) {
            this.state.activeOverlay = this.state.overlayHistory.pop()!
        } else {
            this.state.activeOverlay = 'none'
        }
        this.render()
    }

    private handleOverlayEsc(): void {
        const overlay = this.state.activeOverlay

        if (overlay === 'diff') {
            if (this.state.isDiffDetailView) {
                const currentFile = this.state.diffFiles[this.state.diffSelectedIndex]
                if (currentFile) {
                    this.state.diffFilePositions[currentFile.path] = {
                        cursorIndex: this.state.diffCursorLineIndex,
                        scrollOffset: this.state.diffScrollOffset,
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
            if (this.state.skillsIsSearching) {
                this.state.skillsIsSearching = false
                this.render()
                return
            }
            if (this.state.skillsIsDetailView) {
                this.state.skillsIsDetailView = false
                this.render()
                return
            }
            if (this.state.skillsSearchQuery) {
                this.state.skillsSearchQuery = ''
                this.state.skillsSelectedIndex = 0
                this.state.skillsWindowStart = 0
                this.render()
                return
            }
            this.closeOrPopOverlay()
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
            if (this.state.isAddingMemory) {
                this.state.isAddingMemory = false
                this.state.memoryNewEntryText = ''
                this.render()
                return
            }
            if (this.state.memoryTab === 'rules' && this.state.memoryInitialTab === 'memory') {
                this.state.memoryTab = 'memory'
                this.render()
                return
            }
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
                    if (this.state.helpShortcutSelectedIndex < SHORTCUTS.length - 1) {
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
                    this.state.thinkingLevel = selected.value
                    const setting = this.state.settings.find((s) => s.id === 'thinking_level')
                    if (setting) setting.value = selected.value
                    if (this.onEffortSelectCallback) {
                        this.onEffortSelectCallback(selected.value)
                    }
                    this.state.activeOverlay = 'none'
                    this.showToast(`Reasoning set to ${selected.label}.`, 'success')
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
                    if (current.id === 'model' || current.id === 'provider') {
                        this.state.overlayHistory.push('settings')
                        this.state.activeOverlay = 'model'
                        this.render()
                        return
                    }
                    if (current.id === 'thinking_level') {
                        this.state.overlayHistory.push('settings')
                        this.state.activeOverlay = 'effort'
                        const idx = REASONING_OPTIONS.findIndex(
                            (opt) => opt.value === this.state.thinkingLevel
                        )
                        this.state.effortSelectedIndex = idx >= 0 ? idx : 0
                        this.render()
                        return
                    }
                    if (current.value === 'on') current.value = 'off'
                    else if (current.value === 'off') current.value = 'on'
                    else if (current.value === 'always-proceed') current.value = 'always-ask'
                    else if (current.value === 'always-ask') current.value = 'always-proceed'
                    this.showToast(`Updated ${current.title}: [${current.value}]`, 'success')
                }
                return
            }
            return
        }

        if (overlay === 'context') {
            if (key === 'c' || key === 'C') {
                this.state.messages = []
                this.state.activeOverlay = 'none'
                this.showToast('Cleared context history.', 'success')
                return
            }
            if (key === 'm' || key === 'M') {
                this.state.overlayHistory.push('context')
                this.state.activeOverlay = 'model'
                this.state.modelSearchQuery = ''
                this.state.modelSelectedIndex = 0
                this.state.modelWindowStart = 0
                this.render()
                return
            }
            if (key === 'n' || key === 'N') {
                this.state.messages = []
                this.state.activeOverlay = 'none'
                this.showToast('Started a new conversation.', 'success')
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

            // Enter / Tab / c: insert context into prompt and return to prompt mode
            if (key === '\r' || key === '\n' || key === '\t' || key === 'c' || key === 'C') {
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
            const query = (this.state.skillsSearchQuery || '').toLowerCase().trim()
            const skills = query
                ? this.state.skills.filter(
                      (s) =>
                          s.name.toLowerCase().includes(query) ||
                          (s.description || '').toLowerCase().includes(query)
                  )
                : this.state.skills

            // 1. Searching mode (inline search query typing)
            if (this.state.skillsIsSearching) {
                if (key === '\r' || key === '\n') {
                    this.state.skillsIsSearching = false
                    this.render()
                    return
                }
                if (key === '\x1b') {
                    this.state.skillsIsSearching = false
                    this.state.skillsSearchQuery = ''
                    this.state.skillsSelectedIndex = 0
                    this.state.skillsWindowStart = 0
                    this.render()
                    return
                }
                if (key === '\x7f' || key === '\b') {
                    this.state.skillsSearchQuery = this.state.skillsSearchQuery.slice(0, -1)
                    this.state.skillsSelectedIndex = 0
                    this.state.skillsWindowStart = 0
                    this.render()
                    return
                }
                if (key.length === 1 && key >= ' ') {
                    this.state.skillsSearchQuery += key
                    this.state.skillsSelectedIndex = 0
                    this.state.skillsWindowStart = 0
                    this.render()
                    return
                }
                return
            }

            // 2. Detail View (SKILL.md documentation reader)
            if (this.state.skillsIsDetailView) {
                const totalLines = this.state.skillsDetailLines.length
                const visibleLineCount = Math.max(5, this.screen.height - 4)

                if (key === '\x1b' || key === 'q' || key === 'Q') {
                    this.state.skillsIsDetailView = false
                    this.render()
                    return
                }

                if (key === ' ' || key === '\t') {
                    const currentSkill = skills[this.state.skillsSelectedIndex]
                    if (currentSkill) {
                        this.state.activeOverlay = 'none'
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

            // 3. List Mode
            if (key === '/') {
                this.state.skillsIsSearching = true
                this.render()
                return
            }

            if (key === '\r' || key === '\n') {
                const currentSkill = skills[this.state.skillsSelectedIndex]
                if (currentSkill) {
                    this.openSkillDetail(currentSkill).catch(() => {
                        // Intentionally swallowed: skill detail load failure
                    })
                }
                return
            }

            if (key === ' ' || key === '\t') {
                const currentSkill = skills[this.state.skillsSelectedIndex]
                if (currentSkill) {
                    this.state.activeOverlay = 'none'
                    this.state.input = `/${currentSkill.name} `
                    this.state.cursorPos = this.state.input.length
                    this.showToast(`Selected skill /${currentSkill.name}`, 'info')
                    this.render()
                }
                return
            }

            if (key === '\x1b') {
                if (this.state.skillsSearchQuery) {
                    this.state.skillsSearchQuery = ''
                    this.state.skillsSelectedIndex = 0
                    this.state.skillsWindowStart = 0
                    this.render()
                    return
                }
                this.state.activeOverlay = 'none'
                this.render()
                return
            }

            if (key === '\x1b[A' || key === 'k') {
                if (this.state.skillsSelectedIndex > 0) {
                    this.state.skillsSelectedIndex -= 1
                    if (this.state.skillsSelectedIndex < this.state.skillsWindowStart) {
                        this.state.skillsWindowStart = this.state.skillsSelectedIndex
                    }
                    this.render()
                }
                return
            }

            if (key === '\x1b[B' || key === 'j') {
                if (this.state.skillsSelectedIndex < skills.length - 1) {
                    this.state.skillsSelectedIndex += 1
                    if (this.state.skillsSelectedIndex >= this.state.skillsWindowStart + 6) {
                        this.state.skillsWindowStart = this.state.skillsSelectedIndex - 5
                    }
                    this.render()
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

        if (overlay === 'model') {
            const models = this.state.models.length > 0 ? this.state.models : DEFAULT_MODELS
            const filtered = ModelSelectMenuView.getFilteredModels(
                models,
                this.state.modelSearchQuery
            )

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
                if (selected) {
                    this.state.activeModel = selected.value
                    this.state.modelLabel = selected.label
                    this.state.activeOverlay = 'none'
                    this.showToast(`Switched active model to ${selected.label}.`, 'success')
                    if (this.onModelSelectCallback) {
                        this.onModelSelectCallback(selected)
                    }
                }
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
                    const parsed = parseUnifiedDiffToRows(currentFile.diff || '')
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
                    } else {
                        this.state.diffScrollOffset = 0
                        this.state.diffCursorLineIndex = 0
                    }
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
            if (key === '\x1b[A') {
                if (this.state.tasksSelectedIndex > 0) {
                    this.state.tasksSelectedIndex -= 1
                    this.render()
                }
                return
            }
            if (key === '\x1b[B' || key === 'j') {
                if (this.state.tasksSelectedIndex < tasks.length - 1) {
                    this.state.tasksSelectedIndex += 1
                    this.render()
                }
                return
            }
            if (key === 'k' || key === 'K') {
                const currentTask = tasks[this.state.tasksSelectedIndex]
                if (currentTask && currentTask.status === 'running') {
                    currentTask.status = 'failed'
                    this.showToast(`Killed task: ${currentTask.command}`, 'info')
                }
                return
            }
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
                    this.showToast(`Deleted session ${idToDelete}.`, 'info')
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
                        const rawNewName = this.state.sessionRenameValue.trim().replace(/\//g, '-')
                        if (rawNewName && rawNewName !== cur.id) {
                            const oldId = cur.id
                            cur.id = rawNewName
                            cur.preview = rawNewName
                            if (this.onSessionRenameCallback) {
                                this.onSessionRenameCallback(oldId, rawNewName)
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
                    this.state.sessionRenameValue = cur.preview || cur.id
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
            if (key === 'b' || key === 'B' || key === 'p' || key === 'P') {
                const providerKey = (this.state.selectedProvider || 'google').toLowerCase()
                const url =
                    PROVIDER_BILLING_LINKS[providerKey] ||
                    'https://trydecember.com/settings/billing'
                if (this.onOpenBillingPortalCallback) {
                    this.onOpenBillingPortalCallback(url)
                } else {
                    openBrowserUrl(url)
                }
                this.showToast(`Opening ${providerKey} billing portal in browser...`, 'info')
                return
            }
            if (key === 'm' || key === 'M') {
                this.state.overlayHistory.push('usage')
                this.state.activeOverlay = 'model'
                this.state.modelSelectedIndex = 0
                this.state.modelWindowStart = 0
                this.state.modelSearchQuery = ''
                this.state.isModelSearching = false
                this.render()
                return
            }
            if (key === 'r' || key === 'R') {
                this.refreshUsageStats()
                this.loadUsageTrackerData().catch(() => {
                    // Intentionally swallowed: ignore usage tracker load failure
                })
                this.showToast('Usage statistics refreshed', 'info')
                this.render()
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
                const turn = turns[this.state.rewindSelectedIndex]
                if (turn) {
                    this.state.activeOverlay = 'none'
                    if (this.onRewindTurnCallback) {
                        this.onRewindTurnCallback(turn.turnIndex)
                    }
                    this.showToast(
                        `Rewound conversation to checkpoint ${turn.turnIndex}.`,
                        'success'
                    )
                }
                return
            }
            if (key === 'q' || key === 'Q') {
                this.state.activeOverlay = 'none'
                this.render()
                return
            }
            return
        }

        if (overlay === 'memory') {
            if (this.state.isAddingMemory) {
                if (key === '\t') {
                    this.state.memoryNewEntryCategoryIndex =
                        (this.state.memoryNewEntryCategoryIndex + 1) % MEMORY_CATEGORIES.length
                    this.render()
                    return
                }
                if (key === '\r' || key === '\n') {
                    const text = this.state.memoryNewEntryText.trim()
                    const category =
                        MEMORY_CATEGORIES[this.state.memoryNewEntryCategoryIndex] || 'general'
                    if (text && this.options?.onRecordMemory) {
                        this.options
                            .onRecordMemory(text, category)
                            .then(async (res) => {
                                if (res.success) {
                                    this.showToast(
                                        `Saved to memory under "${category}".`,
                                        'success'
                                    )
                                    await this.loadMemoryAndRules()
                                } else {
                                    this.showToast(res.message || 'Failed to save entry.', 'error')
                                }
                            })
                            .catch(() => {
                                // Intentionally swallowed: ignore save error
                            })
                    }
                    this.state.isAddingMemory = false
                    this.state.memoryNewEntryText = ''
                    this.render()
                    return
                }
                if (key === '\x7f' || key === '\b' || key === '\x08') {
                    if (this.state.memoryNewEntryText.length > 0) {
                        this.state.memoryNewEntryText = this.state.memoryNewEntryText.slice(0, -1)
                        this.render()
                    }
                    return
                }
                if (key.length === 1 && key >= ' ') {
                    this.state.memoryNewEntryText += key
                    this.render()
                    return
                }
                return
            }

            // Tab navigation: toggle between memory and rules
            if (key === '\t' || key === '\x1b[C' || key === '\x1b[D') {
                this.state.memoryTab = this.state.memoryTab === 'rules' ? 'memory' : 'rules'
                this.state.memoryActiveDocIndex = 0
                this.state.memoryCursorLine = 0
                this.state.memoryRuleScrollOffset = 0
                this.render()
                return
            }

            // Switch rule document in rules tab
            if (key === '[' || key === ']') {
                const rulesCount = this.state.memoryRuleFiles.length
                if (this.state.memoryTab === 'rules' && rulesCount > 0) {
                    const delta = key === '[' ? -1 : 1
                    this.state.memoryActiveDocIndex =
                        (this.state.memoryActiveDocIndex + delta + rulesCount) % rulesCount
                    this.state.memoryCursorLine = 0
                    this.state.memoryRuleScrollOffset = 0
                    this.render()
                }
                return
            }

            // Arrow Up / k
            if (key === '\x1b[A' || key === 'k') {
                if (this.state.memoryTab === 'memory') {
                    if (this.state.memorySelectedIndex > 0) {
                        this.state.memorySelectedIndex -= 1
                        if (this.state.memorySelectedIndex < this.state.memoryScrollOffset) {
                            this.state.memoryScrollOffset = this.state.memorySelectedIndex
                        }
                        this.render()
                    }
                } else {
                    if (this.state.memoryCursorLine > 0) {
                        this.state.memoryCursorLine -= 1
                        if (this.state.memoryCursorLine < this.state.memoryRuleScrollOffset) {
                            this.state.memoryRuleScrollOffset = this.state.memoryCursorLine
                        }
                        this.render()
                    }
                }
                return
            }

            // Arrow Down / j
            if (key === '\x1b[B' || key === 'j') {
                const visibleRows = Math.max(5, this.screen.height - 6)
                if (this.state.memoryTab === 'memory') {
                    const entries = this.state.workspaceMemoryDetails?.entries || []
                    if (this.state.memorySelectedIndex < entries.length - 1) {
                        this.state.memorySelectedIndex += 1
                        if (
                            this.state.memorySelectedIndex >=
                            this.state.memoryScrollOffset + visibleRows
                        ) {
                            this.state.memoryScrollOffset =
                                this.state.memorySelectedIndex - visibleRows + 1
                        }
                        this.render()
                    }
                } else {
                    const activeRule = this.state.memoryRuleFiles[this.state.memoryActiveDocIndex]
                    const totalLines = activeRule ? activeRule.content.split('\n').length : 0
                    if (this.state.memoryCursorLine < totalLines - 1) {
                        this.state.memoryCursorLine += 1
                        if (
                            this.state.memoryCursorLine >=
                            this.state.memoryRuleScrollOffset + visibleRows
                        ) {
                            this.state.memoryRuleScrollOffset =
                                this.state.memoryCursorLine - visibleRows + 1
                        }
                        this.render()
                    }
                }
                return
            }

            // [a]: Add new memory entry
            if (key === 'a' || key === 'A') {
                if (this.state.memoryTab === 'memory') {
                    this.state.isAddingMemory = true
                    this.state.memoryNewEntryText = ''
                    this.render()
                }
                return
            }

            // [d]: Forget selected memory entry
            if (key === 'd' || key === 'D') {
                if (this.state.memoryTab === 'memory') {
                    const entries = this.state.workspaceMemoryDetails?.entries || []
                    const selectedItem = entries[this.state.memorySelectedIndex]
                    if (selectedItem && this.options?.onForgetMemory) {
                        this.options
                            .onForgetMemory(selectedItem.text)
                            .then(async (res) => {
                                if (res.success) {
                                    this.showToast('Removed entry from memory.', 'success')
                                    await this.loadMemoryAndRules()
                                    const newLen =
                                        this.state.workspaceMemoryDetails?.entries?.length || 0
                                    if (this.state.memorySelectedIndex >= newLen) {
                                        this.state.memorySelectedIndex = Math.max(0, newLen - 1)
                                    }
                                } else {
                                    this.showToast(
                                        res.message || 'Failed to remove entry.',
                                        'error'
                                    )
                                }
                            })
                            .catch(() => {
                                // Intentionally swallowed: ignore forget error
                            })
                    }
                }
                return
            }

            // [c]: Scaffold starter AGENTS.md
            if (key === 'c' || key === 'C') {
                if (this.state.memoryTab === 'rules' && this.options?.onScaffoldRules) {
                    this.options
                        .onScaffoldRules()
                        .then(async (res) => {
                            if (res.success) {
                                this.showToast('Created starter AGENTS.md.', 'success')
                                await this.loadMemoryAndRules()
                            }
                        })
                        .catch(() => {
                            // Intentionally swallowed: ignore scaffold error
                        })
                }
                return
            }

            // [q]: Back / close memory viewer
            if (key === 'q' || key === 'Q') {
                if (this.state.memoryTab === 'rules' && this.state.memoryInitialTab === 'memory') {
                    this.state.memoryTab = 'memory'
                    this.render()
                    return
                }
                this.state.activeOverlay = this.state.memoryReturnOverlay || 'none'
                this.render()
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

            if (key === '\x1b[A' || key === 'k') {
                if (this.state.questionSelectedIndex > 0) {
                    this.state.questionSelectedIndex -= 1
                    this.render()
                }
                return
            }
            if (key === '\x1b[B' || key === 'j') {
                if (this.state.questionSelectedIndex < optionsCount - 1) {
                    this.state.questionSelectedIndex += 1
                    this.render()
                }
                return
            }
            if (key === ' ' && isMulti) {
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
            const opts = DEFAULT_PERMISSION_OPTIONS
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
            if (key === 'g' || key === 'G') {
                this.resolveToolPermission('git_tracked')
                return
            }
            if (key === 'd' || key === 'D' || key === 'n' || key === 'N') {
                this.resolveToolPermission('deny')
                return
            }
            if (key === '\r' || key === '\n' || key === ' ') {
                const opt = opts[this.state.toolPermissionSelectedIndex]
                const val = (opt?.value as any) || 'deny'
                this.resolveToolPermission(val)
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
                    if (this.onSaveApiKeyCallback) {
                        Promise.resolve(this.onSaveApiKeyCallback(provider, trimmed)).catch(() => {
                            // Intentionally swallowed: key save callback error handled
                        })
                    }
                    const existingSwitchIdx = this.state.switchItems.findIndex(
                        (it) =>
                            it.value === `provider:${provider}` || it.value === `byok:${provider}`
                    )
                    if (existingSwitchIdx === -1) {
                        this.state.switchItems.push({
                            label: formatProviderName(provider),
                            value: `provider:${provider}`,
                            isActive: true,
                        })
                    } else {
                        for (const it of this.state.switchItems) {
                            it.isActive =
                                it.value === `provider:${provider}` ||
                                it.value === `byok:${provider}`
                        }
                    }
                    this.state.activeOverlay = 'none'
                    this.state.isAuthenticated = true
                    this.state.authMethod = 'byok'
                    this.state.selectedProvider = provider
                    this.showToast(`Saved API key for ${formatProviderName(provider)}.`, 'success')
                    this.render()
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
        const text = (overridePrompt ?? this.state.input).trim()
        if (!text) return

        // Direct shell command (!<command>)
        if (text.startsWith('!')) {
            const rawCmd = text.slice(1).trim()
            if (!rawCmd) {
                this.showToast('Usage: !<command> (e.g. !git status)', 'info')
                return
            }

            this.state.promptHistory.push(text)
            this.state.historyIndex = -1

            this.state.messages.push({
                role: 'user',
                content: text,
            })

            this.state.input = ''
            this.state.cursorPos = 0
            this.state.scrollOffset = undefined
            this.state.isReadingMode = false
            this.state.isFileAutocompleteVisible = false
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

        this.state.promptHistory.push(text)
        this.state.historyIndex = -1

        this.state.messages.push({
            role: 'user',
            content: text,
        })

        this.state.input = ''
        this.state.cursorPos = 0
        this.state.overlayHistory = []
        this.state.scrollOffset = undefined
        this.state.isReadingMode = false
        this.state.isFileAutocompleteVisible = false

        this.render()

        if (this.onSubmitCallback) {
            this.onSubmitCallback(text)
        }
    }

    appendStreamDelta(delta: string): void {
        if (!delta) return

        // Finalize any in-progress thinking block before streaming answer text
        for (let i = this.state.messages.length - 1; i >= 0; i--) {
            const m = this.state.messages[i]
            if (m && m.role === 'thinking' && m.isStreaming) {
                m.isStreaming = false
                break
            }
        }

        const lastMsg = this.state.messages[this.state.messages.length - 1]
        if (lastMsg && lastMsg.role === 'assistant') {
            lastMsg.content = (lastMsg.content || '') + delta
        } else {
            this.state.messages.push({
                role: 'assistant',
                content: delta,
            })
        }

        if (!this.state.isReadingMode) {
            this.state.scrollOffset = undefined
        }

        this.render()
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
            })
        }

        if (!this.state.isReadingMode) {
            this.state.scrollOffset = undefined
        }

        this.render()
    }

    appendMessage(message: MessageItem): void {
        this.state.messages.push(message)
        this.render()
    }

    appendToolCall(toolCall: { id: string; name: string; input?: any; command?: string }): void {
        // Finalize any in-progress thinking block before tool execution
        for (let i = this.state.messages.length - 1; i >= 0; i--) {
            const m = this.state.messages[i]
            if (m && m.role === 'thinking' && m.isStreaming) {
                m.isStreaming = false
                break
            }
        }

        const fallbackSummary = toolCall.command || `${toolCall.name}()`

        this.state.messages.push({
            role: 'tool',
            toolCall: {
                id: toolCall.id,
                name: toolCall.name,
                command: fallbackSummary,
                status: 'running',
                output: '',
            },
        })

        if (!this.state.isReadingMode) {
            this.state.scrollOffset = undefined
        }

        this.render()
    }

    updateToolExecution(toolCallId: string, chunk: string): void {
        const msg = this.state.messages.find(
            (m) => m.role === 'tool' && m.toolCall?.id === toolCallId
        )
        if (msg && msg.toolCall) {
            msg.toolCall.output = (msg.toolCall.output || '') + chunk
            this.render()
        }
    }

    updateToolResult(toolCallId: string, result: { output?: string; isError?: boolean }): void {
        const msg = this.state.messages.find(
            (m) => m.role === 'tool' && m.toolCall?.id === toolCallId
        )
        if (msg && msg.toolCall) {
            msg.toolCall.status = result.isError ? 'error' : 'success'
            if (result.output) {
                msg.toolCall.output = result.output
            }
            this.render()
        }
    }

    scrollUp(delta = 1): void {
        const current = this.state.scrollOffset ?? this.maxScroll
        const next = Math.max(0, current - delta)
        this.state.scrollOffset = next
        this.state.isReadingMode = next < this.maxScroll
        this.render()
    }

    scrollDown(delta = 1): void {
        const current = this.state.scrollOffset ?? this.maxScroll
        const next = Math.min(this.maxScroll, current + delta)
        this.state.scrollOffset = next
        this.state.isReadingMode = next < this.maxScroll
        this.render()
    }

    scrollToBottom(): void {
        this.state.scrollOffset = undefined
        this.state.isReadingMode = false
        this.render()
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

    render(): void {
        const width = this.screen.columns
        const height = this.screen.rows

        this.screen.backBuffer.clear()

        const overlay = this.state.activeOverlay
        const isPagerMode =
            overlay === 'fileview' ||
            overlay === 'memory' ||
            (overlay === 'diff' && this.state.isDiffDetailView) ||
            (overlay === 'skills' && this.state.skillsIsDetailView)

        // 1. TRUE 100% FULL SCREEN PAGER MODE (LESS / VIM STYLE)
        // When viewing actual code (fileview / diff detail / memory / skill detail), take over 100% of the screen from row 0 to bottom,
        // replacing even the multi-line brand header. Terminal cursor is hidden.
        if (isPagerMode) {
            this.screen.setCursor(0, 0, false)

            if (overlay === 'fileview') {
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
                })
            } else if (overlay === 'diff') {
                DiffViewMenuView.render(this.screen.backBuffer, {
                    x: 0,
                    y: 0,
                    width,
                    height,
                    files: this.state.diffFiles,
                    selectedFileIndex: this.state.diffSelectedIndex,
                    windowStart: this.state.diffWindowStart,
                    isDetailView: true,
                    detailScrollOffset: this.state.diffScrollOffset,
                    cursorLineIndex: this.state.diffCursorLineIndex,
                })
            } else if (overlay === 'skills') {
                SkillsMenuView.render(this.screen.backBuffer, {
                    x: 0,
                    y: 0,
                    width,
                    height,
                    selectedIndex: this.state.skillsSelectedIndex,
                    windowStart: this.state.skillsWindowStart,
                    skills: this.state.skills,
                    searchQuery: this.state.skillsSearchQuery,
                    isSearching: this.state.skillsIsSearching,
                    isDetailView: true,
                    detailLines: this.state.skillsDetailLines,
                    cursorLineIndex: this.state.skillsCursorLine,
                    scrollOffset: this.state.skillsScrollOffset,
                    isLoadingDetail: this.state.skillsDetailLoading,
                    detailError: this.state.skillsDetailError,
                })
            } else if (overlay === 'memory') {
                const currentCat =
                    MEMORY_CATEGORIES[this.state.memoryNewEntryCategoryIndex] || 'general'
                MemoryViewMenuView.render(this.screen.backBuffer, {
                    x: 0,
                    y: 0,
                    width,
                    height,
                    activeTab: this.state.memoryTab,
                    memoryDetails: this.state.workspaceMemoryDetails,
                    selectedEntryIndex: this.state.memorySelectedIndex,
                    scrollOffset: this.state.memoryScrollOffset,
                    isAddingEntry: this.state.isAddingMemory,
                    newEntryText: this.state.memoryNewEntryText,
                    newEntryCategory: currentCat,
                    ruleFiles: this.state.memoryRuleFiles,
                    selectedRuleIndex: this.state.memoryActiveDocIndex,
                    ruleScrollOffset: this.state.memoryRuleScrollOffset,
                    ruleCursorLineIndex: this.state.memoryCursorLine,
                    isLoading: this.state.memoryIsLoading,
                    documents: this.state.memoryDocuments,
                    canGoBack: Boolean(
                        (this.state.memoryTab === 'rules' &&
                            this.state.memoryInitialTab === 'memory') ||
                        (this.state.memoryReturnOverlay &&
                            this.state.memoryReturnOverlay !== 'none')
                    ),
                })
            }
            this.screen.render()
            return
        }

        // 2. Render Multi-Line Brand Header (Prompt Mode & Card Overlays)
        const headerHeight = this.getHeaderHeight()

        HeaderView.render(this.screen.backBuffer, {
            x: 0,
            y: 0,
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
        })

        const isOverlayActive = this.state.activeOverlay !== 'none'

        if (!isOverlayActive) {
            // PROMPT MODE:
            // 2. Input Bar (4 rows at bottom)
            const inputHeight = InputBarView.getHeight()
            const inputY = Math.max(headerHeight, height - inputHeight)

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
                btwHeight = BtwOverlayView.getHeight(this.state.btwState)
            }

            // 4. Message List View (between header and interactive area)
            // Render the base chat layer FIRST so floating overlays always sit on top!
            const bottomFloating = Math.max(fileMenuHeight, commandMenuHeight)
            const topOfInteractive = inputY - bottomFloating - btwHeight
            const bodyHeight = Math.max(1, topOfInteractive - headerHeight)

            const { maxScroll } = MessageListView.render(this.screen.backBuffer, {
                x: 0,
                y: headerHeight,
                width,
                height: bodyHeight,
                messages: this.state.messages,
                scrollOffset: this.state.scrollOffset,
            })
            this.maxScroll = maxScroll

            // 5. Render floating overlays on top of chat area (with clearArea)
            if (this.state.btwState && btwHeight > 0) {
                const btwY = Math.max(headerHeight, inputY - bottomFloating - btwHeight)
                this.screen.backBuffer.clearArea(0, btwY, width, btwHeight)
                BtwOverlayView.render(this.screen.backBuffer, {
                    x: 0,
                    y: btwY,
                    width,
                    state: this.state.btwState,
                    scrollOffset: this.state.btwScrollOffset,
                })
            }

            if (fileMenuHeight > 0) {
                const fileMenuY = Math.max(headerHeight, inputY - fileMenuHeight)
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
                const cmdY = Math.max(headerHeight, inputY - commandMenuHeight)
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
                isStreaming: this.state.isStreaming,
                activeModel: this.state.activeModel,
                modelLabel: this.state.modelLabel,
                isAuthenticated: this.state.isAuthenticated,
                authMethod: this.state.authMethod,
                contextTokens: this.state.contextTokens,
                maxContextTokens: this.state.maxContextTokens,
                tasksCount: this.state.tasks.length,
                runningTasksCount: this.state.tasks.filter((t) => t.status === 'running').length,
                showExitConfirm: this.state.showExitConfirm,
                toast: this.state.toast,
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
                naturalHeight = TasksModeMenuView.getHeight(this.state.tasks.length)
            } else if (overlay === 'skills') {
                naturalHeight = SkillsMenuView.getHeight(
                    this.state.skills.length,
                    6,
                    this.state.skillsIsDetailView
                )
            } else if (overlay === 'codesearch') {
                const count =
                    this.state.codeSearchGroups.length > 0
                        ? this.state.codeSearchGroups.length
                        : this.state.codeSearchResults.length
                naturalHeight = CodeSearchMenuView.getHeight(count)
            } else if (overlay === 'diff') {
                naturalHeight = DiffViewMenuView.getHeight(this.state.diffFiles.length)
            } else if (overlay === 'effort') {
                naturalHeight = EffortMenuView.getHeight()
            } else if (overlay === 'login') {
                naturalHeight = LoginMenuView.getHeight(this.state.loginConfirmSwitch)
            } else if (overlay === 'session') {
                const filtered = SessionSelectMenuView.getFiltered(
                    this.state.sessions,
                    this.state.sessionSearchQuery
                )
                naturalHeight = SessionSelectMenuView.getHeight(filtered.length)
            } else if (overlay === 'usage') {
                naturalHeight = UsageSelectMenuView.getHeight()
            } else if (overlay === 'rewind') {
                naturalHeight = RewindSelectMenuView.getHeight(this.state.rewindTurns.length)
            } else if (overlay === 'ask_question') {
                const q = this.state.pendingQuestions?.[this.state.currentQuestionIndex]
                naturalHeight = AskQuestionMenuView.getHeight(q?.options?.length || 0)
            } else if (overlay === 'tool_permission') {
                naturalHeight = ToolPermissionMenuView.getHeight(
                    this.state.pendingToolCall?.diffLines?.length || 0
                )
            } else if (overlay === 'plan_approve') {
                naturalHeight = PlanApproveMenuView.getHeight()
            } else if (overlay === 'auth') {
                naturalHeight = AuthMenuView.getHeight(
                    this.state.authViewMode,
                    this.state.authProviders.length
                )
            } else if (overlay === 'switch') {
                naturalHeight = SwitchSelectMenuView.getHeight(this.state.switchItems.length)
            }

            const clampedOverlayHeight = Math.min(
                naturalHeight,
                Math.max(5, height - headerHeight - 1)
            )
            const overlayY = Math.max(headerHeight, height - clampedOverlayHeight)
            const chatHeight = Math.max(0, overlayY - headerHeight)

            // Render messages above the overlay card
            if (chatHeight > 0) {
                const { maxScroll } = MessageListView.render(this.screen.backBuffer, {
                    x: 0,
                    y: headerHeight,
                    width,
                    height: chatHeight,
                    messages: this.state.messages,
                    scrollOffset: this.state.scrollOffset,
                })
                this.maxScroll = maxScroll
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
                    configPath: this.state.configPath,
                    commands: this.getAllCommands(),
                    cmdSelectedIndex: this.state.helpCmdSelectedIndex,
                    cmdWindowStart: this.state.helpCmdWindowStart,
                    shortcuts: SHORTCUTS,
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
                    contextTokens: this.state.contextTokens,
                    maxContextTokens: this.state.maxContextTokens,
                    messageCount: this.state.messages.length,
                })
            } else if (overlay === 'settings') {
                SettingsMenuView.render(this.screen.backBuffer, {
                    x: 0,
                    y: overlayY,
                    width,
                    height: clampedOverlayHeight,
                    selectedIndex: this.state.settingsSelectedIndex,
                    settings: this.state.settings,
                })
            } else if (overlay === 'model') {
                ModelSelectMenuView.render(this.screen.backBuffer, {
                    x: 0,
                    y: overlayY,
                    width,
                    height: clampedOverlayHeight,
                    models: this.state.models,
                    activeModel: this.state.activeModel,
                    selectedIndex: this.state.modelSelectedIndex,
                    windowStart: this.state.modelWindowStart,
                    searchQuery: this.state.modelSearchQuery,
                    isSearching: this.state.isModelSearching,
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
                })
            } else if (overlay === 'skills') {
                SkillsMenuView.render(this.screen.backBuffer, {
                    x: 0,
                    y: overlayY,
                    width,
                    height: clampedOverlayHeight,
                    selectedIndex: this.state.skillsSelectedIndex,
                    windowStart: this.state.skillsWindowStart,
                    skills: this.state.skills,
                    searchQuery: this.state.skillsSearchQuery,
                    isSearching: this.state.skillsIsSearching,
                    isDetailView: this.state.skillsIsDetailView,
                    detailLines: this.state.skillsDetailLines,
                    cursorLineIndex: this.state.skillsCursorLine,
                    scrollOffset: this.state.skillsScrollOffset,
                    isLoadingDetail: this.state.skillsDetailLoading,
                    detailError: this.state.skillsDetailError,
                })
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
                DiffViewMenuView.render(this.screen.backBuffer, {
                    x: 0,
                    y: overlayY,
                    width,
                    height: clampedOverlayHeight,
                    files: this.state.diffFiles,
                    selectedFileIndex: this.state.diffSelectedIndex,
                    windowStart: this.state.diffWindowStart,
                    isDetailView: false,
                    detailScrollOffset: 0,
                })
            } else if (overlay === 'effort') {
                EffortMenuView.render(this.screen.backBuffer, {
                    x: 0,
                    y: overlayY,
                    width,
                    height: clampedOverlayHeight,
                    modelLabel: this.state.modelLabel || this.state.activeModel,
                    currentLevel: this.state.thinkingLevel,
                    selectedIndex: this.state.effortSelectedIndex,
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
                SessionSelectMenuView.render(this.screen.backBuffer, {
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
                })
            } else if (overlay === 'usage') {
                const providerKey = (this.state.selectedProvider || 'google').toLowerCase()
                const billingUrl =
                    PROVIDER_BILLING_LINKS[providerKey] ||
                    'https://trydecember.com/settings/billing'
                UsageSelectMenuView.render(this.screen.backBuffer, {
                    x: 0,
                    y: overlayY,
                    width,
                    height: clampedOverlayHeight,
                    activeModel: this.state.activeModel,
                    providerDisplayName: this.state.selectedProvider,
                    billingUrl,
                    sessionStats: this.state.usageStats,
                    weeklyStats: this.state.weeklyStats,
                    dailyUsage: this.state.dailyUsage,
                    balance: this.state.balance,
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

        // Diff and flush to stdout
        this.screen.render()
    }
}
