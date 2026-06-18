import { Box, Text } from 'ink'

import { useTheme } from '../providers/theme'

export function StatusBar() {
    const { colors } = useTheme()

    return (
        <Box paddingX={2} justifyContent="space-between">
            <Text color={colors.primary}>opus-4-6</Text>
            <Text dimColor>Type @ to mention files and add them as context</Text>
        </Box>
    )
}
