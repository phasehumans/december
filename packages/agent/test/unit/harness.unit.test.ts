import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { describe, test, expect, beforeEach, afterEach } from 'bun:test'

import { AgentHarness } from '../../src/harness/agent-harness'
import { MockLLM } from '../mock-provider'

describe('AgentHarness (Unit)', () => {
    let tmpDir: string

    beforeEach(() => {
        tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'harness-test-'))
    })

    afterEach(() => {
        fs.rmSync(tmpDir, { recursive: true, force: true })
    })

    test('discovers rules from AGENTS.md, .december/AGENTS.md, and .december/rules.md', () => {
        const decDir = path.join(tmpDir, '.december')
        fs.mkdirSync(decDir, { recursive: true })

        fs.writeFileSync(path.join(tmpDir, 'AGENTS.md'), '# Root Agents Guide\nRules here.')
        fs.writeFileSync(
            path.join(decDir, 'AGENTS.md'),
            '# December Agents Guide\nMore rules here.'
        )
        fs.writeFileSync(path.join(decDir, 'rules.md'), '# Workspace Rules\nSingle rules file.')

        const harness = new AgentHarness({
            llm: new MockLLM(),
            tools: [],
            operations: {} as any,
            workspaceDir: tmpDir,
        })

        const agent = harness.getAgent()
        const systemPrompt = agent.systemPrompt

        expect(systemPrompt).toContain('Root Agents Guide')
        expect(systemPrompt).toContain('December Agents Guide')
        expect(systemPrompt).toContain('Workspace Rules')
        expect(systemPrompt).toContain('<rules>')
        expect(systemPrompt).toContain('Use bash for file operations like ls, rg, find')
    })

    test('passively ingests .december/memory.md under <project_memory> in harness agent prompt', () => {
        const decDir = path.join(tmpDir, '.december')
        fs.mkdirSync(decDir, { recursive: true })
        fs.writeFileSync(path.join(decDir, 'memory.md'), '## conventions\n- use pino logger')

        const harness = new AgentHarness({
            llm: new MockLLM(),
            tools: [],
            operations: {} as any,
            workspaceDir: tmpDir,
        })

        const agent = harness.getAgent()
        expect(agent.systemPrompt).toContain('<project_memory>')
        expect(agent.systemPrompt).toContain('## conventions')
        expect(agent.systemPrompt).toContain('use pino logger')
        expect(agent.systemPrompt).toContain('</project_memory>')
    })

    test('discovers global machine root rules from ~/.december or DECEMBER_CONFIG_DIR', () => {
        const globalDir = path.join(tmpDir, 'global-december')
        fs.mkdirSync(globalDir, { recursive: true })
        fs.writeFileSync(
            path.join(globalDir, 'rules.md'),
            '# Global Machine Rules\nGlobal rules here.'
        )

        const originalConfigDir = process.env.DECEMBER_CONFIG_DIR
        process.env.DECEMBER_CONFIG_DIR = globalDir

        try {
            const harness = new AgentHarness({
                llm: new MockLLM(),
                tools: [],
                operations: {} as any,
                workspaceDir: tmpDir,
            })

            const agent = harness.getAgent()
            expect(agent.systemPrompt).toContain('Global Machine Rules')
        } finally {
            if (originalConfigDir) {
                process.env.DECEMBER_CONFIG_DIR = originalConfigDir
            } else {
                delete process.env.DECEMBER_CONFIG_DIR
            }
        }
    })

    test('discovers structured skills from .december/skills and .agents/skills and injects alphabetized <skills> catalog', () => {
        const decSkillDir = path.join(tmpDir, '.december', 'skills', 'docker-deploy')
        fs.mkdirSync(decSkillDir, { recursive: true })
        fs.writeFileSync(
            path.join(decSkillDir, 'SKILL.md'),
            `---
name: docker-deploy
description: Prepares and builds docker deployments.
argument-hint: '[dev|prod]'
---
# Docker Deploy Instructions`
        )

        const agentsSkillDir = path.join(tmpDir, '.agents', 'skills', 'ponytail')
        fs.mkdirSync(agentsSkillDir, { recursive: true })
        fs.writeFileSync(
            path.join(agentsSkillDir, 'SKILL.md'),
            `---
name: ponytail
description: Forces the laziest solution that actually works.
---
# Ponytail Runbook`
        )

        const harness = new AgentHarness({
            llm: new MockLLM(),
            tools: [],
            operations: {} as any,
            workspaceDir: tmpDir,
            homeDir: path.join(tmpDir, 'mock-home'),
        })

        const discovered = harness.getDiscoveredSkills()
        expect(discovered.length).toBe(2)
        expect(discovered.map((s) => s.name)).toEqual(['docker-deploy', 'ponytail'])

        const systemPrompt = harness.getAgent().systemPrompt
        expect(systemPrompt).toContain('<skills>')
        expect(systemPrompt).toContain('</skills>')
        expect(systemPrompt).toContain('- docker-deploy (')
        expect(systemPrompt).toContain(': Prepares and builds docker deployments.')
        expect(systemPrompt).toContain('- ponytail (')
        expect(systemPrompt).toContain(': Forces the laziest solution that actually works.')

        // Verify raw instructions are not dumped into system prompt (progressive disclosure)
        expect(systemPrompt).not.toContain('# Docker Deploy Instructions')
        expect(systemPrompt).not.toContain('# Ponytail Runbook')

        // Verify prompt cache invariant: <skills> catalog comes before <project_context> and Current date
        const skillsIndex = systemPrompt.indexOf('<skills>')
        const dateIndex = systemPrompt.indexOf('Current date:')
        expect(skillsIndex).toBeGreaterThan(0)
        expect(dateIndex).toBeGreaterThan(skillsIndex)
    })

    test('formats discovered skills with lightweight 1-line descriptions in system prompt', () => {
        const skillDir = path.join(tmpDir, '.december', 'skills', 'verbose-skill')
        fs.mkdirSync(skillDir, { recursive: true })
        fs.writeFileSync(
            path.join(skillDir, 'SKILL.md'),
            `---
name: verbose-skill
description: |
  Summary of verbose skill.
  Here are paragraphs of additional explanations that would bloat the system prompt.
  More lines here.
---
# Body`
        )

        const harness = new AgentHarness({
            llm: new MockLLM(),
            tools: [],
            operations: {} as any,
            workspaceDir: tmpDir,
            homeDir: path.join(tmpDir, 'mock-home'),
        })

        const systemPrompt = harness.getAgent().systemPrompt
        expect(systemPrompt).toContain('- verbose-skill (')
        expect(systemPrompt).toContain(': Summary of verbose skill.')
        expect(systemPrompt).not.toContain('Here are paragraphs of additional explanations')
    })

    test('uses DEFAULT_PI_IDENTITY and DEFAULT_PI_RULES when baseSystemPrompt is omitted', () => {
        const harness = new AgentHarness({
            llm: new MockLLM(),
            tools: [],
            operations: {} as any,
            workspaceDir: tmpDir,
        })

        const systemPrompt = harness.getAgent().systemPrompt
        expect(systemPrompt).toContain('You are an expert coding assistant')
        expect(systemPrompt).toContain('<rules>')
        expect(systemPrompt).toContain('Use bash for file operations like ls, rg, find')
        expect(systemPrompt).toContain('Be concise in your responses')
        expect(systemPrompt).toContain('Show file paths clearly when working with files')
    })

    test('climbs ancestor directories to root collecting rules with root-most rules ordered first', () => {
        const rootDir = tmpDir
        const subDir = path.join(tmpDir, 'packages', 'agent')
        fs.mkdirSync(subDir, { recursive: true })

        fs.writeFileSync(path.join(rootDir, 'AGENTS.md'), '# Root Instructions\nRoot level policy.')
        fs.writeFileSync(
            path.join(subDir, 'AGENTS.md'),
            '# Nested Instructions\nAgent module policy.'
        )

        const harness = new AgentHarness({
            llm: new MockLLM(),
            tools: [],
            operations: {} as any,
            workspaceDir: subDir,
            rootBoundary: rootDir,
        })

        const systemPrompt = harness.getAgent().systemPrompt
        expect(systemPrompt).toContain('Root Instructions')
        expect(systemPrompt).toContain('Nested Instructions')

        const rootPos = systemPrompt.indexOf('Root Instructions')
        const nestedPos = systemPrompt.indexOf('Nested Instructions')
        expect(rootPos).toBeLessThan(nestedPos)
    })

    test('maintains prompt cache stability across different model targets without unnecessary prompt drift', () => {
        const o3Harness = new AgentHarness({
            llm: new MockLLM(),
            tools: [],
            operations: {} as any,
            workspaceDir: tmpDir,
            modelOptions: { model: 'o3-mini' },
        })

        const anthropicHarness = new AgentHarness({
            llm: new MockLLM(),
            tools: [],
            operations: {} as any,
            workspaceDir: tmpDir,
            modelOptions: { model: 'claude-3-5-sonnet-20241022' },
        })

        const o3Prompt = o3Harness.getAgent().systemPrompt
        const anthropicPrompt = anthropicHarness.getAgent().systemPrompt

        expect(o3Prompt).toContain('You are an expert coding assistant')
        expect(o3Prompt).toContain('<rules>')
        expect(anthropicPrompt).toContain('You are an expert coding assistant')
        expect(anthropicPrompt).toContain('<rules>')
    })

    test('keeps dynamic environment context (<cwd> and date) strictly at the end of the prompt', () => {
        const harness = new AgentHarness({
            llm: new MockLLM(),
            tools: [],
            operations: {} as any,
            workspaceDir: tmpDir,
        })

        const prompt = harness.getAgent().systemPrompt
        const rulesIndex = prompt.indexOf('</rules>')
        const cwdIndex = prompt.indexOf('<cwd>')
        const dateIndex = prompt.indexOf('Current date:')

        expect(rulesIndex).toBeGreaterThan(0)
        expect(cwdIndex).toBeGreaterThan(rulesIndex)
        expect(dateIndex).toBeGreaterThan(cwdIndex)
    })

    test('injects userRules into system prompt alongside discovered workspace rules', () => {
        fs.writeFileSync(
            path.join(tmpDir, 'AGENTS.md'),
            '# Workspace Rules\nFollow project architecture.'
        )

        const harness = new AgentHarness({
            llm: new MockLLM(),
            tools: [],
            operations: {} as any,
            workspaceDir: tmpDir,
            userRules: '# User Custom Rules\nAlways prefer TypeScript and concise responses.',
        })

        const systemPrompt = harness.getAgent().systemPrompt
        expect(systemPrompt).toContain('<project_context>')
        expect(systemPrompt).toContain('<project_instructions path="User Custom Rules">')
        expect(systemPrompt).toContain('Always prefer TypeScript and concise responses.')
        expect(systemPrompt).toContain('Follow project architecture.')
    })

    test('does not duplicate userRules if identical content exists in workspace rules', () => {
        const rulesContent = '# Custom Rules\nSame content everywhere.'
        fs.writeFileSync(path.join(tmpDir, 'AGENTS.md'), rulesContent)

        const harness = new AgentHarness({
            llm: new MockLLM(),
            tools: [],
            operations: {} as any,
            workspaceDir: tmpDir,
            userRules: rulesContent,
        })

        const systemPrompt = harness.getAgent().systemPrompt
        const matches = systemPrompt.match(/Same content everywhere\./g)
        expect(matches?.length).toBe(1)
    })

    test('injects availableSecrets into system prompt with instructions on @secret: and $KEY', () => {
        const harness = new AgentHarness({
            llm: new MockLLM(),
            tools: [],
            operations: {} as any,
            workspaceDir: tmpDir,
            availableSecrets: ['STRIPE_API_KEY', 'DATABASE_URL'],
        })

        const systemPrompt = harness.getAgent().systemPrompt
        expect(systemPrompt).toContain('<injected_secrets>')
        expect(systemPrompt).toContain(
            '- $STRIPE_API_KEY (referenced in prompts as @secret:STRIPE_API_KEY or $STRIPE_API_KEY)'
        )
        expect(systemPrompt).toContain(
            '- $DATABASE_URL (referenced in prompts as @secret:DATABASE_URL or $DATABASE_URL)'
        )
    })

    test('automatically injects invoke_subagent and manage_subagent tools', () => {
        const harness = new AgentHarness({
            llm: new MockLLM(),
            tools: [],
            operations: {} as any,
            workspaceDir: tmpDir,
        })

        const agent = harness.getAgent()
        expect(agent.tools.has('invoke_subagent')).toBe(true)
        expect(agent.tools.has('manage_subagent')).toBe(true)
    })
})
