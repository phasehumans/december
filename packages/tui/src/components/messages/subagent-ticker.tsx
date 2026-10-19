import { Box, Text } from 'ink'
import React, { useEffect, useRef, useState } from 'react'

import { useTerminalColumns } from '../../hooks/use-terminal-columns'
import { THEME } from '../../theme'
import { InlineTip } from '../inline-tip'
import { Spinner } from '../spinner'

export interface SubagentTickerProps {
    toolName?: string
    command?: string
    toolInput?: string
    output?: string
    status: 'running' | 'success' | 'error'
    isLastBlock?: boolean
    forceExpanded?: boolean
}

export interface SubagentStreamAction {
    kind: 'tool' | 'thinking' | 'starting' | 'done' | 'error' | 'status'
    text: string
    toolName?: string
    toolArgs?: string
    turn?: number
}

export interface SubagentParsedState {
    role: string
    depth: number
    model?: string
    workspace?: string
    action: SubagentStreamAction
    error?: string
}

export interface SubagentRollupData {
    duration?: string
    turns?: number
    toolsCount?: number
    summaryBrief?: string
    error?: string
}

export function parseSubagentStream(
    output: string = '',
    fallbackRole: string = 'subagent',
    fallbackDepth: number = 1
): SubagentParsedState {
    const lines = output
        .trim()
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter(Boolean)

    let role = fallbackRole
    let depth = fallbackDepth
    let action: SubagentStreamAction = {
        kind: 'starting',
        text: 'starting task...',
    }
    let error: string | undefined

    for (const line of lines) {
        // Matches [SubAgent:d1:role] or legacy [Subagent: depth 1 - role]
        const match = line.match(
            /\[Sub[aA]gent:\s*(?:d(\d+):([^\s\]]+)|depth\s*(\d+)\s*-\s*([^\]]+))\]\s*(.*)/
        )
        if (match) {
            const d = match[1] || match[3]
            const r = match[2] || match[4]
            if (d) {
                const parsedDepth = parseInt(d, 10)
                if (!isNaN(parsedDepth)) depth = parsedDepth
            }
            if (r) role = r.trim()
            const payload = (match[5] || '').trim()
            if (!payload) continue

            if (/^(?:tool|call):\s*/i.test(payload)) {
                const raw = payload.replace(/^(?:tool|call):\s*/i, '').trim()
                const toolMatch = raw.match(/^([a-zA-Z0-9_-]+)(\([^\)]*\))?(.*)$/)
                const turnMatch = raw.match(/\(turn\s*(\d+)\)/i)
                const turn = turnMatch && turnMatch[1] ? parseInt(turnMatch[1], 10) : undefined

                action = {
                    kind: 'tool',
                    text: raw,
                    toolName: toolMatch ? toolMatch[1] : raw,
                    toolArgs: toolMatch && toolMatch[2] ? toolMatch[2] : undefined,
                    turn,
                }
            } else if (/^thinking:\s*/i.test(payload)) {
                action = {
                    kind: 'thinking',
                    text: payload.replace(/^thinking:\s*/i, '').trim(),
                }
            } else if (/^starting(?:\s*task)?:\s*/i.test(payload)) {
                action = {
                    kind: 'starting',
                    text:
                        payload.replace(/^starting(?:\s*task)?:\s*/i, '').trim() ||
                        'starting task...',
                }
            } else if (/^(?:failed|error):\s*/i.test(payload)) {
                error = payload.replace(/^(?:failed|error):\s*/i, '').trim()
                action = {
                    kind: 'error',
                    text: error,
                }
            } else if (/^status:\s*/i.test(payload)) {
                action = {
                    kind: 'status',
                    text: payload.replace(/^status:\s*/i, '').trim(),
                }
            } else {
                action = {
                    kind: 'status',
                    text: payload,
                }
            }
        } else if (/^Error:\s*/i.test(line)) {
            error = line.replace(/^Error:\s*/i, '').trim()
            action = {
                kind: 'error',
                text: error,
            }
        }
    }

    return {
        role,
        depth,
        action,
        error,
    }
}

export function extractRollupData(output: string = ''): SubagentRollupData {
    let duration: string | undefined
    let turns: number | undefined
    let toolsCount: number | undefined
    let summaryBrief: string | undefined
    let error: string | undefined

    const durationMatch =
        output.match(/Duration\*?\*?:\s*([\d.]+)s/i) || output.match(/\(([\d.]+)s\)/)
    if (durationMatch && durationMatch[1]) {
        duration = `${durationMatch[1]}s`
    }

    const turnsMatch =
        output.match(/Total Turns\*?\*?:\s*(\d+)/i) || output.match(/Turns\*?\*?:\s*(\d+)/i)
    if (turnsMatch && turnsMatch[1]) {
        turns = parseInt(turnsMatch[1], 10)
    }

    const toolsMatch = output.match(/Tool Calls\*?\*?:\s*(\d+)/i)
    if (toolsMatch && toolsMatch[1]) {
        toolsCount = parseInt(toolsMatch[1], 10)
    }

    const errorMatch =
        output.match(/\*\*Error\*\*:\s*([^\n]+)/i) || output.match(/#### Error:\s*([^\n]+)/i)
    if (errorMatch && errorMatch[1]) {
        error = errorMatch[1].trim()
    }

    const findingsIdx = output.indexOf('Rollup Summary & Findings:')
    if (findingsIdx !== -1) {
        const afterFindings = output.slice(findingsIdx + 'Rollup Summary & Findings:'.length).trim()
        const firstLine = afterFindings
            .split(/\r?\n/)
            .map((l) => l.trim())
            .find((l) => l && !l.startsWith('#') && !l.startsWith('-'))
        if (firstLine) {
            summaryBrief = firstLine.length > 80 ? firstLine.slice(0, 77) + '...' : firstLine
        }
    }

    return { duration, turns, toolsCount, summaryBrief, error }
}

function renderActionText(action: SubagentStreamAction, maxWidth: number) {
    if (action.kind === 'tool') {
        const toolName = action.toolName || 'tool'
        let args = action.toolArgs || ''
        if (args.length > maxWidth) {
            args = args.slice(0, Math.max(8, maxWidth - 3)) + '...)'
        }
        const turnStr = action.turn ? ` (turn ${action.turn})` : ''

        return (
            <Text>
                <Text color={THEME.colors.warning} bold>
                    tool:{' '}
                </Text>
                <Text color={THEME.colors.text} bold>
                    {toolName}
                </Text>
                {args ? <Text color={THEME.colors.muted}>{args}</Text> : null}
                {turnStr ? <Text color={THEME.colors.dim}>{turnStr}</Text> : null}
            </Text>
        )
    }

    if (action.kind === 'thinking') {
        const topic =
            action.text.length > maxWidth
                ? action.text.slice(0, Math.max(10, maxWidth - 3)) + '...'
                : action.text
        return (
            <Text>
                <Text color={THEME.colors.muted} italic>
                    thinking:{' '}
                </Text>
                <Text color={THEME.colors.muted}>{topic}</Text>
            </Text>
        )
    }

    if (action.kind === 'starting') {
        return <Text color={THEME.colors.muted}>starting task...</Text>
    }

    const displayText =
        action.text.length > maxWidth
            ? action.text.slice(0, Math.max(10, maxWidth - 3)) + '...'
            : action.text
    return <Text color={THEME.colors.muted}>{displayText}</Text>
}

export function SingleSubagentRow({
    role,
    depth,
    model,
    workspace,
    state,
    status,
    elapsedMs,
    rollup,
    isLastBlock,
}: {
    role: string
    depth: number
    model?: string
    workspace?: string
    state: SubagentParsedState
    status: 'running' | 'success' | 'error'
    elapsedMs: number
    rollup?: SubagentRollupData
    isLastBlock?: boolean
}) {
    const columns = useTerminalColumns()
    const maxContentWidth = Math.max(25, columns - 45)

    const isRunning = status === 'running'
    const isError = status === 'error' || Boolean(rollup?.error) || state.action.kind === 'error'
    const durationStr = isRunning
        ? `${(elapsedMs / 1000).toFixed(1)}s`
        : rollup?.duration || `${(elapsedMs / 1000).toFixed(1)}s`

    if (isRunning) {
        return (
            <Box flexDirection="row" alignItems="center" gap={1} marginY={0}>
                <Spinner spinnerColor={THEME.colors.warning} />
                <Text>
                    <Text color={THEME.colors.brand} bold>
                        SubAgent
                    </Text>
                    <Text color={THEME.colors.dim}> [</Text>
                    <Text color={THEME.colors.text} bold>
                        {role}
                    </Text>
                    <Text color={THEME.colors.subtle}>:d{depth}</Text>
                    {model ? <Text color={THEME.colors.muted}> · {model}</Text> : null}
                    <Text color={THEME.colors.dim}>]</Text>
                    {workspace === 'worktree' ? (
                        <Text color={THEME.colors.subtle}> (worktree)</Text>
                    ) : null}
                    <Text color={THEME.colors.dim}> › </Text>
                    {renderActionText(state.action, maxContentWidth)}
                    <Text color={THEME.colors.dim}> › </Text>
                    <Text color={THEME.colors.dim}>{durationStr}</Text>
                </Text>
                <InlineTip active={isLastBlock ?? true} />
            </Box>
        )
    }

    if (isError) {
        const errorMsg = rollup?.error || state.error || state.action.text || 'Execution failed'
        return (
            <Box flexDirection="row" alignItems="center" gap={1} marginY={0}>
                <Text color={THEME.colors.error}>{THEME.glyphs.status}</Text>
                <Text>
                    <Text color={THEME.colors.brand} bold>
                        SubAgent
                    </Text>
                    <Text color={THEME.colors.dim}> [</Text>
                    <Text color={THEME.colors.text} bold>
                        {role}
                    </Text>
                    <Text color={THEME.colors.subtle}>:d{depth}</Text>
                    <Text color={THEME.colors.dim}>]</Text>
                    <Text color={THEME.colors.dim}> › </Text>
                    <Text color={THEME.colors.error}>failed: {errorMsg}</Text>
                    <Text color={THEME.colors.dim}> › </Text>
                    <Text color={THEME.colors.dim}>{durationStr}</Text>
                </Text>
            </Box>
        )
    }

    // Success completed state
    const metrics: string[] = []
    if (rollup?.turns) metrics.push(`${rollup.turns} turns`)
    if (rollup?.toolsCount) metrics.push(`${rollup.toolsCount} tools`)
    const metricsStr = metrics.length > 0 ? ` (${metrics.join(' · ')})` : ''

    return (
        <Box flexDirection="column" marginY={0}>
            <Box flexDirection="row" alignItems="center" gap={1}>
                <Text color={THEME.colors.success}>{THEME.glyphs.status}</Text>
                <Text>
                    <Text color={THEME.colors.brand} bold>
                        SubAgent
                    </Text>
                    <Text color={THEME.colors.dim}> [</Text>
                    <Text color={THEME.colors.text} bold>
                        {role}
                    </Text>
                    <Text color={THEME.colors.subtle}>:d{depth}</Text>
                    <Text color={THEME.colors.dim}>]</Text>
                    <Text color={THEME.colors.dim}> › </Text>
                    <Text color={THEME.colors.text}>
                        done in {durationStr}
                        {metricsStr}
                    </Text>
                    {rollup?.summaryBrief ? (
                        <>
                            <Text color={THEME.colors.dim}> › </Text>
                            <Text color={THEME.colors.muted}>{rollup.summaryBrief}</Text>
                        </>
                    ) : null}
                </Text>
            </Box>
        </Box>
    )
}

export function SubagentTickerView({
    toolInput,
    output = '',
    status,
    isLastBlock,
}: SubagentTickerProps) {
    const [elapsedMs, setElapsedMs] = useState(0)
    const startTimeRef = useRef<number>(Date.now())

    useEffect(() => {
        if (status !== 'running') return
        const interval = setInterval(() => {
            setElapsedMs(Date.now() - startTimeRef.current)
        }, 200)
        return () => clearInterval(interval)
    }, [status])

    let parsedInput: any = {}
    try {
        parsedInput = JSON.parse(toolInput || '{}')
    } catch {
        // Intentionally swallowed: toolInput may be unparsed or plain string
    }

    const isBatch = Boolean(parsedInput.subagents && Array.isArray(parsedInput.subagents))
    const rollup = status !== 'running' ? extractRollupData(output) : undefined

    if (isBatch) {
        const subagents: any[] = parsedInput.subagents || []
        const isRunning = status === 'running'
        const durationStr = isRunning
            ? `${(elapsedMs / 1000).toFixed(1)}s`
            : rollup?.duration || `${(elapsedMs / 1000).toFixed(1)}s`

        // If batch completed, show clean consolidated summary
        if (!isRunning) {
            const isError = status === 'error' || Boolean(rollup?.error)
            const bulletColor = isError ? THEME.colors.error : THEME.colors.success
            const statusLabel = isError
                ? `failed: ${rollup?.error || 'Batch execution failure'}`
                : `done in ${durationStr} (${subagents.length} tasks completed)`

            return (
                <Box flexDirection="row" alignItems="center" gap={1} marginY={0}>
                    <Text color={bulletColor}>{THEME.glyphs.status}</Text>
                    <Text>
                        <Text color={THEME.colors.brand} bold>
                            SubAgent
                        </Text>
                        <Text color={THEME.colors.dim}> batch (</Text>
                        <Text color={THEME.colors.text} bold>
                            {subagents.length}/{subagents.length}
                        </Text>
                        <Text color={THEME.colors.dim}>) › </Text>
                        <Text color={isError ? THEME.colors.error : THEME.colors.text}>
                            {statusLabel}
                        </Text>
                    </Text>
                </Box>
            )
        }

        // While running, render stacked 1-line tickers per active subagent
        return (
            <Box flexDirection="column" marginY={0}>
                {subagents.map((spec, sidx) => {
                    const specRole = spec.role || `subagent-${sidx + 1}`
                    const roleOutput = output
                        .split(/\r?\n/)
                        .filter(
                            (line) =>
                                line.includes(`:${specRole}`) ||
                                line.includes(`- ${specRole}`) ||
                                line.includes(`[${specRole}]`)
                        )
                        .join('\n')
                    const state = parseSubagentStream(roleOutput, specRole, spec.depth || 1)

                    return (
                        <SingleSubagentRow
                            key={sidx}
                            role={specRole}
                            depth={spec.depth || 1}
                            model={spec.model}
                            workspace={spec.workspace}
                            state={state}
                            status={status}
                            elapsedMs={elapsedMs}
                            isLastBlock={sidx === subagents.length - 1 && isLastBlock}
                        />
                    )
                })}
            </Box>
        )
    }

    // Single subagent mode
    const fallbackRole = parsedInput.role || 'subagent'
    const fallbackDepth = parsedInput.depth || 1
    const state = parseSubagentStream(output, fallbackRole, fallbackDepth)

    return (
        <SingleSubagentRow
            role={state.role || fallbackRole}
            depth={state.depth || fallbackDepth}
            model={parsedInput.model}
            workspace={parsedInput.workspace}
            state={state}
            status={status}
            elapsedMs={elapsedMs}
            rollup={rollup}
            isLastBlock={isLastBlock}
        />
    )
}
