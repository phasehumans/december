import { Text, Box } from 'ink'
import InkSpinner from 'ink-spinner'
import React from 'react'

import { THEME } from '../theme'

import { OffscreenFreeze } from './offscreen-freeze'

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
            <OffscreenFreeze>
                <Text color={spinnerColor || color || THEME.colors.brand}>
                    <InkSpinner type="dots" />
                </Text>
            </OffscreenFreeze>
            {label && <Text color={color || THEME.colors.muted}>{label}</Text>}
        </Box>
    )
}
