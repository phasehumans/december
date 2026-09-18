import { Text, Box } from 'ink'
import InkSpinner from 'ink-spinner'
import React from 'react'

import { THEME } from '../theme'

export function Spinner({
    label,
    color,
    spinnerColor,
}: {
    label?: string
    color?: string
    spinnerColor?: string
}) {
    return (
        <Box gap={1} alignItems="center">
            <Text color={spinnerColor || color || THEME.colors.brand}>
                <InkSpinner type="dots" />
            </Text>
            {label && <Text color={color || THEME.colors.muted}>{label}</Text>}
        </Box>
    )
}
