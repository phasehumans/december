export type Role = 'system' | 'user' | 'assistant' | 'tool'

import { AgentOperations } from './operations'

export interface ToolExecuteContext {
    operations: AgentOperations
    env: Map<string, string>
    onStream: (chunk: string) => void
    spawnSubagent: (prompt: string) => Promise<string>
}
export interface Message {
    role: Role
    content: string
    // Optional fields for tracking tool calls in the message history
    toolCalls?: ToolCall[]
    toolCallId?: string
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
    // We can use JSON Schema or Zod schemas here. For simplicity in DI, we use a generic schema object or just rely on the LLM to provide JSON.
    inputSchema: any
    execute: (input: TInput, context: ToolExecuteContext) => Promise<string>
}

// Event Stream Types (The Async Generator Yields These)

export interface TurnStartEvent {
    type: 'TurnStart'
}

export interface StreamChunkEvent {
    type: 'StreamChunk'
    content: string
}

export interface ToolCallStartEvent {
    type: 'ToolCallStart'
    toolCall: ToolCall
}

export interface ToolCallResultEvent {
    type: 'ToolCallResult'
    result: ToolResult
}

export interface TurnEndEvent {
    type: 'TurnEnd'
}

export type AgentEvent =
    | TurnStartEvent
    | StreamChunkEvent
    | ToolCallStartEvent
    | ToolCallResultEvent
    | TurnEndEvent
