import type { Tool } from '@december/shared'

export interface DeferredToolMetadata {
    category?: string
    keywords?: string[]
}

interface RegisteredDeferredTool {
    tool: Tool
    metadata: DeferredToolMetadata
}

export class DeferredToolRegistry {
    private tools: Map<string, RegisteredDeferredTool> = new Map()

    public register(tool: Tool, metadata: DeferredToolMetadata = {}): void {
        this.tools.set(tool.name, { tool, metadata })
    }

    public unregister(toolName: string): void {
        this.tools.delete(toolName)
    }

    public has(toolName: string): boolean {
        return this.tools.has(toolName)
    }

    public get(toolName: string): Tool | undefined {
        return this.tools.get(toolName)?.tool
    }

    public getAll(): Tool[] {
        return Array.from(this.tools.values()).map((entry) => entry.tool)
    }

    public getAllWithMetadata(): { tool: Tool; metadata: DeferredToolMetadata }[] {
        return Array.from(this.tools.values())
    }

    public search(query: string, options?: { limit?: number; category?: string }): Tool[] {
        const limit = options?.limit ?? 5
        const targetCategory = options?.category?.toLowerCase().trim()
        const queryTokens = query
            .toLowerCase()
            .split(/[\s,_\-:/]+/)
            .filter(Boolean)

        if (queryTokens.length === 0) {
            return this.getAll().slice(0, limit)
        }

        const scored: { tool: Tool; score: number }[] = []

        for (const { tool, metadata } of this.tools.values()) {
            if (targetCategory && metadata.category?.toLowerCase() !== targetCategory) {
                continue
            }

            let score = 0
            const toolName = tool.name.toLowerCase()
            const toolDesc = (tool.description || '').toLowerCase()
            const toolKeywords = (metadata.keywords || []).map((k) => k.toLowerCase())
            const toolCategory = (metadata.category || '').toLowerCase()

            // Exact tool name match is highest priority
            if (toolName === query.toLowerCase().trim()) {
                score += 100
            } else if (toolName.includes(query.toLowerCase().trim())) {
                score += 50
            }

            for (const token of queryTokens) {
                if (toolName.includes(token)) {
                    score += 20
                }
                if (toolKeywords.some((kw) => kw.includes(token))) {
                    score += 15
                }
                if (toolCategory.includes(token)) {
                    score += 10
                }
                if (toolDesc.includes(token)) {
                    score += 5
                }
            }

            if (score > 0) {
                scored.push({ tool, score })
            }
        }

        scored.sort((a, b) => b.score - a.score)
        return scored.slice(0, limit).map((s) => s.tool)
    }
}

export const defaultDeferredRegistry = new DeferredToolRegistry()
