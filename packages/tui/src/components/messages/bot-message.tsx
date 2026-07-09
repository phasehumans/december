import { Box, Text } from 'ink'
import React from 'react'

import { Spinner } from '../spinner'
import { Markdown } from '../markdown'
import { Pill } from '../pill'

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

export function BotMessage({ blocks }: Props) {
    return (
        <Box flexDirection="column" paddingX={4} paddingY={0} gap={0}>
            {blocks.map((block, idx) => {
                switch (block.type) {
                    case 'text': {
                        const isThinking =
                            block.content === 'Thinking...' ||
                            block.content === 'Working...' ||
                            block.content === 'Generating...'
                        if (isThinking) {
                            return (
                                <Box key={idx} marginY={0.5} gap={1} alignItems="center">
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
                                        <Box key={pidx} paddingBottom={0.5}>
                                            <Markdown>{part.trim()}</Markdown>
                                        </Box>
                                    )
                                })}
                            </Box>
                        )
                    }
                    case 'thinking': {
                        return (
                            <Box key={idx} marginY={0.5} flexDirection="column">
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
                            } catch {}

                            if (block.toolName === 'read_file') {
                                const lines = block.output ? block.output.split('\n').length : 0
                                return (
                                    <Box key={idx} flexDirection="column" marginY={0.5}>
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
                                const diffStr =
                                    block.toolName === 'write_file' ||
                                    block.toolName === 'write_to_file'
                                        ? parsedInput.content || parsedInput.CodeContent
                                        : parsedInput.diff || ''
                                const path =
                                    parsedInput.path ||
                                    parsedInput.filePath ||
                                    parsedInput.TargetFile ||
                                    ''
                                const lines = diffStr ? diffStr.split('\n') : []
                                const isWrite =
                                    block.toolName === 'write_file' ||
                                    block.toolName === 'write_to_file'

                                return (
                                    <Box key={idx} flexDirection="column" marginY={0.5}>
                                        <Box
                                            gap={1}
                                            alignItems="center"
                                            paddingBottom={isSuccess && lines.length > 0 ? 0.5 : 0}
                                        >
                                            <Pill
                                                label={isWrite ? 'CREATE' : 'EDIT'}
                                                backgroundColor="#303030"
                                                color={isWrite ? '#4ade80' : '#89B4F8'}
                                            />
                                            <Text color="white">{path}</Text>
                                        </Box>
                                        {isSuccess && lines.length > 0 && (
                                            <Box flexDirection="column" paddingLeft={0}>
                                                {lines
                                                    .slice(0, 40)
                                                    .map((rawLine: string, lidx: number) => {
                                                        const isAdd =
                                                            isWrite || rawLine.startsWith('+')
                                                        const isSub =
                                                            !isWrite && rawLine.startsWith('-')
                                                        const lineStr = isWrite
                                                            ? `+ ${rawLine}`
                                                            : rawLine

                                                        let prefixColor = '#d1d5db'
                                                        let bgColor: string | undefined = undefined

                                                        if (isAdd) {
                                                            prefixColor = '#4ade80'
                                                            bgColor = '#122f1e'
                                                        } else if (isSub) {
                                                            prefixColor = '#f87171'
                                                            bgColor = '#3f1316'
                                                        }

                                                        let prefix = ''
                                                        let rest = lineStr
                                                        if (isAdd && lineStr.startsWith('+')) {
                                                            prefix = '+'
                                                            rest = lineStr.slice(1)
                                                        } else if (
                                                            isSub &&
                                                            lineStr.startsWith('-')
                                                        ) {
                                                            prefix = '-'
                                                            rest = lineStr.slice(1)
                                                        }

                                                        return (
                                                            <Box
                                                                key={lidx}
                                                                width="100%"
                                                                backgroundColor={bgColor}
                                                            >
                                                                <Text color={prefixColor}>
                                                                    {prefix}
                                                                </Text>
                                                                <Text
                                                                    color={
                                                                        bgColor
                                                                            ? 'white'
                                                                            : '#d1d5db'
                                                                    }
                                                                    wrap="truncate-end"
                                                                >
                                                                    {rest}
                                                                </Text>
                                                            </Box>
                                                        )
                                                    })}
                                                {lines.length > 40 && (
                                                    <Box>
                                                        <Text color="gray" dimColor>
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
                                <Box key={idx} gap={1} marginY={0.5} alignItems="center">
                                    <Pill
                                        label={(block.toolName || 'TOOL')
                                            .toUpperCase()
                                            .substring(0, 10)}
                                        backgroundColor="#303030"
                                        color="#cbd5e1"
                                    />
                                    <Text color="white">
                                        {block.command.substring(0, 80)}
                                        {block.command.length > 80 ? '...' : ''}
                                    </Text>
                                    <Text color="gray" dimColor>
                                        (ctrl+o to expand)
                                    </Text>
                                </Box>
                            )
                        }

                        // Expanded state for running tools
                        return (
                            <Box key={idx} flexDirection="column" marginY={0.5}>
                                <Box gap={1} alignItems="center">
                                    <Spinner />
                                    <Pill
                                        label="RUNNING"
                                        backgroundColor="#303030"
                                        color="#fef08a"
                                    />
                                    <Text color="white">{block.command}</Text>
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
                                        {block.output.split('\n').map((line, lidx) => {
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
                            <Box key={idx} gap={1} marginY={0.5} alignItems="center">
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
                            <Box key={idx} flexDirection="column" paddingLeft={1} marginY={0.5}>
                                <Text color="#4A5568">
                                    {block.filename
                                        ? `┌── ${block.filename} ${borderLine}`
                                        : `┌${borderLine}`}
                                </Text>
                                <Box flexDirection="column" paddingLeft={2}>
                                    {block.code.split('\n').map((line, lidx) => (
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
                            <Box key={idx} gap={1} marginY={0.25} alignItems="center">
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
