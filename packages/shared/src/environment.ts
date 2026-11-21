export interface DiagnosticItem {
    filePath: string
    line?: number
    column?: number
    message: string
    severity?: 'error' | 'warning' | 'info'
    source?: string
}

export interface DiagnosticsOperations {
    getDiagnostics: (filePath?: string) => Promise<DiagnosticItem[] | string>
}

export interface LocationItem {
    filePath: string
    line: number
    column: number
    preview?: string
}

export interface OutlineItem {
    name: string
    kind: string
    line: number
    column: number
    containerName?: string
}

export interface LspOperations {
    getDefinition?: (
        filePath: string,
        line: number,
        column: number
    ) => Promise<LocationItem[] | LocationItem | null>
    getReferences?: (filePath: string, line: number, column: number) => Promise<LocationItem[]>
    getOutline?: (filePath: string) => Promise<OutlineItem[]>
    getDiagnostics?: (filePath?: string) => Promise<DiagnosticItem[] | string>
    shutdown?: () => Promise<void>
}

export interface Environment {
    bash: {
        exec: (
            command: string,
            cwd: string,
            options: {
                onData: (chunk: string | Buffer) => void
                signal?: AbortSignal
                timeout?: number
                env?: NodeJS.ProcessEnv
                /** start the command as a background task right away */
                runInBackground?: boolean
            }
        ) => Promise<{ exitCode: number | null; output: string; taskId?: string }>

        getTaskStatus?: (taskId: string) => Promise<TaskStatusResult>
        killTask?: (taskId: string) => Promise<boolean>
        listTasks?: () => Promise<BackgroundTaskInfo[]>
        readTaskOutput?: (taskId: string, filter?: string) => Promise<TaskOutputResult>
    }
    fs: {
        readFile: (path: string) => Promise<string>
        writeFile: (path: string, content: string) => Promise<void>
        readdir: (path: string) => Promise<string[]>
    }
    search: {
        find: (path: string, query: string) => Promise<string>
        grep: (path: string, query: string) => Promise<string>
    }
    env: {
        cwd: () => string
        get: (key: string) => string | undefined
        setCwd?: (dir: string) => void
    }
    ui: {
        askQuestion: (
            questions: Array<{ question: string; options: string[]; is_multi_select?: boolean }>
        ) => Promise<string>
        requestPermission?: (toolCall: any) => Promise<{ block: boolean; reason?: string }>
        reviewArtifact?: (
            artifact: any
        ) => Promise<{ action: 'proceed' | 'refine' | 'reject'; feedback?: string }>
    }
    browser?: BrowserOperations
    diagnostics?: DiagnosticsOperations
    lsp?: LspOperations
    subagentTracker?: SubagentTaskTracker
}

/** a background shell or subagent, as reported to the agent */
export interface BackgroundTaskInfo {
    id: string
    type: 'shell' | 'subagent'
    command: string
    status: 'running' | 'completed' | 'failed' | 'killed'
    exitCode?: number | null
    pid?: number
    role?: string
    depth?: number
    /** subagents: turns started so far */
    turns?: number
    elapsedMs: number
}

export interface TaskStatusResult extends Omit<Partial<BackgroundTaskInfo>, 'status'> {
    status: string
    output: string
}

export interface TaskOutputResult {
    status: string
    exitCode?: number | null
    /** output written since the last read (only matching lines when filtered) */
    output: string
    /** characters dropped from memory before they could be read */
    missedChars?: number
}

export interface SubagentTaskTracker {
    registerSubagentTask: (options: {
        id?: string
        role: string
        task: string
        depth?: number
        /** false when the parent agent waits for the result itself */
        background?: boolean
        abortController?: AbortController
        onKill?: () => void
    }) => { id: string }
    appendOutput: (id: string, chunk: string) => void
    /** live progress: the turn the subagent is on now */
    setTurns?: (id: string, turns: number) => void
    markCompleted: (id: string, exitCode: number) => void
    getTask?: (id: string) => any
    killTask?: (id: string) => boolean
}

export interface BrowserNavigateResult {
    text: string
    vncUrl?: string
    error?: string
    consoleErrors?: string[]
    networkErrors?: string[]
}

export interface BrowserActionInput {
    action: 'navigate' | 'click' | 'type' | 'screenshot' | 'get_console_errors'
    url?: string
    selector?: string
    text?: string
    fullPage?: boolean
}

export interface BrowserActionResult {
    success: boolean
    action: string
    output?: string
    text?: string
    screenshotPath?: string
    screenshotBase64?: string
    consoleErrors?: string[]
    networkErrors?: string[]
    error?: string
}

export interface BrowserOperations {
    navigate: (url: string) => Promise<BrowserNavigateResult>
    action?: (params: BrowserActionInput) => Promise<BrowserActionResult>
    close?: () => Promise<void>
}
