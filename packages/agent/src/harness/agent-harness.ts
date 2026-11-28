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
    /**
     * Rule files read by the caller. A cloud run reads AGENTS.md / CLAUDE.md from the
     * repository in the sandbox and passes them here: the harness does not look on the disk.
     */
    projectRules?: DiscoveredRuleFile[]
    /**
     * false: do not read skills or rules from this machine's disk (the workspace and the
     * home folder). A cloud run sets it, because the worker's disk is not the user's
     * repository and its home folder must never reach a user's run.
     */
    localDiscovery?: boolean
    availableSecrets?: string[]
    lean?: boolean
}

export class AgentHarness {
    private agent: Agent
    private config: HarnessConfig
    private skills: DiscoveredSkill[]
    private rules: { path: string; content: string }[]
    private effectiveTools: Tool[]

    constructor(config: HarnessConfig) {
        this.config = config
        const localDiscovery = config.localDiscovery !== false

        // 1. discover structured skills
        this.skills = localDiscovery
            ? new SkillDiscoveryEngine({
                  workspaceDir: config.workspaceDir,
                  homeDir: config.homeDir,
              }).discoverAllSkills()
            : []

        // 2. project rules: the ones the caller read, or climb from the workspace to the root
        this.rules =
            config.projectRules ??
            (localDiscovery ? discoverProjectRules(config.workspaceDir, config.rootBoundary) : [])

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
            lean: config.lean,
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
            lean: this.config.lean,
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

    public updateThinkingLevel(thinkingLevel: string): string {
        this.config.thinkingLevel = thinkingLevel as any
        if (this.config.modelOptions) {
            this.config.modelOptions.thinkingLevel = thinkingLevel
        }
        this.agent.thinkingLevel = thinkingLevel as any
        if (this.agent.modelOptions) {
            this.agent.modelOptions.thinkingLevel = thinkingLevel
        }
        return this.refreshSystemPrompt()
    }

    public getDiscoveredSkills(): DiscoveredSkill[] {
        return this.skills
    }

    public getAgent(): Agent {
        return this.agent
    }
}
