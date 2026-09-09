import { Box, Text } from 'ink'
import React from 'react'

import { THEME } from '../../theme'

type Props = {
    message: string
}

export const UserMessage = React.memo(function UserMessage({ message }: Props) {
    let displayMessage = message
    if (displayMessage.startsWith('[Skill Invocation: /')) {
        const match = displayMessage.match(/^\[Skill Invocation: (\/[^\]]+)\]/)
        if (match) {
            displayMessage = match[1]
        }
    }

    return (
        <Box
            paddingLeft={THEME.padding.paddingLeft ?? THEME.padding.paddingX}
            paddingRight={THEME.padding.paddingRight ?? 4}
            paddingY={0}
            marginTop={1}
            marginBottom={1}
            flexDirection="row"
        >
            <Box marginRight={1} flexShrink={0}>
                <Text color={THEME.colors.brand}>{THEME.glyphs.prompt}</Text>
            </Box>
            <Box flexGrow={1} flexShrink={1}>
                <Text color={THEME.colors.brand} wrap="wrap">
                    {displayMessage}
                </Text>
            </Box>
        </Box>
    )
})
