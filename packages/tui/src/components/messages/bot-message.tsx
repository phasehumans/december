import { Box, Text } from 'ink'

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

const renderTextWithChips = (text: string) => {
    const parts = text.split(/`([^`]+)`/g)
    if (parts.length === 1) return <Text color="white">{text}</Text>

    return (
        <Text>
            {parts.map((part, i) => {
                if (i % 2 === 1) {
                    return (
                        <Text key={i} backgroundColor="#b37400" color="white" bold>
                            {' '}
                            {part}{' '}
                        </Text>
                    )
                }
                return (
                    <Text key={i} color="white">
                        {part}
                    </Text>
                )
            })}
        </Text>
    )
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
                                                paddingBottom={1}
                                            >
                                                <Text color="gray">▸ Thought</Text>
                                                <Box
                                                    marginLeft={2}
                                                    borderLeft
                                                    borderStyle="single"
                                                    borderColor="gray"
                                                    paddingLeft={1}
                                                >
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
                                            {renderTextWithChips(part.trim())}
                                        </Box>
                                    )
                                })}
                            </Box>
                        )
                    }
                    case 'thinking': {
                        return (
                            <Box
                                key={idx}
                                marginY={0.5}
                                flexDirection="column"
                                borderStyle="round"
                                borderColor="gray"
                                paddingX={1}
                            >
                                <Text color="gray" italic>
                                    {block.content || 'Thinking...'}
                                </Text>
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
                                            <Text color={isSuccess ? '#f59e0b' : '#FCA5A5'} bold>
                                                •
                                            </Text>
                                            <Text color="white" bold>
                                                Read
                                            </Text>
                                            <Text color="gray">
                                                {parsedInput.path || parsedInput.filePath || ''}
                                            </Text>
                                        </Box>
                                        {isSuccess && (
                                            <Box paddingLeft={2}>
                                                <Text color="gray">└ {lines} lines</Text>
                                            </Box>
                                        )}
                                    </Box>
                                )
                            }

                            if (
                                block.toolName === 'edit_file' ||
                                block.toolName === 'edit_diff' ||
                                block.toolName === 'write_file'
                            ) {
                                const diffStr =
                                    block.toolName === 'write_file'
                                        ? parsedInput.content
                                        : parsedInput.diff || ''
                                const path = parsedInput.path || parsedInput.filePath || ''
                                const lines = diffStr ? diffStr.split('\n') : []
                                const actionStr =
                                    block.toolName === 'write_file' ? 'Created' : 'Edited'

                                return (
                                    <Box key={idx} flexDirection="column" marginY={0.5}>
                                        <Box gap={1} alignItems="center">
                                            <Text color={isSuccess ? '#f59e0b' : '#FCA5A5'} bold>
                                                •
                                            </Text>
                                            <Text color="white" bold>
                                                {actionStr}
                                            </Text>
                                            <Text color="gray">{path}</Text>
                                        </Box>
                                        {isSuccess && lines.length > 0 && (
                                            <Box flexDirection="column" marginLeft={2}>
                                                {lines
                                                    .slice(0, 20)
                                                    .map((rawLine: string, lidx: number) => {
                                                        const isWriteFile =
                                                            block.toolName === 'write_file'
                                                        let isAdd =
                                                            isWriteFile || rawLine.startsWith('+')
                                                        let isSub =
                                                            !isWriteFile && rawLine.startsWith('-')

                                                        let lineStr = rawLine
                                                        if (isWriteFile) {
                                                            lineStr = `+ ${rawLine}`
                                                        }

                                                        let color = 'white'
                                                        let bgColor: string | undefined = undefined

                                                        if (isAdd) {
                                                            color = '#22c55e'
                                                        } else if (isSub) {
                                                            color = '#ef4444'
                                                        }

                                                        return (
                                                            <Box key={lidx}>
                                                                <Text color="gray">│ </Text>
                                                                <Box flexGrow={1}>
                                                                    <Text
                                                                        color={color}
                                                                        wrap="truncate-end"
                                                                    >
                                                                        {lineStr}
                                                                    </Text>
                                                                </Box>
                                                            </Box>
                                                        )
                                                    })}
                                                {lines.length > 20 && (
                                                    <Box>
                                                        <Text color="gray">│ </Text>
                                                        <Text color="gray" dimColor>
                                                            ... ({lines.length - 20} more lines)
                                                        </Text>
                                                    </Box>
                                                )}
                                                <Text color="gray">└</Text>
                                            </Box>
                                        )}
                                    </Box>
                                )
                            }

                            // Collapsed state for other completed tools
                            return (
                                <Box key={idx} gap={1} marginY={0.5} alignItems="center">
                                    <Text color={isSuccess ? '#f59e0b' : '#FCA5A5'} bold>
                                        •
                                    </Text>
                                    <Text color="white" bold>
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
                                    <Text color="#f59e0b" bold>
                                        {block.command}
                                    </Text>
                                </Box>
                                {block.output && (
                                    <Box
                                        flexDirection="column"
                                        marginLeft={2}
                                        marginTop={0.5}
                                        paddingX={1}
                                        paddingY={0.5}
                                        borderStyle="single"
                                        borderColor="#4A5568"
                                    >
                                        {block.output.split('\n').map((line, lidx) => {
                                            const isTruncationMarker =
                                                line.startsWith('<...') && line.endsWith('...>')
                                            return (
                                                <Text
                                                    key={lidx}
                                                    color={
                                                        isTruncationMarker ? 'yellow' : '#718096'
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
                            ? 'Created'
                            : isDeleted
                              ? 'Deleted'
                              : 'Modified'
                        const actionColor = isCreated
                            ? '#6EE7B7'
                            : isDeleted
                              ? '#FCA5A5'
                              : '#63B3ED'

                        // Always render collapsed for completed file operations
                        return (
                            <Box key={idx} gap={1} marginY={0.5} alignItems="center">
                                <Text color={actionColor} bold>
                                    ✓
                                </Text>
                                <Text color="gray">{actionLabel} file:</Text>
                                <Text color="#63B3ED" underline>
                                    {block.filePath}
                                </Text>
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
                            <Box
                                key={idx}
                                gap={1}
                                paddingLeft={1}
                                marginY={0.25}
                                alignItems="center"
                            >
                                <Text color={block.success ? '#6EE7B7' : '#FCA5A5'} bold>
                                    {block.success ? '✓' : '✗'}
                                </Text>
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
