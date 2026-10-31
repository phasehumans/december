import path from 'node:path'

export function toRelativePath(filePath: string, cwd: string = process.cwd()): string {
    if (!filePath) return ''
    const trimmed = filePath.trim()
    if (!path.isAbsolute(trimmed)) return trimmed
    const rel = path.relative(cwd, trimmed)
    if (rel === '') {
        return '.'
    }
    if (rel.startsWith('..')) {
        return trimmed
    }
    return rel
}

export function toPascalCase(str: string): string {
    if (!str) return ''
    return str
        .replace(/^[_\s\-.:]+|[_\s\-.:]+$/g, '')
        .split(/[_\-\s.:]+/)
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join('')
}

export function getToolSummary(name: string, inputStr: string): string {
    const fallbackName = toPascalCase(name) || name
    try {
        const args = JSON.parse(inputStr || '{}')
        switch (name) {
            case 'read_file':
            case 'view_file': {
                const rawPath =
                    args.AbsolutePath ||
                    args.TargetFile ||
                    args.filePath ||
                    args.filepath ||
                    args.path ||
                    args.file ||
                    ''
                return `Read(${toRelativePath(rawPath)})`.trim()
            }
            case 'write_file':
            case 'write_to_file': {
                const rawPath =
                    args.TargetFile ||
                    args.AbsolutePath ||
                    args.filePath ||
                    args.filepath ||
                    args.path ||
                    args.file ||
                    ''
                return `Create(${toRelativePath(rawPath)})`.trim()
            }
            case 'edit_file':
            case 'edit_diff':
            case 'replace_file_content':
            case 'multi_replace_file_content': {
                const rawPath =
                    args.TargetFile ||
                    args.AbsolutePath ||
                    args.filePath ||
                    args.filepath ||
                    args.path ||
                    args.file ||
                    ''
                return `Edit(${toRelativePath(rawPath)})`.trim()
            }
            case 'list_dir':
            case 'ls': {
                const rawPath =
                    args.DirectoryPath || args.dirPath || args.path || args.directory || ''
                return `ListDir(${toRelativePath(rawPath)})`.trim()
            }
            case 'bash':
            case 'run_command':
                return `Bash(${args.CommandLine || args.command || ''})`.trim()
            case 'find_files':
            case 'grep_search':
            case 'search_code':
            case 'code_search':
                return `Search(${args.Query || args.pattern || args.query || ''})`.trim()
            case 'search_web':
            case 'read_url_content':
                return `WebSearch(${args.query || args.Url || args.url || ''})`.trim()
            case 'ask_question':
                return `AskQuestion()`
            case 'manage_task':
                return `ManageTask(${args.Action || args.action || ''})`.trim()
            case 'manage_subagent': {
                const action = args.action || args.Action || ''
                const target = args.subagentId ? `:${args.subagentId}` : ''
                return `ManageSubagent(${action}${target})`.trim()
            }
            case 'invoke_subagent':
            case 'spawn_subagent': {
                const role = args.role || (args.subagents ? `batch:${args.subagents.length}` : '')
                return `SubAgent(${role})`.trim()
            }
            case 'browser':
            case 'browser_action': {
                const action = args.action || args.actionType || args.url || ''
                return `Browser(${action})`.trim()
            }
            case 'manage_memory': {
                const action = args.action || args.Action || ''
                return `ManageMemory(${action})`.trim()
            }
            case 'code_intelligence': {
                const query = args.symbol || args.query || args.path || ''
                return `CodeIntel(${query})`.trim()
            }
            case 'run_skill': {
                const skill = args.name || args.skill || ''
                return `Skill(${skill})`.trim()
            }
            case 'enter_worktree':
            case 'exit_worktree': {
                const target = args.branch || args.name || ''
                return `Worktree(${target})`.trim()
            }
            case 'generate_image': {
                return `GenerateImage(${args.ImageName || args.prompt || ''})`.trim()
            }
            case 'send_message': {
                return `SendMessage(${args.Recipient || args.recipient || ''})`.trim()
            }
            case 'schedule': {
                return `Schedule(${args.Prompt || args.prompt || ''})`.trim()
            }
            default:
                return `${fallbackName}()`
        }
    } catch {
        // Intentionally swallowed: fallback to PascalCase tool name
        return `${fallbackName}()`
    }
}
