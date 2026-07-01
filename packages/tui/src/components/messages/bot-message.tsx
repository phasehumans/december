import { Box, Text } from 'ink'

import { Spinner } from '../spinner'

export type MessageBlock =
    | { type: 'text'; content: string }
    | {
          type: 'command'
          command: string
          status: 'running' | 'success' | 'failed'
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
        <Box flexDirection="column" paddingX={4} paddingY={1} gap={1}>
            {blocks.map((block, idx) => {
                switch (block.type) {
                    case 'text':
                        return (
                            <Box key={idx} marginY={0.5}>
                                <Text color="white">{block.content}</Text>
                            </Box>
                        )
                    case 'command': {
                        const isRunning = block.status === 'running'
                        const isSuccess = block.status === 'success'
                        return (
                            <Box key={idx} flexDirection="column" marginY={0.5}>
                                <Box gap={1} alignItems="center">
                                    {isRunning ? (
                                        <Spinner />
                                    ) : (
                                        <Text color={isSuccess ? '#6EE7B7' : '#FCA5A5'} bold>
                                            {isSuccess ? '✔' : '✘'}
                                        </Text>
                                    )}
                                    <Text color="#A0AEC0" bold>
                                        Running:
                                    </Text>
                                    <Box backgroundColor="#2D3748" paddingX={1}>
                                        <Text color="white" bold>
                                            {block.command}
                                        </Text>
                                    </Box>
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

                        return (
                            <Box key={idx} flexDirection="column" marginY={0.5}>
                                <Box gap={1} alignItems="center">
                                    <Text color={actionColor} bold>
                                        ✓
                                    </Text>
                                    <Text color="white">{actionLabel} file:</Text>
                                    <Text color="#63B3ED" bold underline>
                                        {block.filePath}
                                    </Text>
                                </Box>
                                {block.diff && (
                                    <Box
                                        flexDirection="column"
                                        marginLeft={2}
                                        marginTop={0.5}
                                        borderStyle="single"
                                        borderColor="#2D3748"
                                        paddingX={1}
                                        paddingY={0.5}
                                    >
                                        <Text color="gray" bold>
                                            diff --git a/{block.filePath} b/{block.filePath}
                                        </Text>
                                        <Box flexDirection="column" marginTop={0.5}>
                                            {block.diff.split('\n').map((line, lidx) => {
                                                const isAdd = line.startsWith('+')
                                                const isDel = line.startsWith('-')
                                                const isHdr = line.startsWith('@@')

                                                // Pad lines so they form a beautiful block background
                                                const paddedLine = line.padEnd(76).slice(0, 76)

                                                if (isAdd) {
                                                    return (
                                                        <Text
                                                            key={lidx}
                                                            color="#A6E22E"
                                                            backgroundColor="#1B3B22"
                                                        >
                                                            {paddedLine}
                                                        </Text>
                                                    )
                                                }
                                                if (isDel) {
                                                    return (
                                                        <Text
                                                            key={lidx}
                                                            color="#F92672"
                                                            backgroundColor="#4A181E"
                                                        >
                                                            {paddedLine}
                                                        </Text>
                                                    )
                                                }
                                                if (isHdr) {
                                                    return (
                                                        <Text key={lidx} color="#805AD5">
                                                            {line}
                                                        </Text>
                                                    )
                                                }
                                                return (
                                                    <Text key={lidx} color="gray">
                                                        {line}
                                                    </Text>
                                                )
                                            })}
                                        </Box>
                                    </Box>
                                )}
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
