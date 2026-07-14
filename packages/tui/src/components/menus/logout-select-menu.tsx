import { Box, Text } from 'ink'
import SelectInput from 'ink-select-input'

import { CustomIndicator, CustomItem } from './menu-items'

export function LogoutSelectMenu(props: any) {
    const { handleLogoutSelect, logoutItems } = props
    return (
        <Box flexDirection="column" paddingX={1}>
            <Box marginBottom={1}>
                <Text color="white">Select credential to remove:</Text>
            </Box>
            <SelectInput
                items={logoutItems}
                onSelect={(item) => handleLogoutSelect(item.value)}
                indicatorComponent={CustomIndicator}
                itemComponent={CustomItem}
            />
            <Box paddingTop={1}>
                <Box gap={1}>
                    <Text color="#89B4F8">↑↓</Text>
                    <Text color="#AAAAAA">Navigate</Text>
                    <Text color="#AAAAAA">·</Text>
                    <Text color="#89B4F8">enter</Text>
                    <Text color="#AAAAAA">Select</Text>
                    <Text color="#AAAAAA">·</Text>
                    <Text color="#89B4F8">esc</Text>
                    <Text color="#AAAAAA">Cancel</Text>
                </Box>
            </Box>
        </Box>
    )
}
