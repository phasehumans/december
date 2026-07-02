import fs from 'node:fs/promises'
import path from 'node:path'
import { Message, Tool } from './types'
import { LLMProvider } from '@december/providers'

import { AgentOperations } from './operations'

export interface AgentConfig {
    sessionId?: string
    systemPrompt?: string
    tools: Tool[]
    llm: LLMProvider
    operations: AgentOperations
    modelOptions?: Record<string, any>
}

export class Agent {
    public messages: Message[] = []
    public tools: Map<string, Tool> = new Map()
    public systemPrompt: string
    public llm: LLMProvider
    public sessionId: string
    public sessionDir: string
    public operations: AgentOperations
    public env: Map<string, string>
    public modelOptions?: Record<string, any>

    constructor(config: AgentConfig) {
        this.llm = config.llm
        this.systemPrompt = config.systemPrompt || 'You are a helpful autonomous software engineer.'
        this.sessionId = config.sessionId || 'default'
        this.sessionDir = path.join(process.cwd(), '.december', 'sessions')
        this.operations = config.operations
        this.env = new Map<string, string>()
        this.modelOptions = config.modelOptions

        for (const tool of config.tools) {
            this.tools.set(tool.name, tool)
        }

        // Initialize with system prompt
        this.messages.push({
            role: 'system',
            content: this.systemPrompt,
        })
    }

    public setLLM(llm: LLMProvider) {
        this.llm = llm
    }

    public addMessage(message: Message) {
        this.messages.push(message)
    }

    public async saveContext() {
        await fs.mkdir(this.sessionDir, { recursive: true })
        const historyPath = path.join(this.sessionDir, `${this.sessionId}.jsonl`)
        const content = this.messages.map((m) => JSON.stringify(m)).join('\n')
        await fs.writeFile(historyPath, content, 'utf-8')
    }

    public async loadContext(sessionId?: string) {
        if (sessionId) this.sessionId = sessionId
        const historyPath = path.join(this.sessionDir, `${this.sessionId}.jsonl`)
        try {
            const data = await fs.readFile(historyPath, 'utf-8')
            const lines = data.split('\n').filter((l) => l.trim().length > 0)
            this.messages = lines.map((l) => JSON.parse(l))
        } catch (e) {
            // No history found
        }
    }
}
