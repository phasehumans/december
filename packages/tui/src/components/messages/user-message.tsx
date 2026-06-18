import { Box, Text } from 'ink'

type Props = {
    message: string
}

export function UserMessage({ message }: Props) {
    return (
        <Box paddingX={2} paddingY={1}>
            <Text>{'❯ '}</Text>
            <Text bold>{message}</Text>
        </Box>
    )
}
