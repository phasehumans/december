import { Box, Text } from 'ink'
import SelectInput from 'ink-select-input'
import React from 'react'

import { THEME } from '../../theme'

import { formatProviderName } from './byok-key-menu'
import { MenuFooter } from './menu-footer'
import { CustomIndicator, CustomItem } from './menu-items'

export interface SettingsMainMenuProps {
    activeProvider?: string
    selectedProvider?: string
    authMethod?: string
    activeModel?: string
    settingsPathGuard?: boolean
    settingsNonWorkspace?: boolean
    settingsToolPermission?: 'always-ask' | 'always-proceed'
    settingsThinkingLevel?: 'auto' | 'off' | 'minimal' | 'low' | 'medium' | 'high'
    settingsSteeringMode?: 'all' | 'one-at-a-time'
    settingsFollowUpMode?: 'all' | 'one-at-a-time'
    handleSettingsMainSelect: (item: { label: string; value: string }) => void
}

export function SettingsMainMenu(props: SettingsMainMenuProps | any) {
    const {
        activeProvider,
        selectedProvider,
        authMethod,
        activeModel,
        settingsNonWorkspace,
        settingsToolPermission = 'always-proceed',
        settingsThinkingLevel = 'auto',
        settingsPathGuard = true,
        settingsSteeringMode = 'all',
        settingsFollowUpMode = 'all',
        handleSettingsMainSelect,
    } = props

    const providerKey = selectedProvider || activeProvider || ''
    const providerName =
        providerKey === 'december' || providerKey === 'december_proxy'
            ? 'December Cloud'
            : formatProviderName(providerKey)
    const providerLabel = providerKey
        ? authMethod === 'subscription'
            ? `${providerName} (Subscription)`
            : authMethod === 'december'
              ? 'December Cloud'
              : `${providerName} (BYOK)`
        : 'Not configured'

    const modelLabel = activeModel || 'default'

    const mainItems = [
        {
            label: `Active Provider          [${providerLabel}]`,
            value: 'switchProvider',
        },
        {
            label: `Active Model             [${modelLabel}]`,
            value: 'activeModel',
        },
        {
            label: `Tool Permission          [${settingsToolPermission}]`,
            value: 'toolPermission',
        },
        {
            label: `PathGuard Protection     [${settingsPathGuard !== false ? 'on' : 'off'}]`,
            value: 'pathGuard',
        },
        {
            label: `Non-Workspace Access     [${settingsNonWorkspace ? 'on' : 'off'}]`,
            value: 'nonWorkspaceAccess',
        },
        {
            label: `Thinking Level           [${settingsThinkingLevel}]`,
            value: 'thinkingLevel',
        },
        {
            label: `Steering Mode            [${settingsSteeringMode}]`,
            value: 'steeringMode',
        },
        {
            label: `Follow-Up Mode           [${settingsFollowUpMode}]`,
            value: 'followUpMode',
        },
    ]

    return (
        <Box flexDirection="column" paddingX={THEME.padding.paddingX}>
            <Box marginBottom={1}>
                <Text color={THEME.colors.text}>Settings</Text>
            </Box>
            <SelectInput
                items={mainItems}
                onSelect={handleSettingsMainSelect}
                indicatorComponent={CustomIndicator}
                itemComponent={CustomItem}
            />
            <MenuFooter
                items={[
                    { key: '↑/↓', label: 'Navigate' },
                    { key: 'enter', label: 'Select' },
                    { key: 'esc', label: 'Back' },
                ]}
            />
        </Box>
    )
}
