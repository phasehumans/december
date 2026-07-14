export interface Environment {
    bash: {
        exec: (
            command: string,
            onData: (chunk: string) => void
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
    ui: {
        askQuestion: (
            questions: Array<{ question: string; options: string[]; is_multi_select?: boolean }>
        ) => Promise<string>
        requestPermission?: (toolCall: any) => Promise<{ block: boolean; reason?: string }>
    }
}
