import { Box, Text } from 'ink'
import SelectInput from 'ink-select-input'
import { CustomIndicator, CustomItem } from './menu-items'

export function PlanApproveMenu(props: any) {
    const { handlePlanApprovalSelect } = props
    const planItems = [
        { label: 'Approve and Execute', value: 'approve' },
        { label: 'Reject / Cancel', value: 'reject' },
    ]
    return (
        <Box flexDirection="column" paddingX={1}>
            <Box marginBottom={1}>
                <Text color="#F1C40F" bold>
                    Plan generated. Please approve or reject:
                </Text>
            </Box>
            <SelectInput
                items={planItems}
                onSelect={handlePlanApprovalSelect}
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
                </Box>
            </Box>
        </Box>
    )
}
