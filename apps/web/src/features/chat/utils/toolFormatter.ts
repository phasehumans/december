export function toPascalCase(str: string): string {
    if (!str) return ''
    return str
        .replace(/^[_\s\-.:]+|[_\s\-.:]+$/g, '')
        .split(/[_\-\s.:]+/)
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join('')
}

export function getToolSummary(name: string, inputStrOrObj: any): string {
    const fallbackName = toPascalCase(name) || name
    let args: any = {}
    if (typeof inputStrOrObj === 'string') {
        try {
            args = JSON.parse(inputStrOrObj || '{}')
        } catch {
            args = {}
        }
    } else if (inputStrOrObj && typeof inputStrOrObj === 'object') {
        args = inputStrOrObj
    }

    const path =
        args.TargetFile ||
        args.AbsolutePath ||
        args.filePath ||
        args.filepath ||
        args.path ||
        args.file ||
        ''

    switch (name) {
        case 'read_file':
        case 'view_file':
            return `Read(${path})`.trim()
        case 'write_file':
        case 'write_to_file':
            return `Create(${path})`.trim()
        case 'edit_file':
        case 'edit_diff':
        case 'replace_file_content':
        case 'multi_replace_file_content':
            return `Edit(${path})`.trim()
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
        case 'write_artifact': {
            const rawPath = args.filePath || args.path || args.title || ''
            return `Artifact(${rawPath})`.trim()
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
        case 'generate_image':
            return `GenerateImage(${args.ImageName || ''})`.trim()
        case 'send_message':
            return `SendMessage(${args.Recipient || ''})`.trim()
        case 'schedule':
            return `Schedule(${args.Prompt || ''})`.trim()
        default:
            return `${fallbackName}()`
    }
}

export function getToolActionLabel(name: string): string {
    switch (name) {
        case 'read_file':
        case 'view_file':
            return 'Reading...'
        case 'write_file':
        case 'write_to_file':
            return 'Writing...'
        case 'edit_file':
        case 'edit_diff':
        case 'replace_file_content':
        case 'multi_replace_file_content':
            return 'Modifying...'
        case 'bash':
        case 'run_command':
            return 'Executing...'
        case 'find_files':
        case 'grep_search':
            return 'Searching codebase...'
        case 'search_web':
            return 'Searching web...'
        case 'list_dir':
            return 'Listing directory...'
        case 'ask_question':
            return 'Asking question...'
        case 'manage_task':
            return 'Managing tasks...'
        case 'manage_subagent':
            return 'Managing subagents...'
        case 'write_artifact':
            return 'Writing artifact...'
        case 'browser':
        case 'browser_action':
            return 'Browsing...'
        case 'manage_memory':
            return 'Managing memory...'
        case 'code_intelligence':
            return 'Analyzing code...'
        case 'run_skill':
            return 'Running skill...'
        case 'generate_image':
            return 'Generating image...'
        case 'send_message':
            return 'Sending message...'
        case 'schedule':
            return 'Scheduling timer...'
        default:
            return 'Working...'
    }
}

export function isNoOutputTool(name: string): boolean {
    return (
        name === 'read_file' ||
        name === 'view_file' ||
        name === 'ask_permission' ||
        name === 'list_permissions'
    )
}
