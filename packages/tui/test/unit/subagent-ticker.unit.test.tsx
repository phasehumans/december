import { describe, expect, it } from 'bun:test'
import { render } from 'ink-testing-library'
import React from 'react'

import { BotMessage } from '../../src/components/messages/bot-message'
import {
    SubagentTickerView,
    parseSubagentStream,
    extractRollupData,
} from '../../src/components/messages/subagent-ticker'

describe('SubAgent Ticker View (Unit)', () => {
    describe('parseSubagentStream & extractRollupData', () => {
        it('parses structured stream lines with tool calls and turn numbers', () => {
            const stream = [
                '[SubAgent:d1:researcher] starting: analyze API routes',
                '[SubAgent:d1:researcher] thinking: checking route definitions',
                '[SubAgent:d1:researcher] tool: read_file(src/server.ts) (turn 2)',
            ].join('\n')

            const parsed = parseSubagentStream(stream, 'researcher', 1)
            expect(parsed.role).toBe('researcher')
            expect(parsed.depth).toBe(1)
            expect(parsed.action.kind).toBe('tool')
            expect(parsed.action.toolName).toBe('read_file')
            expect(parsed.action.toolArgs).toBe('(src/server.ts)')
            expect(parsed.action.turn).toBe(2)
        })

        it('parses thinking stream chunks correctly', () => {
            const stream = '[SubAgent:d2:db-specialist] thinking: optimizing query plan'
            const parsed = parseSubagentStream(stream, 'db-specialist', 2)
            expect(parsed.role).toBe('db-specialist')
            expect(parsed.depth).toBe(2)
            expect(parsed.action.kind).toBe('thinking')
            expect(parsed.action.text).toBe('optimizing query plan')
        })

        it('extracts rollup data from completed report', () => {
            const report = [
                '### [SubAgent: researcher (subagent-123)] - COMPLETED',
                '- **Role**: researcher',
                '- **Depth**: 1',
                '- **Total Turns**: 4',
                '- **Tool Calls**: 5',
                '- **Duration**: 2.4s',
                '',
                '#### Rollup Summary & Findings:',
                'Identified 8 REST endpoints in routes.ts; added rate limiting.',
            ].join('\n')

            const rollup = extractRollupData(report)
            expect(rollup.duration).toBe('2.4s')
            expect(rollup.turns).toBe(4)
            expect(rollup.toolsCount).toBe(5)
            expect(rollup.summaryBrief).toContain('Identified 8 REST endpoints')
            expect(rollup.error).toBeUndefined()
        })
    })

    describe('SubagentTickerView rendering', () => {
        it('renders running SubAgent ticker with role, depth, active tool, and zero emojis', () => {
            const stream =
                '[SubAgent:d1:backend-researcher] tool: read_file(src/server.ts) (turn 1)\n'
            const { lastFrame } = render(
                <SubagentTickerView
                    toolName="invoke_subagent"
                    toolInput={JSON.stringify({ role: 'backend-researcher', task: 'audit' })}
                    output={stream}
                    status="running"
                />
            )
            const frame = lastFrame() || ''
            expect(frame).toContain('SubAgent')
            expect(frame).toContain('backend-researcher:d1')
            expect(frame).toContain('tool:')
            expect(frame).toContain('read_file')
            expect(frame).toContain('(turn 1)')
            // Zero emojis check
            expect(frame).not.toMatch(/[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u)
        })

        it('renders running SubAgent with model override and worktree tag', () => {
            const stream = '[SubAgent:d2:tester] tool: bash("bun test") (turn 3)\n'
            const { lastFrame } = render(
                <SubagentTickerView
                    toolName="invoke_subagent"
                    toolInput={JSON.stringify({
                        role: 'tester',
                        depth: 2,
                        model: 'claude-3-5-haiku',
                        workspace: 'worktree',
                    })}
                    output={stream}
                    status="running"
                />
            )
            const frame = lastFrame() || ''
            expect(frame).toContain('SubAgent')
            expect(frame).toContain('tester:d2')
            expect(frame).toContain('claude-3-5-haiku')
            expect(frame).toContain('(worktree)')
            expect(frame).toContain('bash')
            expect(frame).not.toMatch(/[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u)
        })

        it('renders completed SubAgent ticker with metrics and findings without emojis', () => {
            const report = [
                '### [SubAgent: researcher (subagent-1)] - COMPLETED',
                '- **Role**: researcher',
                '- **Depth**: 1',
                '- **Total Turns**: 3',
                '- **Tool Calls**: 4',
                '- **Duration**: 2.8s',
                '',
                '#### Rollup Summary & Findings:',
                'All database indexes successfully created and verified.',
            ].join('\n')

            const { lastFrame } = render(
                <SubagentTickerView
                    toolName="invoke_subagent"
                    toolInput={JSON.stringify({ role: 'researcher' })}
                    output={report}
                    status="success"
                />
            )
            const frame = lastFrame() || ''
            expect(frame).toContain('SubAgent')
            expect(frame).toContain('researcher:d1')
            expect(frame).toContain('done in 2.8s')
            expect(frame).toContain('3 turns')
            expect(frame).toContain('4 tools')
            expect(frame.replace(/\s+/g, ' ')).toContain(
                'All database indexes successfully created'
            )
            expect(frame).not.toMatch(/[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u)
        })

        it('renders failed SubAgent ticker cleanly without emojis', () => {
            const report = [
                '### [SubAgent: deployer (subagent-fail)] - FAILED',
                '- **Role**: deployer',
                '- **Depth**: 1',
                '**Error**: Connection refused to redis:6379',
            ].join('\n')

            const { lastFrame } = render(
                <SubagentTickerView
                    toolName="invoke_subagent"
                    toolInput={JSON.stringify({ role: 'deployer' })}
                    output={report}
                    status="error"
                />
            )
            const frame = lastFrame() || ''
            expect(frame).toContain('SubAgent')
            expect(frame).toContain('deployer:d1')
            expect(frame).toContain('failed: Connection refused to redis:6379')
            expect(frame).not.toMatch(/[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u)
        })

        it('renders batch parallel SubAgents cleanly while running and upon completion', () => {
            const batchInput = JSON.stringify({
                subagents: [
                    { role: 'researcher', depth: 1 },
                    { role: 'tester', depth: 1 },
                ],
            })
            const stream = [
                '[SubAgent:d1:researcher] tool: read_file(src/app.ts) (turn 1)',
                '[SubAgent:d1:tester] tool: bash("bun test") (turn 2)',
            ].join('\n')

            const { lastFrame: runningFrame } = render(
                <SubagentTickerView
                    toolName="invoke_subagent"
                    toolInput={batchInput}
                    output={stream}
                    status="running"
                />
            )
            const rFrame = runningFrame() || ''
            expect(rFrame).toContain('SubAgent')
            expect(rFrame).toContain('researcher:d1')
            expect(rFrame).toContain('tester:d1')

            // Completed batch
            const { lastFrame: doneFrame } = render(
                <SubagentTickerView
                    toolName="invoke_subagent"
                    toolInput={batchInput}
                    output="Batch SubAgents Execution (2 tasks)\nDuration: 3.5s"
                    status="success"
                />
            )
            const dFrame = doneFrame() || ''
            expect(dFrame).toContain('SubAgent batch (2/2)')
            expect(dFrame).toContain('done in 3.5s (2 tasks completed)')
        })
    })

    describe('BotMessage integration', () => {
        it('delegates invoke_subagent command block directly to SubAgent ticker', () => {
            const stream = '[SubAgent:d1:auditor] thinking: inspecting auth middleware\n'
            const { lastFrame } = render(
                <BotMessage
                    blocks={[
                        {
                            type: 'command',
                            toolName: 'invoke_subagent',
                            command: 'invoke_subagent({"role":"auditor"})',
                            toolInput: JSON.stringify({ role: 'auditor' }),
                            status: 'running',
                            output: stream,
                        },
                    ]}
                />
            )
            const frame = lastFrame() || ''
            expect(frame).toContain('SubAgent')
            expect(frame).toContain('auditor:d1')
            expect(frame).toContain('thinking:')
            expect(frame).toContain('inspecting auth middleware')
            expect(frame).not.toContain('Working...')
        })
    })
})
