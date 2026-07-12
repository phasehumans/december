import { Box, Text } from 'ink'
import SelectInput from 'ink-select-input'
import { CustomIndicator, CustomItem } from './menu-items'

export function ModelSelectMenu(props: any) {
    const { handleModelSelect, selectedProvider, openRouterModels, getProviderModels } = props
    return (
        <Box flexDirection="column" paddingX={1}>
            <Box marginBottom={1}>
                <Text color="white">Select Model:</Text>
            </Box>
            <SelectInput
                items={
                    selectedProvider === 'openrouter'
                        ? openRouterModels || [{ label: 'Loading models...', value: 'loading' }]
                        : getProviderModels(selectedProvider)
                }
                onSelect={handleModelSelect}
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
