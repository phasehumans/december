import { Box, Text } from 'ink'
import React from 'react'

export const CustomIndicator = ({ isSelected }: { isSelected?: boolean }) => (
    <Box marginRight={1}>
        <Text color="#89B4F8">{isSelected ? '❯' : ' '}</Text>
    </Box>
)

export const CustomItem = ({ label, isSelected }: { label: string; isSelected?: boolean }) => (
    <Text color={isSelected ? '#89B4F8' : 'white'}>{isSelected ? label : label}</Text>
)
