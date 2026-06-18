import InkSpinner from 'ink-spinner'
import { Text } from 'ink'

export function Spinner() {
    return (
        <Text dimColor>
            <InkSpinner type="dots" />
        </Text>
    )
}
