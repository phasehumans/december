import { SkillDiscoveryEngine } from '@december/shared'
import { discoverProjectRules, type DiscoveredRuleFile } from '@december/shared'

import { Agent } from '../agent'
import {
    DEFAULT_TOOL_PROMPTS,
    isReasoningModel,
    isCompactModel,
    getModelTier,
    getModelFamily,
    getModelFamilyPrompt,
    buildDynamicToolGuidelines,
    assembleSystemPrompt,
} from '../prompts'
import { createRunSkillTool } from '../skills/run-skill-tool'
import { InvokeSubagentTool, ManageSubagentTool } from '../subagent/subagent-tool'

import type { AgentConfig } from '../agent'
import type { Tool, DiscoveredSkill } from '@december/shared'

export {
    DEFAULT_TOOL_PROMPTS,
    isReasoningModel,
    isCompactModel,
    getModelTier,
    getModelFamily,
    getModelFamilyPrompt,
    buildDynamicToolGuidelines,
    assembleSystemPrompt,
}

export { discoverProjectRules, type DiscoveredRuleFile }

export interface HarnessConfig extends Omit<AgentConfig, 'systemPrompt'> {
    baseSystemPrompt?: string
    workspaceDir: string
    homeDir?: string
    rootBoundary?: string
    userRules?: string
    availableSecrets?: string[]
}

export class AgentHarness {
    private agent: Agent
    private config: HarnessConfig
    private skills: DiscoveredSkill[]
    private rules: { path: string; content: string }[]
    private effectiveTools: Tool[]

    constructor(config: HarnessConfig) {
        this.config = config

        // 1. discover structured skills
        const skillEngine = new SkillDiscoveryEngine({
            workspaceDir: config.workspaceDir,
            homeDir: config.homeDir,
        })
        this.skills = skillEngine.discoverAllSkills()

        // 2. discover project rules climbing from workspace directory to root
        this.rules = discoverProjectRules(config.workspaceDir, config.rootBoundary)

        this.effectiveTools = [...config.tools]
        if (this.skills.length > 0 && !this.effectiveTools.some((t) => t.name === 'run_skill')) {
            this.effectiveTools.push(createRunSkillTool(() => this.skills))
        }
        if (!this.effectiveTools.some((t) => t.name === 'invoke_subagent')) {
            this.effectiveTools.push(InvokeSubagentTool)
        }
        if (!this.effectiveTools.some((t) => t.name === 'manage_subagent')) {
            this.effectiveTools.push(ManageSubagentTool)
        }

        // 3. assemble final system prompt with model-specific dispatch and dynamic tool guidelines
        const finalPrompt = assembleSystemPrompt({
            baseSystemPrompt: config.baseSystemPrompt,
            workspaceDir: config.workspaceDir,
            tools: this.effectiveTools,
            modelOptions: config.modelOptions,
            thinkingLevel: config.thinkingLevel,
            skills: this.skills,
            rules: this.rules,
            userRules: config.userRules,
            availableSecrets: config.availableSecrets,
        })

        // 4. initialize core agent
        this.agent = new Agent({
            ...config,
            tools: this.effectiveTools,
            systemPrompt: finalPrompt,
        })

        // 5. listen for dynamically activated tools to update system prompt guidelines
        this.agent.setOnToolActivated(() => {
            this.refreshSystemPrompt()
        })
    }

    public static async create(config: HarnessConfig): Promise<AgentHarness> {
        return new AgentHarness(config)
    }

    public refreshSystemPrompt(): string {
        const finalPrompt = assembleSystemPrompt({
            baseSystemPrompt: this.config.baseSystemPrompt,
            workspaceDir: this.config.workspaceDir,
            tools: this.agent.getTools(),
            modelOptions: this.config.modelOptions,
            thinkingLevel: this.config.thinkingLevel,
            skills: this.skills,
            rules: this.rules,
            userRules: this.config.userRules,
            availableSecrets: this.config.availableSecrets,
        })
        this.agent.setSystemPrompt(finalPrompt)
        return finalPrompt
    }

    public updateModel(model: string, thinkingLevel?: string): string {
        this.config.modelOptions = {
            ...this.config.modelOptions,
            model,
            ...(thinkingLevel !== undefined ? { thinkingLevel } : {}),
        }
        if (thinkingLevel !== undefined) {
            this.config.thinkingLevel = thinkingLevel as any
        }
        this.agent.updateModel(model, thinkingLevel)
        return this.refreshSystemPrompt()
    }

    public getDiscoveredSkills(): DiscoveredSkill[] {
        return this.skills
    }

    public getAgent(): Agent {
        return this.agent
    }
}
