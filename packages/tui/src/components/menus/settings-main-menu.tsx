import { Box, Text } from 'ink'
import SelectInput from 'ink-select-input'

import { CustomIndicator, CustomItem } from './menu-items'

export function SettingsMainMenu(props: any) {
    const {
        settingsNonWorkspace,
        settingsNotifications,
        settingsShowTasks,
        settingsShowTips,
        settingsToolPermission,
        settingsCompactMode,
        settingsSoundEffects,
        settingsAutoScroll,
        settingsStreamSpeed,
        settingsAutoUpdate,
        settingsThinkingLevel,
        settingsSteeringMode,
        settingsFollowUpMode,
        handleSettingsMainSelect,
    } = props
    const mainItems = [
        {
            label: `Non-Workspace Access     [${settingsNonWorkspace ? 'on' : 'off'}]`,
            value: 'nonWorkspaceAccess',
        },
        {
            label: `Notifications            [${settingsNotifications ? 'on' : 'off'}]`,
            value: 'notifications',
        },
        {
            label: `Show Active Tasks        [${settingsShowTasks ? 'on' : 'off'}]`,
            value: 'showActiveTasks',
        },
        {
            label: `Show Tips                [${settingsShowTips ? 'on' : 'off'}]`,
            value: 'showTips',
        },
        {
            label: `Tool Permission          [${settingsToolPermission}]`,
            value: 'toolPermission',
        },
        {
            label: `Compact Mode             [${settingsCompactMode ? 'on' : 'off'}]`,
            value: 'compactMode',
        },
        {
            label: `Sound Effects            [${settingsSoundEffects ? 'on' : 'off'}]`,
            value: 'soundEffects',
        },
        {
            label: `Auto Scroll              [${settingsAutoScroll ? 'on' : 'off'}]`,
            value: 'autoScroll',
        },
        {
            label: `Stream Speed             [${settingsStreamSpeed}]`,
            value: 'streamSpeed',
        },
        {
            label: `Auto Update              [${settingsAutoUpdate ? 'on' : 'off'}]`,
            value: 'autoUpdate',
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
        <Box flexDirection="column" paddingX={1}>
            <Box marginBottom={1}>
                <Text bold color="white">
                    Settings
                </Text>
            </Box>
            <SelectInput
                items={mainItems}
                onSelect={handleSettingsMainSelect}
                indicatorComponent={CustomIndicator}
                itemComponent={CustomItem}
            />
            <Box paddingTop={1}>
                <Box gap={1}>
                    <Text color="#89B4F8">↑↓</Text>
                    <Text color="#AAAAAA">Navigate</Text>
                    <Text color="#AAAAAA">·</Text>
                    <Text color="#89B4F8">enter</Text>
                    <Text color="#AAAAAA">Toggle</Text>
                    <Text color="#AAAAAA">·</Text>
                    <Text color="#89B4F8">esc</Text>
                    <Text color="#AAAAAA">Cancel</Text>
                </Box>
            </Box>
        </Box>
    )
}
