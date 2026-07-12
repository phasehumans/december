export type Role = 'system' | 'user' | 'assistant' | 'tool' | string

import { AgentOperations } from './operations'

export interface ToolExecuteContext {
    operations: AgentOperations
    env: Map<string, string>
    onStream: (chunk: string) => void
    spawnSubagent: (prompt: string) => Promise<string>
    signal?: AbortSignal
}
export interface Message {
    role: Role
    content: string
    // Optional fields for tracking tool calls in the message history
    toolCalls?: ToolCall[]
    toolCallId?: string
}

export interface AgentMessage extends Message {
    isUI?: boolean
    errorMessage?: string
    timestamp?: number
}

export interface ToolCall {
    id: string
    name: string
    input: string // The raw JSON string or parsed object
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
    getSteeringMessages?: () => Promise<AgentMessage[]>
    prepareNextTurn?: () => Promise<{ modelOptions?: any; systemPrompt?: string } | void>
}

// Event Stream Types (The Async Generator Yields These)

export interface AgentStartEvent {
    type: 'AgentStart'
}

export interface TurnStartEvent {
    type: 'TurnStart'
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

export interface AgentUsageEvent {
    type: 'AgentUsage'
    promptTokens: number
    completionTokens: number
}

export interface AgentEndEvent {
    type: 'AgentEnd'
}

export interface AgentErrorEvent {
    type: 'AgentError'
    error: string
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
    | AgentStatusEvent
    | AgentUsageEvent
