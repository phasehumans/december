import { AskQuestionTool } from './ask_question'
import { BashTool } from './bash'
import { BrowserTool } from './browser'
import { BrowserActionTool } from './browser_action'
import { CodeIntelligenceTool } from './code_intelligence'
import { defaultDeferredRegistry } from './deferred-registry'
import { EditFileTool } from './edit'
import { EditDiffTool } from './edit_diff'
import { FindFilesTool } from './find'
import { GrepSearchTool } from './grep'
import { LsTool } from './ls'
import { ManageMemoryTool } from './manage_memory'
import { ManageTaskTool } from './manage_task'
import { ReadFileTool } from './read'
import { SearchToolsTool } from './search_tools'
import { WebSearchTool } from './web_search'
import { EnterWorktreeTool, ExitWorktreeTool } from './worktree'
import { WriteFileTool } from './write'
import { WriteArtifactTool } from './write_artifact'

export * from './worktree'
export * from './artifacts/artifact-types'
export * from './artifacts/artifact-manager'
export * from './write_artifact'

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

export const CORE_TOOLS = [
    BashTool,
    ReadFileTool,
    WriteFileTool,
    LsTool,
    EditFileTool,
    EditDiffTool,
    FindFilesTool,
    GrepSearchTool,
    AskQuestionTool,
    SearchToolsTool,
    CodeIntelligenceTool,
    ManageMemoryTool,
    EnterWorktreeTool,
    ExitWorktreeTool,
    WriteArtifactTool,
]

export const DEFERRED_TOOLS = [ManageTaskTool, BrowserTool, BrowserActionTool, WebSearchTool]

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
