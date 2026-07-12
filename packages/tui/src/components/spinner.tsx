import { Text, Box } from 'ink'
import InkSpinner from 'ink-spinner'

export function Spinner({ label }: { label?: string }) {
    return (
        <Box gap={1} alignItems="center">
            <Text dimColor color="cyan">
                <InkSpinner type="dots" />
            </Text>
            {label && <Text dimColor>{label}</Text>}
        </Box>
    )
}
