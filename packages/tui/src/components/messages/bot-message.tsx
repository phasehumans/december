import { Box, Text } from 'ink'
import React from 'react'

import { Markdown } from '../markdown'
import { Pill } from '../pill'
import { Spinner } from '../spinner'

export type MessageBlock =
    | { type: 'text'; content: string }
    | { type: 'thinking'; content: string }
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
    | { type: 'status'; label: string; success: boolean }

type Props = {
    blocks: MessageBlock[]
}

function StyledCommand({ command, truncate = true }: { command: string; truncate?: boolean }) {
    const match = command.match(/^([A-Za-z_]+)\((.*)\)$/)
    if (match) {
        let args = match[2] || ''
        if (truncate && args.length > 80) {
            args = args.substring(0, 80) + '...'
        }
        const cmdColor = '#fef08a' // Yellow

        return (
            <Text>
                <Text color={cmdColor}>● </Text>
                <Text color={cmdColor} bold>
                    {match[1]}
                </Text>
                <Text color="#cbd5e1">({args})</Text>
            </Text>
        )
    }
    let displayCmd = command
    if (truncate && command.length > 80) {
        displayCmd = command.substring(0, 80) + '...'
    }
    return <Text color="white">{displayCmd}</Text>
}

export function BotMessage({ blocks }: Props) {
    return (
        <Box flexDirection="column" paddingX={4} paddingY={0} gap={1} marginTop={1}>
            {blocks.map((block, idx) => {
                switch (block.type) {
                    case 'text': {
                        const isThinking =
                            block.content === 'Thinking...' ||
                            block.content === 'Working...' ||
                            block.content === 'Generating...'
                        if (isThinking) {
                            return (
                                <Box key={idx} gap={1} alignItems="center">
                                    <Spinner />
                                    <Text color="gray">{block.content}</Text>
                                </Box>
                            )
                        }

                        // Split by <thought> tags
                        const parts = block.content.split(
                            /(<thought>[\s\S]*?<\/thought>|<thought>[\s\S]*)/
                        )
                        return (
                            <Box key={idx} flexDirection="column">
                                {parts.map((part, pidx) => {
                                    if (part.startsWith('<thought>')) {
                                        const thoughtContent = part
                                            .replace(/^<thought>/, '')
                                            .replace(/<\/thought>$/, '')
                                            .trim()
                                        return (
                                            <Box
                                                key={pidx}
                                                flexDirection="column"
                                                paddingBottom={0}
                                            >
                                                <Box gap={1} alignItems="center">
                                                    <Pill
                                                        label="THOUGHT"
                                                        backgroundColor="#303030"
                                                        color="#94a3b8"
                                                    />
                                                </Box>
                                                <Box marginLeft={0} paddingLeft={2} paddingY={0.5}>
                                                    <Text color="gray" dimColor>
                                                        {thoughtContent}
                                                    </Text>
                                                </Box>
                                            </Box>
                                        )
                                    }
                                    if (part.trim() === '') return null
                                    return (
                                        <Box key={pidx}>
                                            <Markdown>{part.trim()}</Markdown>
                                        </Box>
                                    )
                                })}
                            </Box>
                        )
                    }
                    case 'thinking': {
                        return (
                            <Box key={idx} flexDirection="column">
                                <Box gap={1} alignItems="center">
                                    <Spinner />
                                    <Text color="gray" italic>
                                        {block.content || 'Thinking...'}
                                    </Text>
                                </Box>
                            </Box>
                        )
                    }
                    case 'command': {
                        const isRunning = block.status === 'running'
                        const isSuccess = block.status === 'success'

                        if (!isRunning) {
                            let parsedInput: any = {}
                            try {
                                parsedInput = JSON.parse(block.toolInput || '{}')
                            } catch {
                                // ignore parse errors
                            }

                            if (block.toolName === 'read_file') {
                                const lines = block.output ? block.output.split(/\r?\n/).length : 0
                                return (
                                    <Box key={idx} flexDirection="column">
                                        <Box gap={1} alignItems="center">
                                            <Pill
                                                label="READ"
                                                backgroundColor="#303030"
                                                color="#cbd5e1"
                                            />
                                            <Text color="white">
                                                {parsedInput.path || parsedInput.filePath || ''}
                                            </Text>
                                            {isSuccess && (
                                                <Text color="gray" dimColor>
                                                    ({lines} lines)
                                                </Text>
                                            )}
                                        </Box>
                                    </Box>
                                )
                            }

                            if (
                                block.toolName === 'edit_file' ||
                                block.toolName === 'edit_diff' ||
                                block.toolName === 'write_file' ||
                                block.toolName === 'write_to_file' ||
                                block.toolName === 'multi_replace_file_content' ||
                                block.toolName === 'replace_file_content'
                            ) {
                                const path =
                                    parsedInput.path ||
                                    parsedInput.filePath ||
                                    parsedInput.TargetFile ||
                                    ''
                                const diffStr =
                                    block.toolName === 'write_file' ||
                                    block.toolName === 'write_to_file'
                                        ? parsedInput.content || parsedInput.CodeContent
                                        : parsedInput.diff
                                const isWrite =
                                    block.toolName === 'write_file' ||
                                    block.toolName === 'write_to_file'
                                const lines = diffStr
                                    ? diffStr.replace(/\r?\n$/, '').split(/\r?\n/)
                                    : []

                                return (
                                    <Box key={idx} flexDirection="column">
                                        <Box gap={1} alignItems="center">
                                            <StyledCommand
                                                command={`${isWrite ? 'Create' : 'Edit'}(${path})`}
                                            />
                                        </Box>
                                        {isSuccess && lines.length > 0 && (
                                            <Box flexDirection="column" paddingLeft={0}>
                                                {lines.slice(0, 40).map((line, lidx) => {
                                                    let prefixColor = '#d1d5db'
                                                    let bgColor: string | undefined = undefined
                                                    let prefix = ' '
                                                    let rest = line

                                                    if (isWrite) {
                                                        prefixColor = '#4ade80'
                                                        bgColor = '#122f1e'
                                                        prefix = '+'
                                                        rest = line
                                                    } else {
                                                        prefix = ' '
                                                        if (line.startsWith('+')) {
                                                            prefixColor = '#4ade80'
                                                            bgColor = '#122f1e'
                                                            prefix = '+'
                                                            rest = line.slice(1)
                                                        } else if (line.startsWith('-')) {
                                                            prefixColor = '#f87171'
                                                            bgColor = '#3f1316'
                                                            prefix = '-'
                                                            rest = line.slice(1)
                                                        } else if (line.startsWith('@@')) {
                                                            prefixColor = '#a78bfa'
                                                            prefix = '@'
                                                            rest = line.slice(1)
                                                        } else if (line.startsWith(' ')) {
                                                            rest = line.slice(1)
                                                        }
                                                    }

                                                    return (
                                                        <Box
                                                            key={lidx}
                                                            backgroundColor={bgColor}
                                                            flexDirection="row"
                                                            paddingLeft={2}
                                                        >
                                                            <Box width={2} flexShrink={0}>
                                                                <Text color={prefixColor}>
                                                                    {prefix}
                                                                </Text>
                                                            </Box>
                                                            <Text
                                                                color={
                                                                    bgColor ? 'white' : '#d1d5db'
                                                                }
                                                                wrap="truncate-end"
                                                            >
                                                                {rest}
                                                            </Text>
                                                        </Box>
                                                    )
                                                })}
                                                {lines.length > 40 && (
                                                    <Box paddingLeft={1}>
                                                        <Text color="#94a3b8">
                                                            ... ({lines.length - 40} more lines)
                                                        </Text>
                                                    </Box>
                                                )}
                                            </Box>
                                        )}
                                    </Box>
                                )
                            }

                            // Collapsed state for other completed tools
                            return (
                                <Box key={idx} gap={1} alignItems="center">
                                    <StyledCommand command={block.command} />
                                </Box>
                            )
                        }

                        // Expanded state for running tools
                        return (
                            <Box key={idx} flexDirection="column">
                                <Box gap={1} alignItems="center">
                                    <Spinner />
                                    <StyledCommand command={block.command} truncate={false} />
                                </Box>
                                {block.output && (
                                    <Box
                                        flexDirection="column"
                                        marginLeft={0}
                                        marginTop={0.5}
                                        paddingX={1}
                                        paddingY={0.5}
                                        backgroundColor="#1e293b"
                                    >
                                        {block.output.split(/\r?\n/).map((line, lidx) => {
                                            const isTruncationMarker =
                                                line.startsWith('<...') && line.endsWith('...>')
                                            return (
                                                <Text
                                                    key={lidx}
                                                    color={
                                                        isTruncationMarker ? 'yellow' : '#94a3b8'
                                                    }
                                                    dimColor
                                                >
                                                    {line}
                                                </Text>
                                            )
                                        })}
                                    </Box>
                                )}
                            </Box>
                        )
                    }
                    case 'file_change': {
                        const isCreated = block.action === 'created'
                        const isDeleted = block.action === 'deleted'
                        const actionLabel = isCreated
                            ? 'CREATED'
                            : isDeleted
                              ? 'DELETED'
                              : 'MODIFIED'
                        const fgColor = isCreated ? '#4ade80' : isDeleted ? '#f87171' : '#89B4F8'

                        return (
                            <Box key={idx} gap={1} alignItems="center">
                                <Pill
                                    label={actionLabel}
                                    backgroundColor="#303030"
                                    color={fgColor}
                                />
                                <Text color="white">{block.filePath}</Text>
                            </Box>
                        )
                    }
                    case 'code': {
                        const borderLength = Math.max(10, 60 - (block.filename?.length ?? 0))
                        const borderLine = '─'.repeat(borderLength)
                        return (
                            <Box key={idx} flexDirection="column" paddingLeft={1}>
                                <Text color="#4A5568" wrap="truncate">
                                    {block.filename
                                        ? `┌── ${block.filename} ${borderLine}`
                                        : `┌${borderLine}`}
                                </Text>
                                <Box flexDirection="column" paddingLeft={2}>
                                    {block.code.split(/\r?\n/).map((line, lidx) => (
                                        <Text key={lidx} color="#E2E8F0">
                                            {line}
                                        </Text>
                                    ))}
                                </Box>
                                <Text color="#4A5568">└──</Text>
                            </Box>
                        )
                    }
                    case 'status': {
                        return (
                            <Box key={idx} gap={1} alignItems="center">
                                <Pill
                                    label={block.success ? 'SUCCESS' : 'FAILED'}
                                    backgroundColor="#303030"
                                    color={block.success ? '#4ade80' : '#f87171'}
                                />
                                <Text color="white" bold={block.success}>
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
}
