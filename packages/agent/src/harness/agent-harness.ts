import { Agent } from '../agent'
import type { AgentConfig } from '../agent'

export interface HarnessConfig extends Omit<AgentConfig, 'systemPrompt'> {
    baseSystemPrompt?: string
    workspaceDir: string
}

export class AgentHarness {
    private agent: Agent
    private config: HarnessConfig

    constructor(config: HarnessConfig) {
        this.config = config

        // 1. Discover Skills
        const skills = this.discoverSkills()

        // 2. Parse potential slash commands and adjust prompt
        const { systemPrompt } = this.parseSlashCommands(
            config.baseSystemPrompt || 'You are an autonomous software engineer.'
        )

        // 3. Assemble final system prompt with skills
        const finalPrompt = `${systemPrompt}\n\nAvailable Skills:\n${skills.join('\n')}`

        // 4. Initialize Core Agent
        this.agent = new Agent({
            ...config,
            systemPrompt: finalPrompt,
        })
    }

    private discoverSkills(): string[] {
        // TODO: Implement actual SKILL.md parsing from this.config.workspaceDir/.december/skills
        return ['- basic_skill: Use specific guidelines when writing code.']
    }

    private parseSlashCommands(prompt: string): { systemPrompt: string } {
        // TODO: Implement slash command matching and templating
        return { systemPrompt: prompt }
    }

    public getAgent(): Agent {
        return this.agent
    }
}
