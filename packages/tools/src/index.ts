import { BashTool } from './bash'
import { BrowserTool } from './browser'
import { BrowserActionTool } from './browser_action'
import { defaultDeferredRegistry } from './deferred-registry'
import { EditFileTool } from './edit'
import { EditDiffTool } from './edit_diff'
import { ManageMemoryTool } from './manage_memory'
import { ManageTaskTool } from './manage_task'
import { ReadFileTool } from './read'
import { WebSearchTool } from './web_search'
import { EnterWorktreeTool, ExitWorktreeTool } from './worktree'
import { WriteFileTool } from './write'

export * from './worktree'

export * from './bash'
export * from './bash-operations'
export * from './read'
export * from './write'
export * from './ls'
export * from './edit'
export * from './edit_diff'
export * from './find'
export * from './grep'
export * from './ask_question'
export * from './manage_task'
export * from './manage_memory'
export * from './browser'
export * from './browser_action'
export * from './web_search'
export * from './diff_preview'
export * from './fuzzy_patch'
export * from './deferred-registry'
export * from './search_tools'
export * from './code_intelligence'
export * from './mcp'
export * from './snapshot'
export * from './file-mutation-queue'
export { Type, type Static } from '@sinclair/typebox'

export const FOUNDATIONAL_TOOLS = [ReadFileTool, WriteFileTool, EditFileTool, BashTool]

export const CORE_TOOLS = [ReadFileTool, WriteFileTool, EditFileTool, BashTool]

export const DEFERRED_TOOLS = [
    ManageTaskTool,
    BrowserTool,
    BrowserActionTool,
    WebSearchTool,
    EditDiffTool,
]

// Pre-register standard deferred tools in defaultDeferredRegistry
defaultDeferredRegistry.register(BrowserTool, {
    category: 'web',
    keywords: ['browser', 'render', 'html', 'scrape', 'page', 'url', 'browse', 'webpage'],
})
defaultDeferredRegistry.register(BrowserActionTool, {
    category: 'web',
    keywords: [
        'browser_action',
        'click',
        'type',
        'screenshot',
        'dom',
        'test',
        'input',
        'form',
        'ui',
        'localhost',
    ],
})
defaultDeferredRegistry.register(WebSearchTool, {
    category: 'web',
    keywords: ['search', 'google', 'duckduckgo', 'tavily', 'internet', 'docs', 'websearch'],
})
defaultDeferredRegistry.register(ManageTaskTool, {
    category: 'task',
    keywords: ['task', 'background', 'kill', 'status', 'process', 'pid', 'manage_task'],
})
defaultDeferredRegistry.register(ManageMemoryTool, {
    category: 'memory',
    keywords: ['memory', 'rules', 'conventions', 'quirks', 'manage_memory', 'remember', 'forget'],
})
defaultDeferredRegistry.register(EnterWorktreeTool, {
    category: 'git',
    keywords: [
        'worktree',
        'enter_worktree',
        'isolated',
        'sandbox',
        'branch',
        'safe',
        'speculative',
        'refactor',
    ],
})
defaultDeferredRegistry.register(ExitWorktreeTool, {
    category: 'git',
    keywords: ['worktree', 'exit_worktree', 'cleanup', 'keep', 'merge', 'discard', 'restore'],
})
defaultDeferredRegistry.register(EditDiffTool, {
    category: 'editor',
    keywords: ['edit_diff', 'diff', 'patch', 'unified_diff'],
})
