import { Text } from 'ink'
import InkSpinner from 'ink-spinner'

export function Spinner() {
    return (
        <Text dimColor>
            <InkSpinner type="dots" />
        </Text>
    )
}
