import { Box, Text } from 'ink'
import React from 'react'

import { BotMessage } from './messages'
import { MessageBlock } from '@december/agent'

interface BtwMessageProps {
    query: string
    blocks: MessageBlock[]
}

export function BtwMessage({ query, blocks }: BtwMessageProps) {
    const spaceIdx = query.indexOf(' ')
    const prefix = spaceIdx !== -1 ? query.substring(0, spaceIdx) : query
    const suffix = spaceIdx !== -1 ? query.substring(spaceIdx + 1) : ''

    return (
        <Box flexDirection="column" marginTop={1}>
            <Box
                borderStyle="single"
                borderLeft
                borderRight={false}
                borderTop={false}
                borderBottom={false}
                borderColor="#FCD34D"
                paddingLeft={1}
                flexDirection="column"
            >
                <Box marginBottom={1}>
                    <Text color="#FCD34D" bold>
                        {prefix}
                    </Text>
                    {suffix && <Text color="gray"> {suffix}</Text>}
                </Box>
                <BotMessage blocks={blocks} />
            </Box>
        </Box>
    )
}
