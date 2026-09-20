import { AskQuestionTool } from './ask_question'
import { BashTool } from './bash'
import { BrowserTool } from './browser'
import { defaultDeferredRegistry } from './deferred-registry'
import { EditFileTool } from './edit'
import { EditDiffTool } from './edit_diff'
import { FindFilesTool } from './find'
import { GrepSearchTool } from './grep'
import { LsTool } from './ls'
import { ManageTaskTool } from './manage_task'
import { ReadFileTool } from './read'
import { SearchToolsTool } from './search_tools'
import { WebSearchTool } from './web_search'
import { WriteFileTool } from './write'

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
export * from './browser'
export * from './web_search'
export * from './diff_preview'
export * from './fuzzy_patch'
export * from './deferred-registry'
export * from './search_tools'
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
]

export const DEFERRED_TOOLS = [ManageTaskTool, BrowserTool, WebSearchTool]

// Pre-register standard deferred tools in defaultDeferredRegistry
defaultDeferredRegistry.register(BrowserTool, {
    category: 'web',
    keywords: ['browser', 'render', 'html', 'scrape', 'page', 'url', 'browse', 'webpage'],
})
defaultDeferredRegistry.register(WebSearchTool, {
    category: 'web',
    keywords: ['search', 'google', 'duckduckgo', 'tavily', 'internet', 'docs', 'websearch'],
})
defaultDeferredRegistry.register(ManageTaskTool, {
    category: 'task',
    keywords: ['task', 'background', 'kill', 'status', 'process', 'pid', 'manage_task'],
})
