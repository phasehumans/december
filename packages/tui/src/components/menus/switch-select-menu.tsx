import { Box, Text } from 'ink'
import SelectInput from 'ink-select-input'
import React from 'react'

import { THEME } from '../../theme'

import { MenuFooter } from './menu-footer'
import { CustomIndicator, CustomItem } from './menu-items'

export interface SwitchSelectMenuProps {
    handleSwitchSelect: (value: string) => void
    switchItems: { label: string; value: string; model?: string; isActive?: boolean }[]
}

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
                itemComponent={CustomItem}
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
