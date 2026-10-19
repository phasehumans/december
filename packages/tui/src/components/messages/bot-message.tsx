import { Box, Text } from 'ink'
import React from 'react'

import { useTerminalColumns } from '../../hooks/use-terminal-columns'
import { THEME } from '../../theme'
import { fileLink, toRelativePath } from '../../utils/terminal-link'
import { InlineTip } from '../inline-tip'
import { Spinner } from '../spinner'

import { parseTuiError, FormattedErrorText } from './error-message'
import { SmoothMarkdown } from './smooth-markdown'
import { SubagentTickerView } from './subagent-ticker'

export type MessageBlock =
    | { type: 'text'; content: string; color?: string }
    | { type: 'thinking'; content: string; isStreaming?: boolean; durationMs?: number }
    | { type: 'compaction'; summary: string }
    | { type: 'error'; error: string; cause?: string; hint?: string }
    | { type: 'interrupt' }
    | {
          type: 'command'
          toolCallId?: string
          toolName?: string
          toolInput?: string
          command: string
          status: 'running' | 'success' | 'error'
          output?: string
      }
    | {
          type: 'file_change'
          filePath: string
          action: 'created' | 'modified' | 'deleted'
          diff?: string
      }
    | { type: 'code'; language: string; filename?: string; code: string }
    | { type: 'status'; label: string; success: boolean; hidePill?: boolean }

type Props = {
    blocks: MessageBlock[]
    usage?: { promptTokens: number; completionTokens: number }
    expandCommands?: boolean
    hasTopMargin?: boolean
}

export function formatThought(raw: string): string {
    if (!raw) return ''

    const lines = raw.split(/\r?\n/)
    const cleanedLines: string[] = []

    for (const line of lines) {
        let trimmed = line.trim()
        if (!trimmed) continue

        // 1. Strip section scaffolding labels like:
        //    *  **Goal Understanding:** ...
        //    *  **Goal Understanding**: ...
        //    **Goal Understanding:** ...
        //    ### Goal Understanding: ...
        //    * Goal Understanding: ...
        trimmed = trimmed
            .replace(/^[*•-]*\s*\*\*([^*]+)\*\*:?\s*/i, '')
            .replace(/^#{1,4}\s*([^:\n]+):?\s*/i, '')
            .replace(
                /^[*•-]*\s*(?:goal understanding|analysis|next steps|approach|plan|execution plan|thoughts?|reasoning):\s*/i,
                ''
            )

        // If the line was ONLY a standalone header with no subsequent text on that line, skip it
        if (!trimmed) continue

        // 2. Strip leading list bullet markers and numbered list markers:
        //    * item, - item, • item, 1. item, 1) item
        trimmed = trimmed.replace(/^[*•-]+\s*/, '')
        trimmed = trimmed.replace(/^\d+[.)]\s*/, '')

        // 3. Strip unparsed bold / italic markdown tags (**word**, *word*)
        //    while preserving backticks (`code`) and keeping natural casing
        trimmed = trimmed.replace(/\*\*([^*]+)\*\*/g, '$1')
        trimmed = trimmed.replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, '$1')

        trimmed = trimmed.trim()
        if (trimmed) {
            cleanedLines.push(trimmed)
        }
    }

    return cleanedLines.join('\n')
}

export function extractThoughtTopic(raw: string): string {
    if (!raw) return ''
    const cleaned = formatThought(raw)
    if (!cleaned) return ''

    const lines = cleaned
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter(Boolean)
    if (lines.length === 0) return ''

    let current = lines[lines.length - 1]!
    if (current.length < 5 && lines.length > 1) {
        current = lines[lines.length - 2]!
    }

    const sentences = current
        .split(/(?<=[.!?])\s+/)
        .map((s) => s.trim())
        .filter(Boolean)
    if (sentences.length > 0) {
        current = sentences[sentences.length - 1]!
    }

    current = current
        .replace(/^[^a-zA-Z0-9]+/, '')
        .replace(/[.:;,]+$/, '')
        .trim()
    current = current
        .replace(/^(?:line \d+|step \d+):\s*/i, '')
        .replace(
            /^(?:first(?:ly)?|now|next|then|so)?\s*,?\s*(?:i am|i'm|i need to|i should|i will|i want to|let's|let me|we need to|we should|thinking about|going to)\s+/i,
            ''
        )
        .trim()

    if (current) {
        current = current.charAt(0).toLowerCase() + current.slice(1)
    }

    const MAX_TOPIC_LEN = 48
    if (current.length > MAX_TOPIC_LEN) {
        current = current.substring(0, MAX_TOPIC_LEN - 3) + '...'
    }

    return current
}

export function CollapsibleThought({
    content,
    isStreaming,
}: {
    content: string
    isStreaming?: boolean
    forceExpanded?: boolean
    durationMs?: number
}) {
    // When thinking is finished, it does not persist in the chat history
    if (!isStreaming) {
        return null
    }

    const topic = extractThoughtTopic(content)
    const label = topic ? `Thinking... ${topic}` : 'Thinking...'

    return (
        <Box flexDirection="row" marginY={0} gap={1} alignItems="center">
            <Spinner />
            <Text color={THEME.colors.muted}>{label}</Text>
            <InlineTip active={Boolean(isStreaming)} />
        </Box>
    )
}

export const ThoughtView = CollapsibleThought

export function isDiscoveryTool(toolName?: string, command?: string): boolean {
    const name = (toolName || '').toLowerCase()
    if (
        name === 'read_file' ||
        name === 'view_file' ||
        name === 'list_dir' ||
        name === 'ls' ||
        name === 'grep_search' ||
        name === 'find_files' ||
        name === 'search_code' ||
        name === 'code_search' ||
        name === 'search_tools' ||
        name === 'code_intelligence' ||
        name === 'search_web' ||
        name === 'read_url_content' ||
        name === 'list_permissions'
    ) {
        return true
    }

    if (command) {
        const match = command.match(/^([A-Za-z_]+)\(/)
        if (match && match[1]) {
            const prefix = match[1].toLowerCase()
            if (
                prefix === 'read' ||
                prefix === 'listdir' ||
                prefix === 'ls' ||
                prefix === 'grep' ||
                prefix === 'find' ||
                prefix === 'search' ||
                prefix === 'websearch'
            ) {
                return true
            }
        }
    }

    return false
}

export function toPascalCase(str: string): string {
    if (!str) return ''
    return str
        .replace(/^[_\s\-.:]+|[_\s\-.:]+$/g, '')
        .split(/[_\-\s.:]+/)
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join('')
}

function StyledCommand({ command, truncate = true }: { command: string; truncate?: boolean }) {
    const columns = useTerminalColumns()
    const maxArgLength = Math.max(40, columns - 38)

    const match = command.match(/^([A-Za-z_]+)\(([\s\S]*)\)$/)
    if (match) {
        const args = (match[2] || '').replace(/\r?\n/g, ' ')
        const rawToolName = match[1]
        const toolName = toPascalCase(rawToolName) || rawToolName
        let displayArgs = args
        if (
            (toolName === 'Read' ||
                toolName === 'ReadFile' ||
                toolName === 'ViewFile' ||
                toolName === 'ListDir' ||
                toolName === 'Create' ||
                toolName === 'Edit') &&
            args &&
            !args.includes(' ')
        ) {
            const rel = toRelativePath(args)
            const truncatedRel =
                truncate && rel.length > maxArgLength
                    ? rel.substring(0, maxArgLength - 3) + '...'
                    : rel
            displayArgs = fileLink(truncatedRel, args)
        } else if (truncate && displayArgs.length > maxArgLength) {
            displayArgs = displayArgs.substring(0, maxArgLength - 3) + '...'
        }
        const cmdColor = THEME.colors.warning

        return (
            <Text>
                <Text color={cmdColor}>{`${THEME.glyphs.status} `}</Text>
                <Text color={cmdColor} bold>
                    {toolName}
                </Text>
                <Text color={THEME.colors.muted}>({displayArgs})</Text>
            </Text>
        )
    }
    let displayCmd = command.replace(/\r?\n/g, ' ')
    if (truncate && displayCmd.length > maxArgLength) {
        displayCmd = displayCmd.substring(0, maxArgLength - 3) + '...'
    }
    return <Text color={THEME.colors.text}>{displayCmd}</Text>
}

function StyledRunningCommand({
    command,
    truncate = true,
}: {
    command: string
    truncate?: boolean
}) {
    const columns = useTerminalColumns()
    const maxArgLength = Math.max(40, columns - 38)

    const match = command.match(/^([A-Za-z_]+)\(([\s\S]*)\)$/)
    if (match) {
        const args = (match[2] || '').replace(/\r?\n/g, ' ')
        const rawToolName = match[1]
        const toolName = toPascalCase(rawToolName) || rawToolName
        let displayArgs = args
        if (
            (toolName === 'Read' ||
                toolName === 'ReadFile' ||
                toolName === 'ViewFile' ||
                toolName === 'ListDir' ||
                toolName === 'Create' ||
                toolName === 'Edit') &&
            args &&
            !args.includes(' ')
        ) {
            const rel = toRelativePath(args)
            const truncatedRel =
                truncate && rel.length > maxArgLength
                    ? rel.substring(0, maxArgLength - 3) + '...'
                    : rel
            displayArgs = fileLink(truncatedRel, args)
        } else if (truncate && displayArgs.length > maxArgLength) {
            displayArgs = displayArgs.substring(0, maxArgLength - 3) + '...'
        }
        const cmdColor = THEME.colors.warning

        return (
            <Text>
                <Text color={cmdColor} bold>
                    {toolName}
                </Text>
                {displayArgs ? <Text color={THEME.colors.muted}>({displayArgs})</Text> : null}
            </Text>
        )
    }
    let displayCmd = command.replace(/\r?\n/g, ' ')
    if (truncate && displayCmd.length > maxArgLength) {
        displayCmd = displayCmd.substring(0, maxArgLength - 3) + '...'
    }
    return <Text color={THEME.colors.text}>{displayCmd}</Text>
}

export function CompactFileChange({
    filePath,
    action,
    diff,
    startLine,
}: {
    filePath?: string
    action: 'created' | 'modified' | 'deleted' | 'Updated'
    diff?: string
    startLine?: number
}) {
    const cleanPath = filePath ? filePath.replace(/^\.\//, '') : ''
    const displayPath = cleanPath ? toRelativePath(cleanPath) : ''
    const linkedPath = displayPath ? fileLink(displayPath, filePath || displayPath, startLine) : ''

    let stats = ''
    if (diff) {
        const lines = diff.split(/\r?\n/)
        const additions = lines.filter((l) => l.startsWith('+') && !l.startsWith('+++')).length
        const deletions = lines.filter((l) => l.startsWith('-') && !l.startsWith('---')).length

        if (action === 'created') {
            stats = additions > 0 ? ` (${additions} lines)` : ''
        } else if (additions > 0 || deletions > 0) {
            const parts: string[] = []
            if (additions > 0) parts.push(`+${additions}`)
            if (deletions > 0) parts.push(`-${deletions}`)
            stats = ` (${parts.join(', ')})`
        }
    }

    const actionText =
        action === 'created' ? 'Created' : action === 'deleted' ? 'Deleted' : 'Edited'

    return (
        <Box flexDirection="row" gap={1} alignItems="center" marginY={0}>
            <Text>
                <Text color={THEME.colors.warning}>{`${THEME.glyphs.status} `}</Text>
                <Text color={THEME.colors.warning} bold>
                    {actionText}
                </Text>
            </Text>
            {displayPath && <Text color={THEME.colors.text}>{linkedPath}</Text>}
            {stats ? <Text color={THEME.colors.muted}>{stats}</Text> : null}
        </Box>
    )
}

function CompactCommandOutput({
    command,
    output,
    status,
}: {
    command: string
    output?: string
    status?: 'running' | 'success' | 'error'
    forceExpanded?: boolean
}) {
    const isError = status === 'error'
    return (
        <Box flexDirection="column" marginY={0}>
            <Box alignItems="center" gap={1}>
                <StyledCommand command={command} />
            </Box>
            {isError && output && (
                <Box flexDirection="column" paddingLeft={2} marginTop={0}>
                    {output
                        .trim()
                        .split(/\r?\n/)
                        .slice(-3)
                        .map((line, lidx) => (
                            <Text key={lidx} color={THEME.colors.error} wrap="truncate-end">
                                │ {line}
                            </Text>
                        ))}
                </Box>
            )}
        </Box>
    )
}

const CollapsibleCommandOutput = CompactCommandOutput

type CommandBlock = Extract<MessageBlock, { type: 'command' }>

export type DiscoveryCategory = 'read' | 'listdir' | 'search' | 'websearch'

export function getDiscoveryCategory(block: MessageBlock): DiscoveryCategory | null {
    if (block.type !== 'command') return null
    const name = (block.toolName || '').toLowerCase()
    const cmd = (block.command || '').trim()

    if (
        name === 'read_file' ||
        name === 'view_file' ||
        cmd.startsWith('Read(') ||
        cmd.startsWith('read_file(') ||
        cmd.startsWith('view_file(')
    ) {
        return 'read'
    }
    if (
        name === 'list_dir' ||
        name === 'ls' ||
        cmd.startsWith('ListDir(') ||
        cmd.startsWith('list_dir(') ||
        cmd.startsWith('ls(')
    ) {
        return 'listdir'
    }
    if (
        name === 'grep_search' ||
        name === 'find_files' ||
        name === 'search_code' ||
        name === 'code_search' ||
        name === 'search_tools' ||
        name === 'code_intelligence' ||
        cmd.startsWith('Search(') ||
        cmd.startsWith('grep_search(') ||
        cmd.startsWith('find_files(') ||
        cmd.startsWith('grep(') ||
        cmd.startsWith('find(')
    ) {
        return 'search'
    }
    if (
        name === 'search_web' ||
        name === 'read_url_content' ||
        cmd.startsWith('WebSearch(') ||
        cmd.startsWith('search_web(') ||
        cmd.startsWith('websearch(') ||
        cmd.startsWith('read_url_content(')
    ) {
        return 'websearch'
    }

    return null
}

function getDiscoveryBlockArg(
    block: CommandBlock,
    category: DiscoveryCategory
): { display: string; target: string } {
    let rawArg = ''
    try {
        const parsed = JSON.parse(block.toolInput || '{}')
        if (category === 'read') {
            rawArg =
                parsed.AbsolutePath ??
                parsed.TargetFile ??
                parsed.filePath ??
                parsed.filepath ??
                parsed.path ??
                parsed.file ??
                ''
        } else if (category === 'listdir') {
            rawArg = parsed.DirectoryPath ?? parsed.dirPath ?? parsed.path ?? parsed.directory ?? ''
        } else if (category === 'search') {
            rawArg = parsed.Query ?? parsed.pattern ?? parsed.query ?? parsed.symbol ?? ''
        } else if (category === 'websearch') {
            rawArg = parsed.query ?? parsed.url ?? parsed.Url ?? ''
        }
    } catch {
        // Intentionally swallowed: fallback to parsing block.command
    }

    if (!rawArg && block.command) {
        const match = block.command.match(/^([A-Za-z_]+)\(([\s\S]*)\)$/)
        if (match) {
            rawArg = match[2].trim()
        }
    }

    if (category === 'read' || category === 'listdir') {
        const rel = toRelativePath(rawArg)
        return { display: rel || rawArg, target: rawArg }
    }

    const cleanDisplay = rawArg.replace(/\r?\n/g, ' ').trim()
    return { display: cleanDisplay, target: '' }
}

export function getReadBlockPath(block: CommandBlock): { display: string; target: string } {
    return getDiscoveryBlockArg(block, 'read')
}

export function formatConsolidatedArgs(
    items: { display: string; target: string }[],
    maxArgLength: number
): string {
    const count = items.length
    if (count === 0) return ''

    if (count === 1) {
        const p0 = items[0]!
        const label =
            p0.display.length > maxArgLength
                ? p0.display.substring(0, Math.max(10, maxArgLength - 3)) + '...'
                : p0.display
        return fileLink(label, p0.target)
    }

    if (count === 2) {
        const p0 = items[0]!
        const p1 = items[1]!
        if (p0.display.length + 2 + p1.display.length <= maxArgLength) {
            return `${fileLink(p0.display, p0.target)}, ${fileLink(p1.display, p1.target)}`
        }

        const remainingForP1 = maxArgLength - (p0.display.length + 2)
        if (remainingForP1 >= 8) {
            const truncatedP1 = p1.display.substring(0, remainingForP1 - 3) + '...'
            return `${fileLink(p0.display, p0.target)}, ${fileLink(truncatedP1, p1.target)}`
        }

        const truncatedP0 =
            p0.display.length > maxArgLength - 6
                ? p0.display.substring(0, Math.max(10, maxArgLength - 9)) + '...'
                : p0.display
        return `${fileLink(truncatedP0, p0.target)}, ...`
    }

    const p0 = items[0]!
    const p1 = items[1]!
    const suffixTwo = `, +${count - 2} more`
    if (p0.display.length + 2 + p1.display.length + suffixTwo.length <= maxArgLength) {
        return `${fileLink(p0.display, p0.target)}, ${fileLink(p1.display, p1.target)}${suffixTwo}`
    }

    const remainingForP1 = maxArgLength - (p0.display.length + 2 + suffixTwo.length)
    if (remainingForP1 >= 8) {
        const truncatedP1 = p1.display.substring(0, remainingForP1 - 3) + '...'
        return `${fileLink(p0.display, p0.target)}, ${fileLink(truncatedP1, p1.target)}${suffixTwo}`
    }

    const suffixOne = `, +${count - 1} more`
    const remainingForP0 = maxArgLength - suffixOne.length
    const label0 =
        p0.display.length > remainingForP0
            ? p0.display.substring(0, Math.max(10, remainingForP0 - 3)) + '...'
            : p0.display
    return `${fileLink(label0, p0.target)}${suffixOne}`
}

export const formatConsolidatedReadArgs = formatConsolidatedArgs

export function ConsolidatedDiscoveryView({
    category,
    blocks,
    isLastBlock,
}: {
    category: DiscoveryCategory
    blocks: CommandBlock[]
    forceExpanded?: boolean
    isLastBlock?: boolean
}) {
    const columns = useTerminalColumns()
    const isRunning = blocks.some((b) => b.status === 'running')
    const hasError = blocks.some((b) => b.status === 'error')

    const maxArgLength = Math.max(40, columns - 38)
    const items = blocks.map((b) => getDiscoveryBlockArg(b, category))
    const inlineArgs = formatConsolidatedArgs(items, maxArgLength)
    const cmdColor = THEME.colors.warning

    const label =
        category === 'read'
            ? 'Read'
            : category === 'listdir'
              ? 'ListDir'
              : category === 'search'
                ? 'Search'
                : 'WebSearch'

    if (isRunning) {
        return (
            <Box flexDirection="column" marginY={0}>
                <Box alignItems="center" gap={1}>
                    <Spinner />
                    <Text>
                        <Text color={cmdColor} bold>
                            {label}
                        </Text>
                        <Text color={THEME.colors.muted}>({inlineArgs})</Text>
                    </Text>
                    <InlineTip active={isLastBlock ?? true} />
                </Box>
            </Box>
        )
    }

    if (hasError) {
        const errorBlock = blocks.find((b) => b.status === 'error')
        return (
            <CompactCommandOutput
                command={errorBlock?.command || `${label}()`}
                output={errorBlock?.output}
                status="error"
            />
        )
    }

    return (
        <Box flexDirection="column" marginY={0}>
            <Box alignItems="center" gap={1}>
                <Text>
                    <Text color={cmdColor}>{`${THEME.glyphs.status} `}</Text>
                    <Text color={cmdColor} bold>
                        {label}
                    </Text>
                    <Text color={THEME.colors.muted}>({inlineArgs})</Text>
                </Text>
            </Box>
        </Box>
    )
}

export function ConsolidatedReadsView({
    blocks,
    forceExpanded,
    isLastBlock,
}: {
    blocks: CommandBlock[]
    forceExpanded?: boolean
    isLastBlock?: boolean
}) {
    return (
        <ConsolidatedDiscoveryView
            category="read"
            blocks={blocks}
            forceExpanded={forceExpanded}
            isLastBlock={isLastBlock}
        />
    )
}

type RenderItem =
    | { kind: 'single'; block: MessageBlock; originalIdx: number }
    | {
          kind: 'consolidated_discovery'
          category: DiscoveryCategory
          blocks: CommandBlock[]
          originalIdx: number
      }

export function isReadCommandBlock(block: MessageBlock): block is CommandBlock {
    return getDiscoveryCategory(block) === 'read'
}

function groupBlocks(blocks: MessageBlock[]): RenderItem[] {
    const items: RenderItem[] = []
    let i = 0

    while (i < blocks.length) {
        const block = blocks[i]
        if (!block) {
            i++
            continue
        }

        const category = getDiscoveryCategory(block)
        if (category) {
            const group: CommandBlock[] = [block as CommandBlock]
            let j = i + 1
            while (j < blocks.length) {
                const nextBlock = blocks[j]
                if (nextBlock && getDiscoveryCategory(nextBlock) === category) {
                    group.push(nextBlock as CommandBlock)
                    j++
                } else {
                    break
                }
            }

            if (group.length > 1) {
                items.push({
                    kind: 'consolidated_discovery',
                    category,
                    blocks: group,
                    originalIdx: i,
                })
                i = j
                continue
            }
        }

        items.push({ kind: 'single', block, originalIdx: i })
        i++
    }

    return items
}

export const BotMessage = React.memo(function BotMessage({
    blocks,
    usage,
    expandCommands,
    hasTopMargin,
}: Props) {
    const groupedItems = groupBlocks(blocks)

    return (
        <Box
            flexDirection="column"
            paddingLeft={THEME.padding.paddingLeft ?? THEME.padding.paddingX}
            paddingRight={THEME.padding.paddingRight ?? 4}
            paddingY={0}
            gap={0}
            marginTop={hasTopMargin ? 1 : 0}
        >
            {groupedItems.map((item) => {
                if (item.kind === 'consolidated_discovery') {
                    return (
                        <ConsolidatedDiscoveryView
                            key={item.originalIdx}
                            category={item.category}
                            blocks={item.blocks}
                            forceExpanded={expandCommands}
                            isLastBlock={item.originalIdx + item.blocks.length >= blocks.length}
                        />
                    )
                }

                const block = item.block
                const idx = item.originalIdx
                let prevBlock: MessageBlock | null = null
                for (let i = idx - 1; i >= 0; i--) {
                    const b = blocks[i]
                    if (!b) continue
                    if (
                        (b.type === 'text' || b.type === 'thinking') &&
                        (!b.content || b.content.trim() === '')
                    ) {
                        continue
                    }
                    if (b.type === 'thinking' && !b.isStreaming) {
                        continue
                    }
                    prevBlock = b
                    break
                }
                const needsTopMargin = Boolean(
                    prevBlock &&
                    (prevBlock.type === 'command' ||
                        prevBlock.type === 'thinking' ||
                        prevBlock.type === 'compaction')
                )

                switch (block.type) {
                    case 'text': {
                        if (!block.content || block.content.trim() === '') return null
                        const isThinking =
                            block.content === 'Thinking...' ||
                            block.content === 'Searching...' ||
                            block.content === 'Reading...' ||
                            block.content === 'Writing...' ||
                            block.content === 'Planning...' ||
                            block.content === 'Coding...' ||
                            block.content === 'Executing...' ||
                            block.content === 'Testing...' ||
                            block.content === 'Verifying...' ||
                            block.content === 'Refining...' ||
                            block.content === 'Finalizing...' ||
                            block.content === 'Working...' ||
                            block.content === 'Preparing...' ||
                            block.content === 'Compacting...' ||
                            block.content === 'Generating...' ||
                            block.content === 'Analyzing...' ||
                            block.content === 'Analyzing prompt...' ||
                            block.content === 'Generating questions...' ||
                            block.content === 'Understanding...' ||
                            block.content === 'Searching web...' ||
                            block.content === 'Searching codebase...' ||
                            block.content === 'Listing directory...' ||
                            block.content === 'Modifying...' ||
                            block.content === 'Asking question...' ||
                            block.content === 'Managing tasks...' ||
                            block.content === 'Checking permissions...' ||
                            block.content === 'Generating image...' ||
                            block.content === 'Sending message...' ||
                            block.content === 'Scheduling timer...'
                        if (isThinking) {
                            if (idx !== blocks.length - 1) return null
                            return (
                                <Box key={idx} flexDirection="column">
                                    <Box gap={1} alignItems="center">
                                        <Spinner />
                                        <Text color={THEME.colors.muted}>{block.content}</Text>
                                        <InlineTip active={true} />
                                    </Box>
                                </Box>
                            )
                        }

                        const isRetryStatus =
                            block.content.includes('rate limit hit') ||
                            block.content.includes('high demand hit') ||
                            (block.content.includes('Retrying in') &&
                                block.content.includes('attempt')) ||
                            block.content.startsWith('Rate limit') ||
                            block.content.startsWith('High demand') ||
                            block.content.startsWith('LLM Provider')
                        if (isRetryStatus) {
                            if (idx !== blocks.length - 1) return null
                            return (
                                <Box key={idx} flexDirection="column">
                                    <Box gap={1} alignItems="center">
                                        <Spinner />
                                        <Text color={THEME.colors.muted}>
                                            {block.content.trim()}
                                        </Text>
                                    </Box>
                                </Box>
                            )
                        }

                        if (block.color) {
                            return (
                                <Box key={idx} flexDirection="column">
                                    {needsTopMargin && <Text> </Text>}
                                    <Text color={block.color}>{block.content}</Text>
                                </Box>
                            )
                        }

                        // split by <thought> and <think> tags (case insensitive, allow attributes)
                        const parts = block.content.split(
                            /(<(?:thought|think)(?:>| [^>]*>)[\s\S]*?<\/(?:thought|think)>|<(?:thought|think)(?:>| [^>]*>)[\s\S]*)/i
                        )
                        return (
                            <Box key={idx} flexDirection="column">
                                {needsTopMargin && <Text> </Text>}
                                {parts.map((part, pidx) => {
                                    if (/^<(?:thought|think)(?:>| [^>]*>)/i.test(part)) {
                                        const isClosed = /<\/(?:thought|think)>$/i.test(part)
                                        const isStreaming =
                                            !isClosed &&
                                            idx === blocks.length - 1 &&
                                            pidx === parts.length - 1
                                        const thoughtContent = part
                                            .replace(/^<(?:thought|think)(?:>| [^>]*>)/i, '')
                                            .replace(/<\/(?:thought|think)>$/i, '')
                                            .trim()
                                        return (
                                            <CollapsibleThought
                                                key={pidx}
                                                content={thoughtContent}
                                                isStreaming={isStreaming}
                                                forceExpanded={expandCommands}
                                            />
                                        )
                                    }
                                    if (part.trim() === '') return null
                                    const hasLeadingNewline =
                                        (part.startsWith('\n') ||
                                            (pidx === 0 && block.content.startsWith('\n'))) &&
                                        !needsTopMargin
                                    const isStreaming =
                                        idx === blocks.length - 1 && pidx === parts.length - 1
                                    const contentText = isStreaming
                                        ? part.replace(/^\n+/, '')
                                        : part.trim()
                                    return (
                                        <Box key={pidx} flexDirection="column">
                                            {hasLeadingNewline && <Text> </Text>}
                                            <SmoothMarkdown
                                                text={contentText}
                                                isRunning={isStreaming}
                                            />
                                        </Box>
                                    )
                                })}
                            </Box>
                        )
                    }
                    case 'error': {
                        const parsed = parseTuiError(block.error, block.cause, block.hint)
                        return (
                            <Box key={idx} flexDirection="column">
                                {needsTopMargin && <Text> </Text>}
                                <FormattedErrorText
                                    text={parsed.message}
                                    defaultColor={THEME.colors.error}
                                />
                                {parsed.hint && parsed.hint !== '' && (
                                    <FormattedErrorText
                                        text={parsed.hint}
                                        defaultColor={THEME.colors.muted}
                                    />
                                )}
                            </Box>
                        )
                    }
                    case 'interrupt': {
                        return (
                            <Box key={idx} flexDirection="row" paddingY={1}>
                                <Text color={THEME.colors.muted}>
                                    Interrupted · What should December do instead?
                                </Text>
                            </Box>
                        )
                    }
                    case 'thinking': {
                        return (
                            <CollapsibleThought
                                key={idx}
                                content={block.content}
                                isStreaming={block.isStreaming}
                                durationMs={block.durationMs}
                                forceExpanded={expandCommands}
                            />
                        )
                    }
                    case 'compaction': {
                        return (
                            <Box key={idx} flexDirection="column" paddingY={1}>
                                <Box flexDirection="row" gap={1} alignItems="center">
                                    <Text color={THEME.colors.warning} italic>
                                        Context Compacted
                                    </Text>
                                </Box>
                                <Box paddingLeft={1} paddingTop={1}>
                                    <Text color={THEME.colors.muted}>
                                        {block.summary.replace(
                                            /^\[COMPACTED HISTORY SUMMARY\]\n/,
                                            ''
                                        )}
                                    </Text>
                                </Box>
                            </Box>
                        )
                    }
                    case 'command': {
                        const isSubagent =
                            block.toolName === 'invoke_subagent' ||
                            block.toolName === 'spawn_subagent' ||
                            block.command?.startsWith('invoke_subagent(') ||
                            block.command?.startsWith('spawn_subagent(') ||
                            block.command?.startsWith('SubAgent(')

                        if (isSubagent) {
                            return (
                                <SubagentTickerView
                                    key={idx}
                                    toolName={block.toolName}
                                    command={block.command}
                                    toolInput={block.toolInput}
                                    output={block.output}
                                    status={block.status}
                                    isLastBlock={idx === blocks.length - 1}
                                    forceExpanded={expandCommands}
                                />
                            )
                        }

                        const isRunning = block.status === 'running'

                        let parsedInput: any = {}
                        try {
                            parsedInput = JSON.parse(block.toolInput || '{}')
                        } catch {
                            // ignore parse errors
                        }

                        if (!isRunning) {
                            const isNoOutputTool =
                                block.status !== 'error' &&
                                (block.toolName === 'read_file' ||
                                    block.toolName === 'view_file' ||
                                    block.command?.startsWith('Read(') ||
                                    block.toolName === 'ask_permission' ||
                                    block.toolName === 'list_permissions')

                            if (isNoOutputTool) {
                                return (
                                    <Box key={idx} flexDirection="column">
                                        <Box alignItems="center" gap={1}>
                                            <StyledCommand command={block.command} />
                                        </Box>
                                    </Box>
                                )
                            }

                            let displayOutput = block.output
                            if (
                                block.toolName === 'replace_file_content' ||
                                block.toolName === 'multi_replace_file_content' ||
                                block.toolName === 'edit_file' ||
                                block.toolName === 'edit_diff' ||
                                block.toolName === 'write_file' ||
                                block.toolName === 'write_to_file'
                            ) {
                                const targetContent =
                                    parsedInput.targetContent ?? parsedInput.TargetContent
                                const replacementContent =
                                    parsedInput.replacementContent ?? parsedInput.ReplacementContent

                                if (
                                    targetContent !== undefined ||
                                    replacementContent !== undefined
                                ) {
                                    const target = (targetContent || '')
                                        .split(/\r?\n/)
                                        .map((l: string) => (l.startsWith('-') ? l : `-${l}`))
                                        .join('\n')
                                    const replacement = (replacementContent || '')
                                        .split(/\r?\n/)
                                        .map((l: string) => (l.startsWith('+') ? l : `+${l}`))
                                        .join('\n')
                                    displayOutput = [target, replacement].filter(Boolean).join('\n')
                                } else if (
                                    parsedInput.ReplacementChunks &&
                                    Array.isArray(parsedInput.ReplacementChunks)
                                ) {
                                    displayOutput = parsedInput.ReplacementChunks.map(
                                        (chunk: any) => {
                                            const tContent =
                                                chunk.targetContent ?? chunk.TargetContent ?? ''
                                            const rContent =
                                                chunk.replacementContent ??
                                                chunk.ReplacementContent ??
                                                ''
                                            const t = tContent
                                                .split(/\r?\n/)
                                                .map((l: string) =>
                                                    l.startsWith('-') ? l : `-${l}`
                                                )
                                                .join('\n')
                                            const r = rContent
                                                .split(/\r?\n/)
                                                .map((l: string) =>
                                                    l.startsWith('+') ? l : `+${l}`
                                                )
                                                .join('\n')
                                            return `${t}\n${r}`
                                        }
                                    ).join('\n')
                                } else if (parsedInput.diff) {
                                    displayOutput = parsedInput.diff
                                } else if (
                                    block.toolName === 'write_file' ||
                                    block.toolName === 'write_to_file'
                                ) {
                                    const code =
                                        parsedInput.codeContent ??
                                        parsedInput.CodeContent ??
                                        parsedInput.content ??
                                        parsedInput.code ??
                                        ''
                                    displayOutput = (code || '')
                                        .split(/\r?\n/)
                                        .map((l: string) => (l.startsWith('+') ? l : `+${l}`))
                                        .join('\n')
                                }

                                if (displayOutput) {
                                    const filePath =
                                        parsedInput.TargetFile ??
                                        parsedInput.targetFile ??
                                        parsedInput.filePath ??
                                        parsedInput.path
                                    const startLine =
                                        parsedInput.StartLine ?? parsedInput.startLine ?? 1
                                    const isCreated =
                                        block.toolName === 'write_file' ||
                                        block.toolName === 'write_to_file'

                                    return (
                                        <CompactFileChange
                                            key={idx}
                                            filePath={filePath}
                                            action={isCreated ? 'created' : 'modified'}
                                            diff={displayOutput}
                                            startLine={startLine}
                                        />
                                    )
                                }
                            }

                            return (
                                <CompactCommandOutput
                                    key={idx}
                                    command={block.command}
                                    output={displayOutput}
                                    status={block.status}
                                />
                            )
                        }

                        // expanded state for running tools
                        let statusLabel = 'Working...'
                        if (block.toolName === 'read_file' || block.toolName === 'view_file')
                            statusLabel = 'Reading...'
                        else if (
                            block.toolName === 'write_file' ||
                            block.toolName === 'write_to_file'
                        )
                            statusLabel = 'Writing...'
                        else if (block.toolName === 'run_command' || block.toolName === 'bash')
                            statusLabel = 'Executing...'
                        else if (block.toolName === 'search_web') statusLabel = 'Searching web...'
                        else if (block.toolName === 'list_dir') statusLabel = 'Listing directory...'
                        else if (
                            block.toolName === 'find_files' ||
                            block.toolName === 'grep_search'
                        )
                            statusLabel = 'Searching codebase...'
                        else if (
                            block.toolName === 'edit_file' ||
                            block.toolName === 'edit_diff' ||
                            block.toolName === 'replace_file_content' ||
                            block.toolName === 'multi_replace_file_content'
                        )
                            statusLabel = 'Modifying...'
                        else if (block.toolName === 'ask_question')
                            statusLabel = 'Asking question...'
                        else if (block.toolName === 'manage_task') statusLabel = 'Managing tasks...'
                        else if (block.toolName === 'manage_subagent')
                            statusLabel = 'Managing subagents...'
                        else if (block.toolName === 'write_artifact')
                            statusLabel = 'Writing artifact...'
                        else if (
                            block.toolName === 'browser' ||
                            block.toolName === 'browser_action'
                        )
                            statusLabel = 'Browsing...'
                        else if (block.toolName === 'manage_memory')
                            statusLabel = 'Managing memory...'
                        else if (block.toolName === 'code_intelligence')
                            statusLabel = 'Analyzing code...'
                        else if (block.toolName === 'run_skill') statusLabel = 'Running skill...'
                        else if (
                            block.toolName === 'list_permissions' ||
                            block.toolName === 'ask_permission'
                        )
                            statusLabel = 'Checking permissions...'
                        else if (block.toolName === 'generate_image')
                            statusLabel = 'Generating image...'
                        else if (block.toolName === 'send_message')
                            statusLabel = 'Sending message...'
                        else if (block.toolName === 'schedule') statusLabel = 'Scheduling timer...'

                        return (
                            <Box key={idx} flexDirection="column">
                                <Box gap={1} alignItems="center">
                                    <Spinner />
                                    {block.command ? (
                                        <StyledRunningCommand command={block.command} />
                                    ) : (
                                        <Text color={THEME.colors.muted}>{statusLabel}</Text>
                                    )}
                                    <InlineTip active={idx === blocks.length - 1} />
                                </Box>
                                {block.output && (
                                    <Box
                                        flexDirection="column"
                                        marginLeft={0}
                                        marginTop={0.5}
                                        paddingX={1}
                                        paddingY={0.5}
                                    >
                                        {block.output
                                            .trim()
                                            .split(/\r?\n/)
                                            .slice(-2)
                                            .map((line, lidx) => (
                                                <Text
                                                    key={lidx}
                                                    color={THEME.colors.muted}
                                                    wrap="truncate-end"
                                                >
                                                    │ {line}
                                                </Text>
                                            ))}
                                    </Box>
                                )}
                            </Box>
                        )
                    }
                    case 'file_change': {
                        const isCreated = block.action === 'created'
                        const isDeleted = block.action === 'deleted'
                        const actionLabel = isCreated
                            ? 'created'
                            : isDeleted
                              ? 'deleted'
                              : 'modified'

                        return (
                            <CompactFileChange
                                key={idx}
                                filePath={block.filePath}
                                action={actionLabel}
                                diff={block.diff}
                            />
                        )
                    }
                    case 'code': {
                        return (
                            <Box key={idx} flexDirection="column" paddingLeft={2} paddingY={0.5}>
                                {block.code.split(/\r?\n/).map((line, lidx) => (
                                    <Text key={lidx} color={THEME.colors.text}>
                                        {line}
                                    </Text>
                                ))}
                            </Box>
                        )
                    }
                    case 'status': {
                        return (
                            <Box key={idx} gap={1} alignItems="center">
                                <Text
                                    color={
                                        block.success ? THEME.colors.success : THEME.colors.error
                                    }
                                >
                                    {block.label}
                                </Text>
                            </Box>
                        )
                    }
                    default:
                        return null
                }
            })}
        </Box>
    )
})
