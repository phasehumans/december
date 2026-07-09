import { Box, Text } from 'ink'
import React from 'react'

export type PillProps = {
    label: string
    color?: string
    backgroundColor?: string
    dimColor?: boolean
}

export function Pill({ label, color = 'white', backgroundColor = '#333333', dimColor }: PillProps) {
    return (
        <Box backgroundColor={backgroundColor} paddingX={1} marginX={1}>
            <Text color={color} dimColor={dimColor}>
                {label}
            </Text>
        </Box>
    )
}
