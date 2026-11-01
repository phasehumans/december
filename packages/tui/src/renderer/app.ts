import { exec } from 'node:child_process'
import * as os from 'node:os'

import { getAllAvailableCommands } from '../commands/filter-commands'
import { writeToClipboard } from '../utils/clipboard'
import { searchWorkspaceCode, type CodeSearchResultItem } from '../utils/code-search'
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
    type MemoryTab,
    type MemoryDocument,
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
import { TasksModeMenuView, type TaskItem } from './views/tasks-mode-menu-view'
import {
    ToolPermissionMenuView,
    DEFAULT_PERMISSION_OPTIONS,
} from './views/tool-permission-menu-view'
import {
    UsageSelectMenuView,
    type UsageStats,
    type DailyUsageEntry,
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
    cwd?: string
    branch?: string
    latestVersion?: string
    announcement?: ReleaseAnnouncement | null
    showExitConfirm: boolean
    toast: { message: string; variant?: 'success' | 'error' | 'info' } | null
    activeOverlay: OverlayType

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

    // Code search state
    codeSearchQuery: string
    codeSearchResults: CodeSearchResultItem[]
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
    balance?: { supported: boolean; balance?: string; currency?: string; error?: string }

    // Memory view state
    memoryTab: MemoryTab
    memoryDocuments: MemoryDocument[]
    memoryActiveDocIndex: number
    memoryCursorLine: number
    memoryScrollOffset: number
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

    // File autocomplete dropup state
    fileAutocompleteItems: ScoredFile[]
    fileAutocompleteSelectedIndex: number
    fileAutocompleteWindowStart: number
    isFileAutocompleteVisible: boolean

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
    onEffortSelect?: (level: ReasoningLevel) => void
    onLogin?: (
        onCode: (code: string, url: string) => void,
        signal?: AbortSignal
    ) => Promise<{ token: string; email: string | null }>
    onSubscriptionLogin?: (provider: string) => Promise<void>
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
    workspaceFiles?: string[]
    recentFiles?: Set<string>
    onSaveApiKey?: (provider: string, apiKey: string) => Promise<void> | void
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
    private isRunning = false
    private stdinListener?: (chunk: Buffer | string) => void
    private maxScroll = 0
    private exitTimer: any = null
    private toastTimer: any = null
    private onSubmitCallback?: (prompt: string) => void
    private onExitCallback?: () => void
    private onModelSelectCallback?: (model: ModelItem) => void
    private onCodeSearchCallback?: (query: string) => Promise<CodeSearchResultItem[]>
    private onOpenCodeSearchResultCallback?: (item: CodeSearchResultItem) => void
    private onInsertContextCallback?: (file: string, line?: number) => void
    private onEffortSelectCallback?: (level: ReasoningLevel) => void
    private onLoginCallback?: (
        onCode: (code: string, url: string) => void,
        signal?: AbortSignal
    ) => Promise<{ token: string; email: string | null }>
    private onSubscriptionLoginCallback?: (provider: string) => Promise<void>
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

    constructor(options?: DifferentialAppOptions) {
        this.terminal = options?.terminal ?? new TerminalController()
        this.screen = new DifferentialScreen({
            terminal: this.terminal,
            width: options?.width,
            height: options?.height,
            synchronized: options?.synchronized,
        })

        this.onSubmitCallback = options?.onSubmit
        this.onExitCallback = options?.onExit
        this.onModelSelectCallback = options?.onModelSelect
        this.onEffortSelectCallback = options?.onEffortSelect
        this.onLoginCallback = options?.onLogin
        this.onSubscriptionLoginCallback = options?.onSubscriptionLogin
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
            cwd: options?.cwd,
            branch: options?.branch,
            contextTokens: options?.contextTokens || 0,
            maxContextTokens: options?.maxContextTokens,
            announcement: options?.announcement,
            showExitConfirm: false,
            toast: null,
            activeOverlay: 'none',

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
            memoryTab: 'rules',
            memoryDocuments: options?.memoryDocuments || [],
            memoryActiveDocIndex: 0,
            memoryCursorLine: 0,
            memoryScrollOffset: 0,
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
            authProviders: [],
            authProviderSelectedIndex: 0,
            authProviderWindowStart: 0,
            authProviderSearchQuery: '',
            isSearchingAuthProviders: false,
            authApiKeyInput: '',
            authKeyError: null,
            authMenuSelectedIndex: 0,

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

            codeSearchQuery: '',
            codeSearchResults: [],
            codeSearchSelectedIndex: 0,
            codeSearchWindowStart: 0,

            fileViewPath: '',
            fileViewLines: [],
            fileViewCursorLine: 0,
            fileViewScrollOffset: 0,
            fileViewIsLoading: false,
            fileViewError: null,
            fileViewReturnOverlay: 'none',

            btwState: null,
            btwScrollOffset: 0,
        }

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
        returnOverlay: OverlayType = 'none'
    ): Promise<void> {
        this.state.activeOverlay = 'fileview'
        this.state.fileViewPath = filePath
        this.state.fileViewReturnOverlay = returnOverlay
        this.state.fileViewIsLoading = true
        this.state.fileViewError = null
        this.state.fileViewLines = []
        const line0 = Math.max(0, targetLine - 1)
        this.state.fileViewCursorLine = line0
        this.state.fileViewScrollOffset = Math.max(0, line0 - 5)
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
            this.state.fileViewScrollOffset = Math.max(0, clampedLine - 5)
        } catch (err: any) {
            this.state.fileViewIsLoading = false
            this.state.fileViewError = err?.message || 'Failed to read file'
        }
        this.render()
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
                    content: `Confirm code: ${code}\nOpen URL: ${fullUrl}\n\nWaiting for approval in your browser...`,
                }
                this.render()
                openBrowserUrl(fullUrl)
            }

            const { token, email } = await loginFn(onCode)
            if (email) {
                this.state.userEmail = email
            }
            this.state.isAuthenticated = true
            this.state.authMethod = 'december'
            this.state.messages[msgIndex] = {
                role: 'assistant',
                content: `Successfully logged in as ${email || 'December user'}!`,
            }
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

    setWorkspaceFiles(files: string[]): void {
        this.workspaceFiles.length = 0
        this.workspaceFiles.push(...files)
        this.updateFileAutocomplete()
    }

    addRecentFile(filePath: string): void {
        this.recentFiles.add(filePath)
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
        if (match !== null && this.workspaceFiles.length > 0) {
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
                if (this.state.activeOverlay === 'diff' && this.state.isDiffDetailView) {
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
                if (this.state.activeOverlay === 'model' && this.state.isModelSearching) {
                    this.state.isModelSearching = false
                    this.render()
                    return
                }
                if (
                    this.state.activeOverlay === 'session' &&
                    (this.state.isSessionSearching ||
                        this.state.sessionRenameMode ||
                        this.state.sessionConfirmDeleteId)
                ) {
                    this.state.isSessionSearching = false
                    this.state.sessionRenameMode = false
                    this.state.sessionConfirmDeleteId = null
                    this.render()
                    return
                }
                if (this.state.activeOverlay === 'auth' && this.state.authViewMode !== 'menu') {
                    if (this.state.authViewMode === 'byok_key') {
                        this.state.authViewMode = 'byok_provider'
                    } else {
                        this.state.authViewMode = 'menu'
                    }
                    this.render()
                    return
                }
                if (this.state.activeOverlay === 'ask_question') {
                    const res = this.pendingQuestionResolver
                    this.pendingQuestionResolver = undefined
                    this.state.pendingQuestions = null
                    this.state.activeOverlay = 'none'
                    this.render()
                    res?.({})
                    return
                }
                if (this.state.activeOverlay === 'tool_permission') {
                    this.resolveToolPermission('deny')
                    return
                }
                if (this.state.activeOverlay === 'plan_approve') {
                    this.resolvePlanApproval('reject')
                    return
                }
                if (this.state.activeOverlay === 'fileview') {
                    this.state.activeOverlay = this.state.fileViewReturnOverlay || 'none'
                    this.render()
                    return
                }
                this.state.activeOverlay = 'none'
                this.render()
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
            this.showToast(`Opening changelog in browser... (${url})`, 'info')
            return
        }

        if (cmd === 'docs' || cmd.startsWith('docs')) {
            const url = 'https://trydecember.com/docs'
            openBrowserUrl(url)
            this.showToast(`Opening documentation in browser... (${url})`, 'info')
            return
        }

        if (cmd === 'feedback') {
            const url = 'https://github.com/phasehumans/december/issues/new'
            openBrowserUrl(url)
            this.showToast('Opening GitHub issue form in browser...', 'info')
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
                    this.showToast(
                        `Initiating subscription login for ${provider.toUpperCase()}...`,
                        'info'
                    )
                    this.onSubscriptionLoginCallback(provider).catch((err: any) => {
                        this.showToast(
                            `Subscription login failed: ${err?.message || 'Error'}`,
                            'error'
                        )
                    })
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
            this.state.skills = loadWorkspaceSkills()
            this.render()
            return
        }

        if (cmd === 'model' || cmd === 'switch') {
            this.state.activeOverlay = 'model'
            this.state.modelSearchQuery = ''
            this.state.modelSelectedIndex = 0
            this.state.modelWindowStart = 0
            this.state.isModelSearching = false
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
            this.state.sessionSearchQuery = ''
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
            this.render()
            return
        }

        if (cmd === 'memory' || cmd === 'rules') {
            this.state.activeOverlay = 'memory'
            this.state.memoryTab = cmd === 'rules' ? 'rules' : 'memory'
            this.state.memoryActiveDocIndex = 0
            this.state.memoryCursorLine = 0
            this.state.memoryScrollOffset = 0
            this.render()
            return
        }

        if (cmd === 'rewind' || cmd === 'undo') {
            this.state.activeOverlay = 'rewind'
            this.state.rewindSelectedIndex = 0
            this.state.rewindWindowStart = 0
            this.render()
            return
        }

        if (cmd === 'open') {
            if (!args) {
                this.showToast('Usage: /open <file>[:line]', 'info')
                return
            }
            const match = args.match(/^(.+?)(?::(\d+))?$/)
            const targetPath = match ? match[1] : args
            const targetLine = match && match[2] ? parseInt(match[2], 10) : 1
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
                    this.render()
                })
                .catch(() => {
                    this.state.codeSearchResults = []
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

    private handleOverlayKey(key: string): void {
        const overlay = this.state.activeOverlay

        // Esc or Ctrl+C closes any overlay
        if (key === '\x1b' || key === '\x03') {
            if (overlay === 'diff' && this.state.isDiffDetailView) {
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
            if (overlay === 'model' && this.state.isModelSearching) {
                this.state.isModelSearching = false
                this.render()
                return
            }
            if (overlay === 'fileview') {
                this.state.activeOverlay = this.state.fileViewReturnOverlay || 'none'
                this.render()
                return
            }
            this.state.activeOverlay = 'none'
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
                if (key === 'n' || key === 'N' || key === '\x1b') {
                    this.state.loginConfirmSwitch = false
                    this.state.activeOverlay = 'none'
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

                if (selected.value === 'byok') {
                    this.state.activeOverlay = 'model'
                    this.showToast(
                        'Select a model or provider. Configure API keys with `december key <provider>`.',
                        'info'
                    )
                    this.render()
                    return
                }

                if (selected.value === 'december') {
                    const isDecemberLoggedIn = Boolean(
                        this.state.isAuthenticated &&
                        this.state.userEmail &&
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
                        this.state.activeOverlay = 'model'
                        this.render()
                        return
                    }
                    if (current.id === 'thinking_level') {
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
            const results = this.state.codeSearchResults
            const total = results.length
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
                const item = results[this.state.codeSearchSelectedIndex]
                if (item) {
                    if (this.onOpenCodeSearchResultCallback) {
                        this.onOpenCodeSearchResultCallback(item)
                    }
                    this.openFileView(item.file, item.line, 'codesearch')
                }
                return
            }

            if (key === '\t' || key === 'c' || key === 'C') {
                const item = results[this.state.codeSearchSelectedIndex]
                if (item) {
                    this.state.input = `@${item.file}:${item.line} `
                    this.state.cursorPos = this.state.input.length
                    this.showToast(`Inserted reference to ${item.file}:${item.line}`, 'success')
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
            const skills = this.state.skills
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
                    if (this.state.skillsSelectedIndex >= this.state.skillsWindowStart + 8) {
                        this.state.skillsWindowStart = this.state.skillsSelectedIndex - 7
                    }
                    this.render()
                }
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
                    this.showToast(`Switched active model to ${selected.label}`, 'success')
                    if (this.onModelSelectCallback) {
                        this.onModelSelectCallback(selected)
                    }
                }
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
                    const cur = this.state.sessions[this.state.sessionSelectedIndex]
                    if (cur) {
                        cur.preview = this.state.sessionRenameValue.trim() || cur.preview
                        if (this.onSessionRenameCallback) {
                            this.onSessionRenameCallback(cur.id, cur.preview || cur.id)
                        }
                        this.showToast('Renamed session.', 'success')
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

            if (key === '/' || key === 's') {
                this.state.isSessionSearching = true
                this.render()
                return
            }

            if (key === 'r' || key === 'R') {
                const cur = this.state.sessions[this.state.sessionSelectedIndex]
                if (cur) {
                    this.state.sessionRenameMode = true
                    this.state.sessionRenameValue = cur.preview || cur.id
                    this.render()
                }
                return
            }

            if (key === 'd' || key === 'D' || key === '\x1b[3~') {
                const cur = this.state.sessions[this.state.sessionSelectedIndex]
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

            const filtered = SessionSelectMenuView.getFiltered(
                this.state.sessions,
                this.state.sessionSearchQuery
            )
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

            if (key === 'q' || key === 'Q') {
                this.state.activeOverlay = 'none'
                this.render()
                return
            }
            return
        }

        if (overlay === 'usage') {
            if (key === 'p' || key === 'P' || key === 'b' || key === 'B') {
                const url = 'https://trydecember.com/settings/billing'
                if (this.onOpenBillingPortalCallback) {
                    this.onOpenBillingPortalCallback(url)
                } else {
                    openBrowserUrl(url)
                }
                this.showToast('Opening billing portal in browser...', 'info')
                return
            }
            if (key === 'q' || key === 'Q' || key === '\r' || key === '\n') {
                this.state.activeOverlay = 'none'
                this.render()
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
            if (key === '\t' || key === '\x1b[C' || key === '\x1b[D') {
                this.state.memoryTab = this.state.memoryTab === 'rules' ? 'memory' : 'rules'
                this.state.memoryActiveDocIndex = 0
                this.state.memoryCursorLine = 0
                this.state.memoryScrollOffset = 0
                this.render()
                return
            }
            const filteredDocs = this.state.memoryDocuments.filter((d) =>
                this.state.memoryTab === 'rules' ? !d.isMemory : d.isMemory
            )
            if (key === '[' || key === ']') {
                if (filteredDocs.length > 0) {
                    const delta = key === '[' ? -1 : 1
                    this.state.memoryActiveDocIndex =
                        (this.state.memoryActiveDocIndex + delta + filteredDocs.length) %
                        filteredDocs.length
                    this.state.memoryCursorLine = 0
                    this.state.memoryScrollOffset = 0
                    this.render()
                }
                return
            }
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
            if (key === '\x1b[B' || key === 'j') {
                this.state.memoryCursorLine += 1
                const visibleRows = Math.max(5, this.screen.height - 8)
                if (this.state.memoryCursorLine >= this.state.memoryScrollOffset + visibleRows) {
                    this.state.memoryScrollOffset = this.state.memoryCursorLine - visibleRows + 1
                }
                this.render()
                return
            }
            if (key === 'q' || key === 'Q') {
                this.state.activeOverlay = 'none'
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
                        this.state.authViewMode = 'byok_provider'
                        if (this.state.authProviders.length === 0) {
                            this.state.authProviders = DEFAULT_AUTH_PROVIDERS
                        }
                        this.state.authProviderSelectedIndex = 0
                        this.state.authProviderWindowStart = 0
                        this.state.authProviderSearchQuery = ''
                        this.state.isSearchingAuthProviders = false
                        this.render()
                    } else {
                        this.startDecemberLogin()
                    }
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
                        this.state.authViewMode = 'byok_key'
                        this.state.authApiKeyInput = ''
                        this.state.authKeyError = null
                        this.render()
                    }
                    return
                }

                if (key === '\x1b') {
                    this.state.authViewMode = 'menu'
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
                    const provider =
                        this.state.authProviders[this.state.authProviderSelectedIndex]?.value ||
                        'custom'
                    if (this.onSaveApiKeyCallback) {
                        this.onSaveApiKeyCallback(provider, trimmed)
                    }
                    this.state.activeOverlay = 'none'
                    this.state.isAuthenticated = true
                    this.state.authMethod = 'byok'
                    this.state.selectedProvider = provider
                    this.showToast(`Saved API key for ${provider}.`, 'success')
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
            overlay === 'fileview' || (overlay === 'diff' && this.state.isDiffDetailView)

        // 1. TRUE 100% FULL SCREEN PAGER MODE (LESS / VIM STYLE)
        // When viewing actual code (fileview / diff detail), take over 100% of the screen from row 0 to bottom,
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

            // 3. Floating File Autocomplete Menu (when @ query is active)
            let fileMenuHeight = 0
            if (
                this.state.isFileAutocompleteVisible &&
                this.state.fileAutocompleteItems.length > 0
            ) {
                fileMenuHeight = FileAutocompleteMenuView.getHeight(
                    this.state.fileAutocompleteItems.length
                )
                const fileMenuY = Math.max(headerHeight, inputY - fileMenuHeight)
                FileAutocompleteMenuView.render(this.screen.backBuffer, {
                    x: 0,
                    y: fileMenuY,
                    width,
                    files: this.state.fileAutocompleteItems,
                    selectedIndex: this.state.fileAutocompleteSelectedIndex,
                    windowStart: this.state.fileAutocompleteWindowStart,
                })
            }

            // 4. Floating Command Menu (only while typing command name without space)
            let commandMenuHeight = 0
            const isCommandMenuVisible =
                !this.state.isFileAutocompleteVisible &&
                this.state.input.startsWith('/') &&
                !this.state.input.includes(' ')
            if (isCommandMenuVisible) {
                const query = this.state.input.slice(1).trim()
                commandMenuHeight = CommandMenuView.getHeight(query)
                const cmdY = Math.max(headerHeight, inputY - commandMenuHeight)
                CommandMenuView.render(this.screen.backBuffer, {
                    x: 0,
                    y: cmdY,
                    width,
                    query,
                    selectedIndex: this.state.commandSelectedIndex,
                    windowStart: this.state.commandWindowStart,
                })
            }

            // 5. Btw side-question callout box above prompt bar
            let btwHeight = 0
            if (this.state.btwState) {
                btwHeight = BtwOverlayView.getHeight(this.state.btwState)
                const bottomFloating = Math.max(fileMenuHeight, commandMenuHeight)
                const btwY = Math.max(headerHeight, inputY - bottomFloating - btwHeight)
                BtwOverlayView.render(this.screen.backBuffer, {
                    x: 0,
                    y: btwY,
                    width,
                    state: this.state.btwState,
                    scrollOffset: this.state.btwScrollOffset,
                })
            }

            // 6. Message List View (between header and interactive area)
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
                naturalHeight = SkillsMenuView.getHeight(this.state.skills.length)
            } else if (overlay === 'codesearch') {
                naturalHeight = CodeSearchMenuView.getHeight(this.state.codeSearchResults.length)
            } else if (overlay === 'diff') {
                naturalHeight = DiffViewMenuView.getHeight(this.state.diffFiles.length)
            } else if (overlay === 'effort') {
                naturalHeight = EffortMenuView.getHeight()
            } else if (overlay === 'login') {
                naturalHeight = LoginMenuView.getHeight()
            } else if (overlay === 'session') {
                naturalHeight = SessionSelectMenuView.getHeight(this.state.sessions.length)
            } else if (overlay === 'usage') {
                naturalHeight = UsageSelectMenuView.getHeight()
            } else if (overlay === 'rewind') {
                naturalHeight = RewindSelectMenuView.getHeight(this.state.rewindTurns.length)
            } else if (overlay === 'memory') {
                naturalHeight = MemoryViewMenuView.getHeight(
                    Math.max(12, height - headerHeight - 1)
                )
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
                })
            } else if (overlay === 'codesearch') {
                CodeSearchMenuView.render(this.screen.backBuffer, {
                    x: 0,
                    y: overlayY,
                    width,
                    height: clampedOverlayHeight,
                    query: this.state.codeSearchQuery,
                    results: this.state.codeSearchResults,
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
                UsageSelectMenuView.render(this.screen.backBuffer, {
                    x: 0,
                    y: overlayY,
                    width,
                    height: clampedOverlayHeight,
                    activeModel: this.state.activeModel,
                    providerDisplayName: this.state.selectedProvider,
                    sessionStats: this.state.usageStats,
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
            } else if (overlay === 'memory') {
                MemoryViewMenuView.render(this.screen.backBuffer, {
                    x: 0,
                    y: overlayY,
                    width,
                    height: clampedOverlayHeight,
                    activeTab: this.state.memoryTab,
                    documents: this.state.memoryDocuments,
                    activeDocIndex: this.state.memoryActiveDocIndex,
                    cursorLineIndex: this.state.memoryCursorLine,
                    scrollOffset: this.state.memoryScrollOffset,
                    isLoading: this.state.memoryIsLoading,
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
                AuthMenuView.render(this.screen.backBuffer, {
                    x: 0,
                    y: overlayY,
                    width,
                    height: clampedOverlayHeight,
                    mode: this.state.authViewMode,
                    userEmail: this.state.userEmail,
                    isAuthenticated: this.state.isAuthenticated,
                    authMethod: this.state.authMethod,
                    selectedProvider: this.state.selectedProvider,
                    providers: this.state.authProviders,
                    providerSelectedIndex: this.state.authProviderSelectedIndex,
                    providerWindowStart: this.state.authProviderWindowStart,
                    providerSearchQuery: this.state.authProviderSearchQuery,
                    isSearchingProviders: this.state.isSearchingAuthProviders,
                    activeProviderName:
                        this.state.authProviders[this.state.authProviderSelectedIndex]?.label ||
                        this.state.selectedProvider,
                    apiKeyInput: this.state.authApiKeyInput,
                    keyError: this.state.authKeyError,
                    menuSelectedIndex: this.state.authMenuSelectedIndex,
                })
            }
        }

        // Diff and flush to stdout
        this.screen.render()
    }
}
