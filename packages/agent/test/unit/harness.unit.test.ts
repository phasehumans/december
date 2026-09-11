import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { McpClientPool } from '@december/tools'
import { describe, test, expect, beforeEach, afterEach, mock } from 'bun:test'

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

    test('initializes MCP pool and mounts dynamic tools into agent tool registry', async () => {
        const mockClient = {
            connect: mock(async () => {}),
            listTools: mock(async () => ({
                tools: [
                    {
                        name: 'fetch_data',
                        description: 'Fetch remote data',
                        inputSchema: { type: 'object', properties: { id: { type: 'string' } } },
                    },
                ],
            })),
            callTool: mock(async () => ({ content: [{ type: 'text', text: 'data-result' }] })),
            close: mock(async () => {}),
        }

        const pool = new McpClientPool({
            clientFactory: () => mockClient as any,
        })

        const harness = await AgentHarness.create({
            llm: new MockLLM(),
            tools: [],
            operations: {} as any,
            workspaceDir: tmpDir,
            mcpPool: pool,
            mcpConfig: {
                mcpServers: {
                    api_server: { command: 'node', args: ['server.js'] },
                },
            },
        })

        const agent = harness.getAgent()
        expect(agent.mcpPool).toBe(pool)
        expect(agent.tools.has('api_server__fetch_data')).toBe(true)

        const dynamicTool = agent.tools.get('api_server__fetch_data')
        expect(dynamicTool).toBeDefined()
        expect(dynamicTool?.description).toBe('Fetch remote data')

        const output = await dynamicTool?.execute({ id: '123' }, {} as any)
        expect(output).toBe('data-result')

        // Test reloadMCP cleanly unregisters old tools and syncs new tools without zombie entries
        const mockClientV2 = {
            connect: mock(async () => {}),
            listTools: mock(async () => ({
                tools: [
                    {
                        name: 'query_v2',
                        description: 'New tool',
                        inputSchema: {},
                    },
                ],
            })),
            callTool: mock(async () => ({ content: [{ type: 'text', text: 'v2' }] })),
            close: mock(async () => {}),
        }

        const poolV2 = new McpClientPool({
            clientFactory: () => mockClientV2 as any,
        })
        const harnessV2 = new AgentHarness({
            llm: new MockLLM(),
            tools: [],
            operations: {} as any,
            workspaceDir: tmpDir,
            mcpPool: poolV2,
        })

        await harnessV2.initMCP({
            mcpServers: {
                test_srv: { command: 'node' },
            },
        })

        const agentV2 = harnessV2.getAgent()
        expect(agentV2.tools.has('test_srv__query_v2')).toBe(true)

        // Reload with disabled server - old tool should be pruned immediately
        await harnessV2.reloadMCP({
            mcpServers: {
                test_srv: { command: 'node', disabled: true },
            },
        })

        expect(agentV2.tools.has('test_srv__query_v2')).toBe(false)
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
})
