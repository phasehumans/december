import { Agent } from '@december/agent'
import { Message, AuthMode, PlanWorkflowState, BtwState, CodeSearchResultItem } from '@december/tui'
import { create } from 'zustand'

import { DecemberConfig } from '../config'

import type { SessionInfo } from '../file-session-repository'
import type { BackgroundTask } from '../task-manager'

export interface CliState {
    agent: Agent | null
    setAgent: (agent: Agent) => void
    settings: DecemberConfig | null
    setSettings: (settings: DecemberConfig) => void

    isAuthenticated: boolean
    setIsAuthenticated: (val: boolean) => void
    authMethod: 'byok' | 'december' | 'env' | 'subscription' | undefined
    setAuthMethod: (method: 'byok' | 'december' | 'env' | 'subscription' | undefined) => void
    hasBothAuth: boolean
    setHasBothAuth: (val: boolean) => void
    hasDecember: boolean
    setHasDecember: (val: boolean) => void
    decemberEmail: string | undefined
    setDecemberEmail: (email: string | undefined) => void
    settingsAuthPriority: 'byok' | 'december' | 'subscription'
    setSettingsAuthPriority: (val: 'byok' | 'december' | 'subscription') => void
    currentEmail: string | undefined
    setCurrentEmail: (email: string | undefined) => void
    authMode: AuthMode
    previousAuthMode: AuthMode
    menuStack: AuthMode[]
    setAuthMode: (mode: AuthMode) => void
    helpInitialTab: 'general' | 'commands' | 'shortcuts'
    setHelpInitialTab: (tab: 'general' | 'commands' | 'shortcuts') => void
    memoryInitialTab: 'memory' | 'rules'
    setMemoryInitialTab: (tab: 'memory' | 'rules') => void
    logoutItems: { label: string; value: string }[]
    setLogoutItems: (items: { label: string; value: string }[]) => void
    switchItems: { label: string; value: string; model?: string; isActive?: boolean }[]
    setSwitchItems: (
        items: { label: string; value: string; model?: string; isActive?: boolean }[]
    ) => void
    selectedProvider: string
    setSelectedProvider: (provider: string) => void
    activeModel: string
    setActiveModel: (model: string) => void
    apiKey: string
    setApiKey: (key: string) => void
    authError: string | null
    setAuthError: (err: string | null) => void
    pendingDeviceAuthUrl: string | null
    setPendingDeviceAuthUrl: (url: string | null) => void
    openRouterModels: { label: string; value: string }[]
    setOpenRouterModels: (models: { label: string; value: string }[]) => void
    dynamicModels: { label: string; value: string }[]
    setDynamicModels: (models: { label: string; value: string }[]) => void

    // chat feature
    planWorkflow: PlanWorkflowState
    setPlanWorkflow: (
        workflow: PlanWorkflowState | ((prev: PlanWorkflowState) => PlanWorkflowState)
    ) => void
    interactivePlanGoalMode: boolean
    setInteractivePlanGoalMode: (mode: boolean) => void
    currentPlannedPrompt: string | null
    setCurrentPlannedPrompt: (prompt: string | null) => void
    currentPlanText: string | null
    setCurrentPlanText: (planText: string | null) => void
    currentPlanQAPairs: { question: string; answer: string }[]
    setCurrentPlanQAPairs: (qa: { question: string; answer: string }[]) => void
    planRefineMode: boolean
    setPlanRefineMode: (mode: boolean) => void
    planRefineFeedback: string
    setPlanRefineFeedback: (feedback: string) => void
    grillMode: boolean
    setGrillMode: (mode: boolean) => void
    grillQuestions: { question: string; options: string[] }[]
    setGrillQuestions: (questions: { question: string; options: string[] }[]) => void
    currentGrillIndex: number
    setCurrentGrillIndex: (index: number) => void
    grillAnswers: string[]
    setGrillAnswers: (answers: string[]) => void
    grillPrompt: string | null
    setGrillPrompt: (prompt: string | null) => void
    customInputMode: boolean
    setCustomInputMode: (mode: boolean) => void
    customAnswer: string
    setCustomAnswer: (answer: string) => void
    staticMessages: Message[]
    setStaticMessages: (msgs: Message[] | ((prev: Message[]) => Message[])) => void
    staticKey: number
    setStaticKey: (key: number | ((prev: number) => number)) => void
    activeMessages: Message[]
    setActiveMessages: (msgs: Message[] | ((prev: Message[]) => Message[])) => void
    isStreaming: boolean
    setIsStreaming: (isStreaming: boolean) => void
    queuedPrompts: string[]
    setQueuedPrompts: (prompts: string[] | ((prev: string[]) => string[])) => void
    isInline: boolean
    setIsInline: (isInline: boolean) => void

    // sessions feature
    sessionItems: { label: string; value: string }[]
    setSessionItems: (items: { label: string; value: string }[]) => void
    sessionsData: SessionInfo[]
    setSessionsData: (data: SessionInfo[]) => void
    sessionPage: number
    setSessionPage: (page: number) => void
    sessionSelectedIndex: number
    setSessionSelectedIndex: (index: number) => void
    sessionRenameMode: boolean
    setSessionRenameMode: (mode: boolean) => void
    sessionNewName: string
    setSessionNewName: (name: string) => void

    // rewind
    rewindItems: {
        turnIndex: number
        commitHash: string
        prompt?: string
        timestamp: number
        touchedFiles?: string[]
    }[]
    setRewindItems: (items: any[]) => void

    // settings feature
    settingsPathGuard: boolean
    setSettingsPathGuard: (val: boolean) => void
    settingsNonWorkspace: boolean
    setSettingsNonWorkspace: (val: boolean) => void
    settingsToolPermission: 'always-ask' | 'always-proceed'
    setSettingsToolPermission: (val: 'always-ask' | 'always-proceed') => void
    settingsCompactMode: boolean
    setSettingsCompactMode: (val: boolean) => void
    settingsSoundEffects: boolean
    setSettingsSoundEffects: (val: boolean) => void
    settingsAutoScroll: boolean
    setSettingsAutoScroll: (val: boolean) => void
    settingsStreamSpeed: 'smooth' | 'instant'
    setSettingsStreamSpeed: (val: 'smooth' | 'instant') => void
    settingsSelectedIndex: number
    setSettingsSelectedIndex: (val: number) => void
    settingsThinkingLevel: 'auto' | 'off' | 'minimal' | 'low' | 'medium' | 'high'
    setSettingsThinkingLevel: (val: 'auto' | 'off' | 'minimal' | 'low' | 'medium' | 'high') => void
    settingsSteeringMode: 'all' | 'one-at-a-time'
    setSettingsSteeringMode: (val: 'all' | 'one-at-a-time') => void
    settingsFollowUpMode: 'all' | 'one-at-a-time'
    setSettingsFollowUpMode: (val: 'all' | 'one-at-a-time') => void
    settingsBrowserVisible: boolean
    setSettingsBrowserVisible: (val: boolean) => void

    // tasks feature
    tasksData: BackgroundTask[]
    setTasksData: (data: BackgroundTask[]) => void
    taskSelectedIndex: number
    setTaskSelectedIndex: (index: number | ((prev: number) => number)) => void
    taskViewingId: string | null
    setTaskViewingId: (id: string | null) => void
    taskScrollOffset: number
    setTaskScrollOffset: (offset: number | ((prev: number) => number)) => void

    // interceptors (questions & permissions)
    pendingQuestions: {
        questions: Array<{ question: string; options: string[]; is_multi_select?: boolean }>
        resolve: (answer: string) => void
    } | null
    setPendingQuestions: (pendingQuestions: any) => void
    pendingToolCall: {
        toolCall: any
        resolve: (result: { block: boolean; reason?: string }) => void
    } | null
    setPendingToolCall: (pendingToolCall: any) => void

    toasts: { id: string; message: string; variant?: string }[]
    addToast: (message: string, variant?: string) => void
    removeToast: (id: string) => void
    shouldExit: boolean
    setShouldExit: (shouldExit: boolean) => void

    // btw side question
    btwState: BtwState | null
    setBtwState: (state: BtwState | null | ((prev: BtwState | null) => BtwState | null)) => void

    // code search feature
    codeSearchQuery: string
    setCodeSearchQuery: (query: string) => void
    codeSearchResults: CodeSearchResultItem[]
    setCodeSearchResults: (results: CodeSearchResultItem[]) => void
    prefillPrompt: string | null
    setPrefillPrompt: (prompt: string | null) => void

    // file view feature
    fileViewTarget: {
        filePath: string
        initialLine?: number
        returnAuthMode?: AuthMode
        returnQuery?: string
    } | null
    setFileViewTarget: (
        target: {
            filePath: string
            initialLine?: number
            returnAuthMode?: AuthMode
            returnQuery?: string
        } | null
    ) => void

    // artifact review feature
    pendingArtifactReview: {
        artifact: any
        resolve: (result: any) => void
    } | null
    setPendingArtifactReview: (pendingArtifactReview: any) => void
}

export const useCliStore = create<CliState>((set) => ({
    // core
    agent: null,
    setAgent: (agent) => set({ agent }),
    settings: null,
    setSettings: (settings) => set({ settings }),

    // auth
    isAuthenticated: false,
    setIsAuthenticated: (isAuthenticated) => set({ isAuthenticated }),
    authMethod: undefined,
    setAuthMethod: (authMethod) => set({ authMethod }),
    hasBothAuth: false,
    setHasBothAuth: (hasBothAuth) => set({ hasBothAuth }),
    hasDecember: false,
    setHasDecember: (hasDecember) => set({ hasDecember }),
    decemberEmail: undefined,
    setDecemberEmail: (decemberEmail) => set({ decemberEmail }),
    settingsAuthPriority: 'byok',
    setSettingsAuthPriority: (settingsAuthPriority) => set({ settingsAuthPriority }),
    currentEmail: undefined,
    setCurrentEmail: (currentEmail) => set({ currentEmail }),
    helpInitialTab: 'general',
    setHelpInitialTab: (helpInitialTab) => set({ helpInitialTab }),
    memoryInitialTab: 'memory',
    setMemoryInitialTab: (memoryInitialTab) => set({ memoryInitialTab }),
    authMode: 'none',
    previousAuthMode: 'none',
    menuStack: [],
    setAuthMode: (authMode) =>
        set((state) => {
            if (authMode === 'none') {
                return {
                    authMode: 'none',
                    previousAuthMode: 'none',
                    menuStack: [],
                }
            }
            if (state.authMode === authMode) {
                return { authMode }
            }
            const existingIdx = state.menuStack.lastIndexOf(authMode)
            if (existingIdx !== -1) {
                const nextStack = state.menuStack.slice(0, existingIdx)
                const prev = nextStack.length > 0 ? nextStack[nextStack.length - 1] : 'none'
                return {
                    authMode,
                    previousAuthMode: prev,
                    menuStack: nextStack,
                }
            }
            const nextStack =
                state.authMode !== 'none' ? [...state.menuStack, state.authMode] : state.menuStack
            return {
                authMode,
                previousAuthMode: state.authMode,
                menuStack: nextStack,
            }
        }),
    logoutItems: [],
    setLogoutItems: (logoutItems) => set({ logoutItems }),
    switchItems: [],
    setSwitchItems: (switchItems) => set({ switchItems }),
    selectedProvider: '',
    setSelectedProvider: (selectedProvider) => set({ selectedProvider }),
    activeModel: '',
    setActiveModel: (activeModel) => set({ activeModel }),
    apiKey: '',
    setApiKey: (apiKey) => set({ apiKey }),
    authError: null,
    setAuthError: (authError) => set({ authError }),
    pendingDeviceAuthUrl: null,
    setPendingDeviceAuthUrl: (pendingDeviceAuthUrl) => set({ pendingDeviceAuthUrl }),
    openRouterModels: [],
    setOpenRouterModels: (openRouterModels) => set({ openRouterModels }),
    dynamicModels: [],
    setDynamicModels: (dynamicModels) => set({ dynamicModels }),

    // chat
    planWorkflow: { phase: 'idle' },
    setPlanWorkflow: (updater) =>
        set((state) => ({
            planWorkflow: typeof updater === 'function' ? updater(state.planWorkflow) : updater,
        })),
    interactivePlanGoalMode: false,
    setInteractivePlanGoalMode: (interactivePlanGoalMode) => set({ interactivePlanGoalMode }),
    currentPlannedPrompt: null,
    setCurrentPlannedPrompt: (currentPlannedPrompt) => set({ currentPlannedPrompt }),
    currentPlanText: null,
    setCurrentPlanText: (currentPlanText) => set({ currentPlanText }),
    currentPlanQAPairs: [],
    setCurrentPlanQAPairs: (currentPlanQAPairs) => set({ currentPlanQAPairs }),
    planRefineMode: false,
    setPlanRefineMode: (planRefineMode) => set({ planRefineMode }),
    planRefineFeedback: '',
    setPlanRefineFeedback: (planRefineFeedback) => set({ planRefineFeedback }),
    grillMode: false,
    setGrillMode: (grillMode) => set({ grillMode }),
    grillQuestions: [],
    setGrillQuestions: (grillQuestions) => set({ grillQuestions }),
    currentGrillIndex: 0,
    setCurrentGrillIndex: (currentGrillIndex) => set({ currentGrillIndex }),
    grillAnswers: [],
    setGrillAnswers: (grillAnswers) => set({ grillAnswers }),
    grillPrompt: null,
    setGrillPrompt: (grillPrompt) => set({ grillPrompt }),
    customInputMode: false,
    setCustomInputMode: (customInputMode) => set({ customInputMode }),
    customAnswer: '',
    setCustomAnswer: (customAnswer) => set({ customAnswer }),
    staticMessages: [{ id: 'header', role: 'header' }],
    setStaticMessages: (updater) =>
        set((state) => ({
            staticMessages: typeof updater === 'function' ? updater(state.staticMessages) : updater,
        })),
    staticKey: 0,
    setStaticKey: (updater) =>
        set((state) => ({
            staticKey: typeof updater === 'function' ? updater(state.staticKey) : updater,
        })),
    activeMessages: [],
    setActiveMessages: (updater) =>
        set((state) => ({
            activeMessages: typeof updater === 'function' ? updater(state.activeMessages) : updater,
        })),
    isStreaming: false,
    setIsStreaming: (isStreaming) => set({ isStreaming }),
    queuedPrompts: [],
    setQueuedPrompts: (updater) =>
        set((state) => ({
            queuedPrompts: typeof updater === 'function' ? updater(state.queuedPrompts) : updater,
        })),
    isInline: false,
    setIsInline: (isInline) => set({ isInline }),

    // sessions
    sessionItems: [],
    setSessionItems: (sessionItems) => set({ sessionItems }),
    sessionsData: [],
    setSessionsData: (sessionsData) => set({ sessionsData }),
    sessionPage: 0,
    setSessionPage: (sessionPage) => set({ sessionPage }),
    sessionSelectedIndex: 0,
    setSessionSelectedIndex: (sessionSelectedIndex) => set({ sessionSelectedIndex }),
    sessionRenameMode: false,
    setSessionRenameMode: (sessionRenameMode) => set({ sessionRenameMode }),
    sessionNewName: '',
    setSessionNewName: (sessionNewName) => set({ sessionNewName }),

    // rewind
    rewindItems: [],
    setRewindItems: (rewindItems) => set({ rewindItems }),

    // settings feature
    settingsPathGuard: true,
    setSettingsPathGuard: (settingsPathGuard) => set({ settingsPathGuard }),
    settingsNonWorkspace: false,
    setSettingsNonWorkspace: (settingsNonWorkspace) => set({ settingsNonWorkspace }),
    settingsToolPermission: 'always-proceed',
    setSettingsToolPermission: (settingsToolPermission) => set({ settingsToolPermission }),
    settingsCompactMode: false,
    setSettingsCompactMode: (settingsCompactMode) => set({ settingsCompactMode }),
    settingsSoundEffects: false,
    setSettingsSoundEffects: (settingsSoundEffects) => set({ settingsSoundEffects }),
    settingsAutoScroll: true,
    setSettingsAutoScroll: (settingsAutoScroll) => set({ settingsAutoScroll }),
    settingsStreamSpeed: 'smooth',
    setSettingsStreamSpeed: (settingsStreamSpeed) => set({ settingsStreamSpeed }),
    settingsSelectedIndex: 0,
    setSettingsSelectedIndex: (settingsSelectedIndex) => set({ settingsSelectedIndex }),
    settingsThinkingLevel: 'auto',
    setSettingsThinkingLevel: (settingsThinkingLevel) => set({ settingsThinkingLevel }),
    settingsSteeringMode: 'all',
    setSettingsSteeringMode: (settingsSteeringMode) => set({ settingsSteeringMode }),
    settingsFollowUpMode: 'all',
    setSettingsFollowUpMode: (settingsFollowUpMode) => set({ settingsFollowUpMode }),
    settingsBrowserVisible: true,
    setSettingsBrowserVisible: (settingsBrowserVisible) => set({ settingsBrowserVisible }),

    // tasks
    tasksData: [],
    setTasksData: (tasksData) => set({ tasksData }),
    taskSelectedIndex: 0,
    setTaskSelectedIndex: (updater) =>
        set((state) => ({
            taskSelectedIndex:
                typeof updater === 'function' ? updater(state.taskSelectedIndex) : updater,
        })),
    taskViewingId: null,
    setTaskViewingId: (taskViewingId) => set({ taskViewingId }),
    taskScrollOffset: 0,
    setTaskScrollOffset: (updater) =>
        set((state) => ({
            taskScrollOffset:
                typeof updater === 'function' ? updater(state.taskScrollOffset) : updater,
        })),

    // interceptors
    pendingQuestions: null,
    setPendingQuestions: (pendingQuestions) => set({ pendingQuestions }),
    pendingToolCall: null,
    setPendingToolCall: (pendingToolCall) => set({ pendingToolCall }),

    // cli events
    toasts: [],
    addToast: (message, variant = 'info') => {
        const id = Date.now().toString() + Math.random().toString()
        set((state) => ({
            toasts: [...state.toasts, { id, message, variant }],
        }))
        setTimeout(() => {
            set((state) => ({ toasts: state.toasts.filter((t: any) => t.id !== id) }))
        }, 3000)
    },
    removeToast: (id) => set((state) => ({ toasts: state.toasts.filter((t: any) => t.id !== id) })),
    shouldExit: false,
    setShouldExit: (shouldExit) => set({ shouldExit }),

    // btw side question
    btwState: null,
    setBtwState: (updater) =>
        set((state) => ({
            btwState: typeof updater === 'function' ? updater(state.btwState) : updater,
        })),

    // code search feature
    codeSearchQuery: '',
    setCodeSearchQuery: (codeSearchQuery) => set({ codeSearchQuery }),
    codeSearchResults: [],
    setCodeSearchResults: (codeSearchResults) => set({ codeSearchResults }),
    prefillPrompt: null,
    setPrefillPrompt: (prefillPrompt) => set({ prefillPrompt }),

    // file view feature
    fileViewTarget: null,
    setFileViewTarget: (fileViewTarget) => set({ fileViewTarget }),

    // artifact review feature
    pendingArtifactReview: null,
    setPendingArtifactReview: (pendingArtifactReview) => set({ pendingArtifactReview }),
}))
