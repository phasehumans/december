export type Role = 'system' | 'user' | 'assistant' | 'tool' | string

import type { Environment } from './environment'

export interface ToolExecuteContext {
    operations: Environment
    env: Map<string, string>
    onStream: (chunk: string) => void
    signal?: AbortSignal
    agent?: any
    deferredRegistry?: any
    activateTool?: (toolName: string) => boolean
}
export interface Message {
    role: Role
    content: string
    toolCalls?: ToolCall[]
    toolCallId?: string
    toolName?: string
    thinking?: string
    thoughtSignature?: string
    thoughtProvider?: string
}

export interface AgentMessage extends Message {
    id?: string
    parentId?: string
    isUI?: boolean
    errorMessage?: string
    timestamp?: number
    displayText?: string
}

export interface ToolCall {
    id: string
    name: string
    input: string // the raw json string or parsed object
    thoughtSignature?: string
}

export interface ToolResult {
    toolCallId: string
    result: string
    error?: string
}

export interface Tool<TInput = any> {
    name: string
    description: string
    inputSchema: any
    /** Set for tools that come from an MCP server, so a UI can name the server */
    mcp?: { server: string; tool: string }
    executionMode?: 'sequential' | 'parallel'
    prepareArguments?: (args: any) => any
    execute: (input: TInput, context: ToolExecuteContext) => Promise<string>
}

export interface AgentHooks {
    beforeToolCall?: (toolCall: ToolCall) => Promise<{ block?: boolean; reason?: string } | void>
    afterToolCall?: (
        toolCall: ToolCall,
        result: ToolResult
    ) => Promise<{ result?: string; error?: string } | void>
    shouldStopAfterTurn?: () => Promise<boolean>
    /**
     * Runs when the agent is about to end its turn (no more tool calls). Returning
     * `{ continue: true, message }` adds `message` as a user message and keeps going.
     */
    beforeStop?: () => Promise<{ continue?: boolean; message?: string } | void>
    getSteeringMessages?: () => Promise<AgentMessage[]>
    prepareNextTurn?: () => Promise<{ modelOptions?: any; systemPrompt?: string } | void>
}

// event stream types (the async generator yields these)

export interface AgentStartEvent {
    type: 'AgentStart'
}

export interface TurnStartEvent {
    type: 'TurnStart'
    initialStatus?: string
}

export interface StreamChunkEvent {
    type: 'StreamChunk'
    content: string
}

export interface ThinkingChunkEvent {
    type: 'ThinkingChunk'
    content: string
}

export interface ToolCallStartEvent {
    type: 'ToolCallStart'
    toolCall: ToolCall
    /** MCP server and original tool name, when the tool comes from an MCP server */
    mcpServer?: string
    mcpTool?: string
}

export interface ToolExecutionUpdateEvent {
    type: 'ToolExecutionUpdate'
    toolCallId: string
    chunk: string
}

export interface ToolCallResultEvent {
    type: 'ToolCallResult'
    result: ToolResult
}

export interface TurnEndEvent {
    type: 'TurnEnd'
}

export interface AgentStatusEvent {
    type: 'AgentStatus'
    message: string
}

/** A provider call failed and the loop retries it; sent next to the AgentStatus text */
export interface AgentRetryEvent {
    type: 'AgentRetry'
    attempt: number
    maxAttempts?: number
    /** Wait before the next attempt, when the loop backs off */
    delayMs?: number
    /** Short reason, e.g. "Opus 5.5 rate limit" */
    reason: string
}

export interface AgentUsageEvent {
    type: 'AgentUsage'
    promptTokens: number
    completionTokens: number
    cacheCreationInputTokens?: number
    cacheReadInputTokens?: number
    /** true when promptTokens does not include the cache read and cache write tokens */
    promptTokensExcludeCache?: boolean
    model?: string
}

export interface AgentEndEvent {
    type: 'AgentEnd'
}

export interface AgentErrorEvent {
    type: 'AgentError'
    error: string
    cause?: string
    hint?: string
    code?: string
    model?: string
    fallbackModel?: string
    provider?: string
}

export interface ContextCompactedEvent {
    type: 'ContextCompacted'
    summary: string
    /** estimated tokens of the conversation before and after compaction */
    tokensBefore?: number
    tokensAfter?: number
}

export interface TerminalDataEvent {
    type: 'TerminalData'
    taskId: string
    chunk: string
}

export interface FileModifiedEvent {
    type: 'FileModified'
    path: string
    diff?: string
}

export interface AgentInterruptEvent {
    type: 'AgentInterrupt'
}

export type AgentEvent =
    | AgentStartEvent
    | TurnStartEvent
    | StreamChunkEvent
    | ThinkingChunkEvent
    | ToolCallStartEvent
    | ToolExecutionUpdateEvent
    | ToolCallResultEvent
    | TurnEndEvent
    | AgentEndEvent
    | AgentErrorEvent
    | AgentInterruptEvent
    | AgentStatusEvent
    | AgentRetryEvent
    | AgentUsageEvent
    | ContextCompactedEvent
    | TerminalDataEvent
    | FileModifiedEvent

export interface WireAgentEvent {
    type: string
    data: unknown
}

export function toWire(event: AgentEvent): WireAgentEvent {
    return {
        type: event.type,
        data: event,
    }
}

export function fromWire(wireEvent: WireAgentEvent): AgentEvent {
    return wireEvent.data as AgentEvent
}

export interface RequestLogToolEntry {
    name: string
    description?: string
    inputSchema?: any
    tokens: number
}

export interface RequestLogRuleEntry {
    path?: string
    content: string
    tokens: number
}

export interface RequestLogSystemPromptDecomposition {
    basePrompt: string
    basePromptTokens: number
    rules: RequestLogRuleEntry[]
    rulesText: string
    rulesTokens: number
    skills: string[]
    skillsText: string
    skillsTokens: number
    dynamicEnv: string
    dynamicEnvTokens: number
    totalTokens: number
}

export interface ContextDecomposition {
    model: string
    maxTokens: number
    basePrompt: {
        text: string
        tokens: number
    }
    rules: {
        files: RequestLogRuleEntry[]
        text: string
        tokens: number
    }
    skills: {
        items: string[]
        text: string
        tokens: number
    }
    dynamicEnv: {
        text: string
        tokens: number
    }
    tools: {
        tools: RequestLogToolEntry[]
        tokens: number
    }
    conversationHistory: {
        userTokens: number
        assistantTokens: number
        toolTokens: number
        totalTokens: number
    }
    totalTokens: number
    freeTokens: number
    cacheableStaticPrefixTokens: number
}

export interface DecomposeContextOptions {
    agent?: any
    systemPrompt?: string
    tools?: any[] | Map<string, any>
    messages?: any[]
    model?: string
    maxTokens?: number
}
