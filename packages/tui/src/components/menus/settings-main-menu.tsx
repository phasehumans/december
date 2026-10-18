import { Box, Text, useInput } from 'ink'
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
    settingsBrowserVisible?: boolean
    settingsSelectedIndex?: number
    setSettingsSelectedIndex?: (index: number) => void
    handleSettingsMainSelect: (item: { label: string; value: string }) => void
    setAuthMode?: (mode: string) => void
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
        settingsBrowserVisible = true,
        settingsSelectedIndex = 0,
        setSettingsSelectedIndex,
        handleSettingsMainSelect,
        setAuthMode,
    } = props

    useInput((input, key) => {
        if (key.escape || input === '\u001B') {
            if (setAuthMode) {
                setAuthMode('none')
            }
            return
        }
    })

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

    const formatSettingRow = (title: string, value: string) => `${title.padEnd(25, ' ')}[${value}]`

    const mainItems = [
        {
            label: formatSettingRow('Active Provider', providerLabel),
            value: 'switchProvider',
        },
        {
            label: formatSettingRow('Active Model', modelLabel),
            value: 'activeModel',
        },
        {
            label: formatSettingRow('Tool Permission', settingsToolPermission),
            value: 'toolPermission',
        },
        {
            label: formatSettingRow(
                'PathGuard Protection',
                settingsPathGuard !== false ? 'on' : 'off'
            ),
            value: 'pathGuard',
        },
        {
            label: formatSettingRow('Non-Workspace Access', settingsNonWorkspace ? 'on' : 'off'),
            value: 'nonWorkspaceAccess',
        },
        {
            label: formatSettingRow('Thinking Level', settingsThinkingLevel),
            value: 'thinkingLevel',
        },
        {
            label: formatSettingRow('Steering Mode', settingsSteeringMode),
            value: 'steeringMode',
        },
        {
            label: formatSettingRow('Follow-Up Mode', settingsFollowUpMode),
            value: 'followUpMode',
        },
        {
            label: formatSettingRow(
                'Browser Window',
                settingsBrowserVisible !== false ? 'on' : 'off'
            ),
            value: 'browserVisible',
        },
    ]

    const handleHighlight = (item: { value: string }) => {
        const idx = mainItems.findIndex((i) => i.value === item.value)
        if (idx !== -1 && setSettingsSelectedIndex) {
            setSettingsSelectedIndex(idx)
        }
    }

    const handleSelect = (item: { label: string; value: string }) => {
        const idx = mainItems.findIndex((i) => i.value === item.value)
        if (idx !== -1 && setSettingsSelectedIndex) {
            setSettingsSelectedIndex(idx)
        }
        handleSettingsMainSelect(item)
    }

    return (
        <Box flexDirection="column">
            <Box marginBottom={1}>
                <Text bold color={THEME.colors.text}>
                    Settings
                </Text>
            </Box>
            <SelectInput
                items={mainItems}
                initialIndex={settingsSelectedIndex || 0}
                onSelect={handleSelect}
                onHighlight={handleHighlight}
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
