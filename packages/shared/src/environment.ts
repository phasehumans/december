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
            }
        ) => Promise<{ exitCode: number | null; output: string; taskId?: string }>

        getTaskStatus?: (taskId: string) => Promise<{ status: string; output: string }>
        killTask?: (taskId: string) => Promise<boolean>
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
    }
    ui: {
        askQuestion: (
            questions: Array<{ question: string; options: string[]; is_multi_select?: boolean }>
        ) => Promise<string>
        requestPermission?: (toolCall: any) => Promise<{ block: boolean; reason?: string }>
    }
    browser?: BrowserOperations
    diagnostics?: DiagnosticsOperations
    lsp?: LspOperations
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
