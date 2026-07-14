import { Box, Text } from 'ink'
import SelectInput from 'ink-select-input'

import { CustomIndicator, CustomItem } from './menu-items'

export function PlanApproveMenu(props: any) {
    const { handlePlanApprovalSelect, planSummary } = props
    const planItems = [
        { label: '1. Approve and Execute', value: 'approve' },
        { label: '2. Reject / Cancel', value: 'reject' },
    ]
    return (
        <Box flexDirection="column" paddingX={1}>
            <Box marginBottom={1} flexDirection="column" gap={1}>
                {planSummary && (
                    <Box borderStyle="round" borderColor="cyan" paddingX={1}>
                        <Text color="cyan">{planSummary}</Text>
                    </Box>
                )}
                <Text color="white" bold>
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
