import type { Tool } from '@december/shared'

export const DEFAULT_TOOL_PROMPTS: Record<string, { snippet: string; guidelines: string[] }> = {
    grep_search: {
        snippet: 'Exact regex/literal search across files',
        guidelines: [
            "Use 'grep_search' for exact matching of symbols, functions, types, and error strings across files rather than inspecting files one-by-one.",
        ],
    },
    find_files: {
        snippet: 'Find files matching glob patterns',
        guidelines: [
            'Use \'find_files\' with glob patterns (e.g. "**/*.ts") to locate target files efficiently within the workspace.',
        ],
    },
    edit_file: {
        snippet: 'Precise search-and-replace edits including multiple disjoint replacements',
        guidelines: [
            "ALWAYS use 'edit_file' when changing existing files to preserve untouched code and avoid token limits.",
            "When changing multiple separate locations in one file, use one 'edit_file' call with multiple entries in edits[] instead of multiple sequential calls.",
        ],
    },
    edit_diff: {
        snippet: 'Apply unified diff patches',
        guidelines: [
            "Use 'edit_diff' when you have a complete unified diff patch with accurate context lines.",
        ],
    },
    write_file: {
        snippet: 'Create brand new files',
        guidelines: [
            "Use 'write_file' EXCLUSIVELY for creating brand new files. NEVER use 'write_file' to rewrite or modify an existing file.",
        ],
    },
    read_file: {
        snippet: 'Read file contents with line pagination',
        guidelines: [
            "Use 'read_file' to inspect source code and logs. Use startLine and endLine for large files.",
        ],
    },
    bash: {
        snippet: 'Execute shell commands in the terminal',
        guidelines: [
            "Use 'bash' to run builds, tests, linters, and verify changes. Commands will run in the workspace.",
        ],
    },
    manage_task: {
        snippet: 'Monitor and manage background tasks',
        guidelines: ["Use 'manage_task' to monitor, send input to, or stop background processes."],
    },
    web_search: {
        snippet: 'Search web for docs and APIs',
        guidelines: [
            "Use 'web_search' to fetch up-to-date framework docs, library APIs, or external stack traces.",
        ],
    },
    ask_question: {
        snippet: 'Prompt user for interactive decisions',
        guidelines: [
            "Use 'ask_question' when you need user clarification between distinct architectural alternatives.",
        ],
    },
    ls: {
        snippet: 'List directory contents',
        guidelines: ["Use 'ls' to inspect directory contents and structure."],
    },
    search_tools: {
        snippet: 'Search and activate deferred and MCP tools on demand',
        guidelines: [
            "Use 'search_tools' to dynamically discover and activate deferred capabilities (e.g. web search, browser, task management, MCP tools) when needed.",
        ],
    },
    run_skill: {
        snippet: 'Delegate specialized tasks to an isolated skill subagent',
        guidelines: [
            "Use 'run_skill' to delegate complex procedural workflows or specialized domain tasks to an isolated subagent, keeping the main conversation context clean.",
        ],
    },
    manage_memory: {
        snippet: 'Record, read, or prune persistent workspace rules and memories',
        guidelines: [
            "Use 'manage_memory' to record learned conventions, build/test commands, architecture notes, and quirks into persistent workspace memory.",
        ],
    },
    invoke_subagent: {
        snippet: 'Spawn a dynamic subagent with isolated context and workspace delegation',
        guidelines: [
            "Use 'invoke_subagent' to delegate deep exploratory tasks, research, test debugging, or reviews to an isolated subagent with its own fresh context to prevent polluting the primary conversation.",
        ],
    },
    spawn_subagent: {
        snippet: 'Spawn a dynamic subagent with isolated context and workspace delegation',
        guidelines: [
            "Use 'spawn_subagent' to delegate deep exploratory tasks, research, test debugging, or reviews to an isolated subagent.",
        ],
    },
    manage_subagent: {
        snippet: 'Inspect, steer, list, or cancel dynamic subagents',
        guidelines: [
            "Use 'manage_subagent' to monitor running subagents, send steering instructions, view reports, or terminate executions.",
        ],
    },
}

export function buildDynamicToolGuidelines(
    activeTools: Array<Tool | { name: string; description?: string }>
): string {
    if (!activeTools || activeTools.length === 0) return ''

    const lines: string[] = []
    for (const tool of activeTools) {
        const contrib = DEFAULT_TOOL_PROMPTS[tool.name]
        if (contrib) {
            for (const g of contrib.guidelines) {
                if (!lines.includes(`- ${g}`)) {
                    lines.push(`- ${g}`)
                }
            }
        }
    }

    if (lines.length === 0) return ''
    return `### Tool Selection & Guidelines\n${lines.join('\n')}`
}
