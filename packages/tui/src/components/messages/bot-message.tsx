import { Box, Text } from 'ink'

type Props = {
    content: string
    model: string
}

export function BotMessage({ content, model }: Props) {
    return (
        <Box flexDirection="column" paddingX={4} paddingY={1}>
            <Text>{content}</Text>
            <Box marginTop={1}>
                <Text dimColor>● {model}</Text>
            </Box>
        </Box>
    )
}
