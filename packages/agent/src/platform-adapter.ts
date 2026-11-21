import type {
    BackgroundTaskInfo,
    BrowserOperations,
    DiagnosticsOperations,
    LspOperations,
    SubagentTaskTracker,
    TaskOutputResult,
    TaskStatusResult,
} from '@december/shared'

export interface BashExecOptions {
    onData?: (chunk: string | Buffer) => void
    timeout?: number
    waitMsBeforeAsync?: number
    serverReadyDelayMs?: number
    signal?: AbortSignal
    env?: NodeJS.ProcessEnv
    opId?: string
    taskId?: string
    /** start the command as a background task right away */
    runInBackground?: boolean
}

export interface PlatformAdapter {
    fs: {
        readFile: (path: string) => Promise<string>
        writeFile: (path: string, content: string) => Promise<void>
        readdir: (path: string) => Promise<string[]>
        mkdir: (path: string, options?: { recursive?: boolean }) => Promise<void>
        exists: (path: string) => Promise<boolean>
    }
    bash: {
        exec: (
            command: string,
            cwdOrOnData?: string | ((chunk: string) => void),
            options?: BashExecOptions
        ) => Promise<{ exitCode: number | null; output: string; taskId?: string }>
        getTaskStatus?: (taskId: string) => Promise<TaskStatusResult>
        killTask?: (taskId: string) => Promise<boolean>
        listTasks?: () => Promise<BackgroundTaskInfo[]>
        readTaskOutput?: (taskId: string, filter?: string) => Promise<TaskOutputResult>
    }
    search: {
        find: (path: string, query: string) => Promise<string>
        grep: (path: string, query: string) => Promise<string>
    }
    ui?: {
        askQuestion: (
            questions: Array<{ question: string; options: string[]; is_multi_select?: boolean }>
        ) => Promise<string>
        requestPermission?: (toolCall: any) => Promise<{ block: boolean; reason?: string }>
        reviewArtifact?: (
            artifact: any
        ) => Promise<{ action: 'proceed' | 'refine' | 'reject'; feedback?: string }>
    }
    env: {
        cwd: () => string
        get: (key: string) => string | undefined
        setCwd?: (dir: string) => void
    }
    browser?: BrowserOperations
    diagnostics?: DiagnosticsOperations
    lsp?: LspOperations
    subagentTracker?: SubagentTaskTracker
}
