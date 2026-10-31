import { exec } from 'node:child_process'
import * as os from 'node:os'

import { writeToClipboard } from '../utils/clipboard'
import { fetchGitStatusFiles, type DiffFileEntry, parseUnifiedDiffToRows } from '../utils/diff'

import { DifferentialScreen } from './screen'
import { TerminalController } from './terminal'
import { CommandMenuView, WINDOW_SIZE as CMD_WINDOW_SIZE } from './views/command-menu-view'
import { ContextMenuView } from './views/context-menu-view'
import { DiffViewMenuView, DIFF_WINDOW_SIZE } from './views/diff-view-menu-view'
import { HeaderView } from './views/header-view'
import { HelpMenuView } from './views/help-menu-view'
import { InputBarView } from './views/input-bar-view'
import { MessageListView, type MessageItem } from './views/message-list-view'
import {
    ModelSelectMenuView,
    MODEL_WINDOW_SIZE,
    type ModelItem,
    DEFAULT_MODELS,
} from './views/model-select-menu-view'
import { SettingsMenuView, type SettingItem } from './views/settings-menu-view'
import { SkillsMenuView, loadWorkspaceSkills, type SkillItem } from './views/skills-menu-view'
import { TasksModeMenuView, type TaskItem } from './views/tasks-mode-menu-view'

import type { DifferentialScreenOptions } from './types'
import type { ReleaseAnnouncement } from '../constants/announcements'

export type OverlayType =
    | 'none'
    | 'help'
    | 'model'
    | 'diff'
    | 'tasks'
    | 'settings'
    | 'context'
    | 'skills'

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
    onSubmit?: (prompt: string) => void
    onExit?: () => void
    onModelSelect?: (model: ModelItem) => void
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

            tasks: options?.tasks || [],
            tasksSelectedIndex: 0,
            tasksWindowStart: 0,

            settingsSelectedIndex: 0,
            settings: DEFAULT_SETTINGS,

            skillsSelectedIndex: 0,
            skillsWindowStart: 0,
            skills: options?.skills || loadWorkspaceSkills(),
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

        // Esc: Close overlay, cancel exit confirm, or clear input
        if (key === '\x1b') {
            if (this.state.showExitConfirm) {
                this.state.showExitConfirm = false
                this.render()
                return
            }

            if (this.state.activeOverlay !== 'none') {
                if (this.state.activeOverlay === 'diff' && this.state.isDiffDetailView) {
                    this.state.isDiffDetailView = false
                    this.render()
                    return
                }
                if (this.state.activeOverlay === 'model' && this.state.isModelSearching) {
                    this.state.isModelSearching = false
                    this.render()
                    return
                }
                this.state.activeOverlay = 'none'
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

        // Handle Command Menu Navigation when input starts with '/'
        if (this.state.input.startsWith('/')) {
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

            // Enter: Execute command
            if (key === '\r' || key === '\n') {
                if (filtered.length > 0) {
                    const sel =
                        filtered[Math.min(this.state.commandSelectedIndex, filtered.length - 1)]
                    if (sel) {
                        this.executeCommand(sel.name)
                        return
                    }
                }
                // Unknown command starting with /
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

        // Enter: Submit prompt
        if (key === '\r' || key === '\n') {
            if (this.state.input.trim()) {
                this.submitPrompt()
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
            this.render()
        }
    }

    private resetCommandSelection(): void {
        this.state.commandSelectedIndex = 0
        this.state.commandWindowStart = 0
    }

    executeCommand(name: string): void {
        const cmd = name.toLowerCase().trim()
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

        if (cmd === 'help' || cmd === 'shortcuts') {
            this.state.activeOverlay = 'help'
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
        const nextIdx = (this.state.diffSelectedIndex + delta + files.length) % files.length
        this.state.diffSelectedIndex = nextIdx
        this.state.diffScrollOffset = 0
        this.state.diffCursorLineIndex = 0
        if (nextIdx < this.state.diffWindowStart) {
            this.state.diffWindowStart = nextIdx
        } else if (nextIdx >= this.state.diffWindowStart + DIFF_WINDOW_SIZE) {
            this.state.diffWindowStart = Math.max(0, nextIdx - DIFF_WINDOW_SIZE + 1)
        }
        this.render()
    }

    private handleOverlayKey(key: string): void {
        const overlay = this.state.activeOverlay

        if (overlay === 'help') {
            if (key === '\r' || key === '\n' || key === ' ' || key === 'q') {
                this.state.activeOverlay = 'none'
                this.render()
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
                // Cycle files with Left / Right arrow
                if (key === '\x1b[D') {
                    this.cycleDiffFile(-1)
                    return
                }
                if (key === '\x1b[C') {
                    this.cycleDiffFile(1)
                    return
                }

                // Next / Prev change hunk with n / p
                const currentFile = files[this.state.diffSelectedIndex]
                if (currentFile) {
                    const parsed = parseUnifiedDiffToRows(currentFile.diff || '')
                    if (key === 'n' && parsed.changeIndices.length > 0) {
                        const nextHunk = parsed.changeIndices.find(
                            (idx) => idx > this.state.diffScrollOffset
                        )
                        if (nextHunk !== undefined) {
                            this.state.diffScrollOffset = nextHunk
                            this.render()
                        }
                        return
                    }
                    if (key === 'p' && parsed.changeIndices.length > 0) {
                        const prevHunk = [...parsed.changeIndices]
                            .reverse()
                            .find((idx) => idx < this.state.diffScrollOffset)
                        if (prevHunk !== undefined) {
                            this.state.diffScrollOffset = prevHunk
                            this.render()
                        }
                        return
                    }
                }

                if (key === '\x1b[A' || key === 'k') {
                    this.state.diffScrollOffset = Math.max(0, this.state.diffScrollOffset - 1)
                    this.render()
                    return
                }
                if (key === '\x1b[B' || key === 'j') {
                    this.state.diffScrollOffset += 1
                    this.render()
                    return
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

            if (key === '\x1b[B' || key === 'j') {
                if (this.state.diffSelectedIndex < files.length - 1) {
                    this.state.diffSelectedIndex += 1
                    if (
                        this.state.diffSelectedIndex >=
                        this.state.diffWindowStart + DIFF_WINDOW_SIZE
                    ) {
                        this.state.diffWindowStart =
                            this.state.diffSelectedIndex - DIFF_WINDOW_SIZE + 1
                    }
                    this.render()
                }
                return
            }

            if (key === '\r' || key === '\n' || key === '\x1b[C') {
                if (files.length > 0) {
                    this.state.isDiffDetailView = true
                    this.state.diffScrollOffset = 0
                    this.state.diffCursorLineIndex = 0
                    this.render()
                }
                return
            }
            return
        }

        if (overlay === 'tasks') {
            const tasks = this.state.tasks
            if (key === '\x1b[A' || key === 'k') {
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
            if (key === 'k') {
                const currentTask = tasks[this.state.tasksSelectedIndex]
                if (currentTask && currentTask.status === 'running') {
                    currentTask.status = 'failed'
                    this.showToast(`Killed task: ${currentTask.command}`, 'info')
                }
                return
            }
        }
    }

    submitPrompt(overridePrompt?: string): void {
        const text = (overridePrompt ?? this.state.input).trim()
        if (!text) return

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

    render(): void {
        const width = this.screen.columns
        const height = this.screen.rows

        this.screen.backBuffer.clear()

        // 1. Render Multi-Line Brand Header
        const headerHeight = HeaderView.getHeight({
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

        // 2. Render Input Bar at bottom (4 rows)
        const inputHeight = InputBarView.getHeight()
        const inputY = Math.max(headerHeight, height - inputHeight)

        // 3. Check for Floating Command Menu
        let commandMenuHeight = 0
        const isCommandMenuVisible =
            this.state.activeOverlay === 'none' && this.state.input.startsWith('/')
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

        // 4. Render Main Body (Overlay View OR Message List)
        const bodyY = headerHeight
        const bodyHeight = Math.max(
            1,
            inputY - bodyY - (isCommandMenuVisible ? commandMenuHeight : 0)
        )

        if (this.state.activeOverlay === 'help') {
            HelpMenuView.render(this.screen.backBuffer, {
                x: 0,
                y: bodyY,
                width,
                height: bodyHeight,
            })
        } else if (this.state.activeOverlay === 'settings') {
            SettingsMenuView.render(this.screen.backBuffer, {
                x: 0,
                y: bodyY,
                width,
                height: bodyHeight,
                selectedIndex: this.state.settingsSelectedIndex,
                settings: this.state.settings,
            })
        } else if (this.state.activeOverlay === 'context') {
            ContextMenuView.render(this.screen.backBuffer, {
                x: 0,
                y: bodyY,
                width,
                height: bodyHeight,
                activeModel: this.state.activeModel,
                modelLabel: this.state.modelLabel,
                contextTokens: this.state.contextTokens,
                maxContextTokens: this.state.maxContextTokens,
                messageCount: this.state.messages.length,
            })
        } else if (this.state.activeOverlay === 'skills') {
            SkillsMenuView.render(this.screen.backBuffer, {
                x: 0,
                y: bodyY,
                width,
                height: bodyHeight,
                selectedIndex: this.state.skillsSelectedIndex,
                windowStart: this.state.skillsWindowStart,
                skills: this.state.skills,
            })
        } else if (this.state.activeOverlay === 'model') {
            ModelSelectMenuView.render(this.screen.backBuffer, {
                x: 0,
                y: bodyY,
                width,
                height: bodyHeight,
                models: this.state.models,
                activeModel: this.state.activeModel,
                selectedIndex: this.state.modelSelectedIndex,
                windowStart: this.state.modelWindowStart,
                searchQuery: this.state.modelSearchQuery,
                isSearching: this.state.isModelSearching,
            })
        } else if (this.state.activeOverlay === 'diff') {
            DiffViewMenuView.render(this.screen.backBuffer, {
                x: 0,
                y: bodyY,
                width,
                height: bodyHeight,
                files: this.state.diffFiles,
                selectedFileIndex: this.state.diffSelectedIndex,
                windowStart: this.state.diffWindowStart,
                isDetailView: this.state.isDiffDetailView,
                detailScrollOffset: this.state.diffScrollOffset,
                cursorLineIndex: this.state.diffCursorLineIndex,
            })
        } else if (this.state.activeOverlay === 'tasks') {
            TasksModeMenuView.render(this.screen.backBuffer, {
                x: 0,
                y: bodyY,
                width,
                height: bodyHeight,
                tasks: this.state.tasks,
                selectedTaskIndex: this.state.tasksSelectedIndex,
                windowStart: this.state.tasksWindowStart,
            })
        } else {
            // Normal message list view
            const { maxScroll } = MessageListView.render(this.screen.backBuffer, {
                x: 0,
                y: bodyY,
                width,
                height: bodyHeight,
                messages: this.state.messages,
                scrollOffset: this.state.scrollOffset,
            })
            this.maxScroll = maxScroll
        }

        // 5. Render Input Bar
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

        // Update terminal cursor position
        this.screen.setCursor(cursor.x, cursor.y, cursor.visible)

        // Diff and flush to stdout
        this.screen.render()
    }
}
