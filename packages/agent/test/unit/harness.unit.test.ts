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
        expect(systemPrompt).toContain('Inspect Logs & Stack Traces First')
        expect(systemPrompt).toContain('Root Cause Resolution')
        expect(systemPrompt).toContain('Execution & Verification')
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

    test('uses DEFAULT_BASE_SYSTEM_PROMPT when baseSystemPrompt is omitted', () => {
        const harness = new AgentHarness({
            llm: new MockLLM(),
            tools: [],
            operations: {} as any,
            workspaceDir: tmpDir,
        })

        const systemPrompt = harness.getAgent().systemPrompt
        expect(systemPrompt).toContain('You are December, an autonomous, expert coding agent.')
        expect(systemPrompt).toContain('Inspect Logs & Stack Traces First')
        expect(systemPrompt).toContain('Root Cause Resolution')
        expect(systemPrompt).toContain('No Raw Code In Chat')
        expect(systemPrompt).toContain('Strict Workspace Boundary')
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

    test('suppresses <thought> tags instruction for native reasoning models (o3, deepseek-r1, claude thinking)', () => {
        const o3Harness = new AgentHarness({
            llm: new MockLLM(),
            tools: [],
            operations: {} as any,
            workspaceDir: tmpDir,
            modelOptions: { model: 'o3-mini' },
        })

        const o3Prompt = o3Harness.getAgent().systemPrompt
        expect(o3Prompt).not.toContain('<thought>')
        expect(o3Prompt).toContain('Autonomous Reasoning & Verification')
        expect(o3Prompt).toContain('Persistent Problem Solving')
        expect(o3Prompt).toContain('Comprehensive Verification')

        const claudeThinkingHarness = new AgentHarness({
            llm: new MockLLM(),
            tools: [],
            operations: {} as any,
            workspaceDir: tmpDir,
            modelOptions: { model: 'claude-3-7-sonnet-20250219', thinkingLevel: 'high' },
        })
        const claudeThinkingPrompt = claudeThinkingHarness.getAgent().systemPrompt
        expect(claudeThinkingPrompt).not.toContain('<thought>')
    })

    test('specializes prompt for Anthropic with objectivity and task breakdown', () => {
        const anthropicHarness = new AgentHarness({
            llm: new MockLLM(),
            tools: [],
            operations: {} as any,
            workspaceDir: tmpDir,
            modelOptions: { model: 'claude-3-5-sonnet-20241022' },
        })

        const prompt = anthropicHarness.getAgent().systemPrompt
        expect(prompt).toContain('Anthropic / Claude')
        expect(prompt).toContain('Objectivity & Discipline')
        expect(prompt).toContain('Proactive Task Breakdown')
        expect(prompt).toContain('<thought>')
    })

    test('specializes prompt for Gemini with absolute file path enforcement and operational phases', () => {
        const geminiHarness = new AgentHarness({
            llm: new MockLLM(),
            tools: [],
            operations: {} as any,
            workspaceDir: tmpDir,
            modelOptions: { model: 'gemini-2.5-pro' },
        })

        const prompt = geminiHarness.getAgent().systemPrompt
        expect(prompt).toContain('Model Specialization (Gemini)')
        expect(prompt).toContain('STRICTLY specify absolute file paths')
        expect(prompt).toContain('Structured Execution')
    })

    test('dynamically includes guidelines only for active tools', () => {
        const harnessWithEdit = new AgentHarness({
            llm: new MockLLM(),
            tools: [
                {
                    name: 'edit_file',
                    description: 'edit',
                    inputSchema: {},
                    execute: async () => '',
                },
            ],
            operations: {} as any,
            workspaceDir: tmpDir,
        })

        const promptWithEdit = harnessWithEdit.getAgent().systemPrompt
        expect(promptWithEdit).toContain('multiple entries in edits[]')
        expect(promptWithEdit).not.toContain("Use 'web_search'")

        const harnessWithWeb = new AgentHarness({
            llm: new MockLLM(),
            tools: [
                {
                    name: 'web_search',
                    description: 'web search',
                    inputSchema: {},
                    execute: async () => '',
                },
            ],
            operations: {} as any,
            workspaceDir: tmpDir,
        })

        const promptWithWeb = harnessWithWeb.getAgent().systemPrompt
        expect(promptWithWeb).toContain("Use 'web_search'")
        expect(promptWithWeb).not.toContain('multiple entries in edits[]')
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
        expect(systemPrompt).toContain('Environment Secrets & Variables')
        expect(systemPrompt).toContain('<injected_secrets>')
        expect(systemPrompt).toContain(
            '- $STRIPE_API_KEY (referenced in prompts as @secret:STRIPE_API_KEY or $STRIPE_API_KEY)'
        )
        expect(systemPrompt).toContain(
            '- $DATABASE_URL (referenced in prompts as @secret:DATABASE_URL or $DATABASE_URL)'
        )
    })
})
