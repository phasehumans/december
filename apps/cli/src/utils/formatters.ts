import path from 'node:path'

export function toRelativePath(filePath: string, cwd: string = process.cwd()): string {
    if (!filePath) return ''
    const trimmed = filePath.trim()
    if (!path.isAbsolute(trimmed)) return trimmed
    const rel = path.relative(cwd, trimmed)
    if (!rel || rel.startsWith('..')) {
        return trimmed
    }
    return rel
}

export function getToolSummary(name: string, inputStr: string): string {
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
                return `ListDir(${args.DirectoryPath || args.dirPath || args.path || ''})`.trim()
            case 'bash':
            case 'run_command':
                return `Bash(${args.CommandLine || args.command || ''})`.trim()
            case 'find_files':
            case 'grep_search':
                return `Search(${args.Query || args.pattern || args.query || ''})`.trim()
            case 'search_web':
                return `WebSearch(${args.query || ''})`.trim()
            case 'ask_question':
                return `AskQuestion()`
            case 'manage_task':
                return `ManageTask(${args.Action || ''})`.trim()
            default:
                return `${name}()`
        }
    } catch {
        return `${name}()`
    }
}
