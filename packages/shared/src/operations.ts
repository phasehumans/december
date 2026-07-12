export interface AgentOperations {
    bash: {
        exec: (
            command: string,
            onData: (chunk: string) => void
        ) => Promise<{ exitCode: number | null; output: string }>
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
    askQuestion?: (
        questions: Array<{ question: string; options: string[]; is_multi_select?: boolean }>
    ) => Promise<string>
}
