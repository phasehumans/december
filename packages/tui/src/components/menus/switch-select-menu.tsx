import { Box, Text } from 'ink'
import SelectInput from 'ink-select-input'
import React from 'react'

import { THEME } from '../../theme'

import { MenuFooter } from './menu-footer'
import { CustomIndicator } from './menu-items'

export interface SwitchSelectMenuProps {
    handleSwitchSelect: (value: string) => void
    switchItems: { label: string; value: string; model?: string; isActive?: boolean }[]
}

export interface SwitchItemProps {
    label: string
    isSelected?: boolean
    isActive?: boolean
}

export const SwitchItem = ({ label, isSelected, isActive }: SwitchItemProps) => (
    <Box>
        <Text color={isSelected ? THEME.colors.brand : THEME.colors.text}>{label}</Text>
        {isActive ? <Text color={THEME.colors.success}> (Active)</Text> : null}
    </Box>
)

export function SwitchSelectMenu(props: any) {
    const { handleSwitchSelect, switchItems } = props
    return (
        <Box flexDirection="column" paddingX={THEME.padding.paddingX}>
            <Box marginBottom={1}>
                <Text color={THEME.colors.text}>Select active provider:</Text>
            </Box>
            <SelectInput
                items={switchItems || []}
                onSelect={(item) => handleSwitchSelect(item.value)}
                indicatorComponent={CustomIndicator}
                itemComponent={SwitchItem}
            />
            <MenuFooter
                items={[
                    { key: '↑/↓', label: 'Navigate' },
                    { key: 'enter', label: 'Switch' },
                    { key: 'esc', label: 'Cancel' },
                ]}
            />
        </Box>
    )
}
