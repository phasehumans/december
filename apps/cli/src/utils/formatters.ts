export function getToolSummary(name: string, inputStr: string): string {
    try {
        const args = JSON.parse(inputStr || '{}')
        switch (name) {
            case 'read_file':
                return `Read(${args.filePath || args.path || ''})`.trim()
            case 'write_file':
                return `Create(${args.filePath || args.path || ''})`.trim()
            case 'edit_file':
            case 'edit_diff':
                return `Edit(${args.filePath || args.path || ''})`.trim()
            case 'list_dir':
                return `List(${args.dirPath || args.path || ''})`.trim()
            case 'bash':
                return `Bash(${args.command || ''})`.trim()
            case 'find_files':
                return `Search(${args.pattern || args.query || ''})`.trim()
            case 'grep_search':
                return `Search(${args.pattern || args.query || ''})`.trim()
            case 'subagent':
                return `Subagent()`
            default:
                return `${name}()`
        }
    } catch {
        return `${name}()`
    }
}
