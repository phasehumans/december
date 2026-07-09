import { Box, Text } from 'ink'

type Props = {
    message: string
}

export function UserMessage({ message }: Props) {
    return (
        <Box paddingX={4} paddingY={0} marginTop={1} marginBottom={0}>
            <Text bold color="white" backgroundColor="#b37400">
                {` ${message} `}
            </Text>
        </Box>
    )
}
