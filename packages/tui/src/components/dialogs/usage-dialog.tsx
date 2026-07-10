import { Box, Text, useInput } from 'ink'
import React from 'react'

import { useKeyboardLayer } from '../../providers/keyboard-layer'

type Props = {
    close: () => void
    toast: any
}

export function UsageDialog({ close, toast }: Props) {
    const { isTopLayer } = useKeyboardLayer()

    useInput((_input, key) => {
        if (!isTopLayer('dialog')) return
        if (key.escape || key.return) {
            close()
        }
    })

    return (
        <Box flexDirection="column" gap={1}>
            <Box
                borderStyle="single"
                borderColor="#444444"
                flexDirection="column"
                padding={1}
                gap={1}
            >
                <Text bold color="#89B4F8">
                    📊 API Usage & Costs
                </Text>

                <Box flexDirection="column">
                    <Text color="white" bold>
                        Current Session (december)
                    </Text>
                    <Box gap={2}>
                        <Text color="#AAAAAA">
                            Tokens: <Text color="white">14,250</Text>
                        </Text>
                        <Text color="#AAAAAA">
                            Requests: <Text color="white">42</Text>
                        </Text>
                        <Text color="#AAAAAA">
                            Cost: <Text color="#6EE7B7">$0.15</Text>
                        </Text>
                    </Box>
                </Box>

                <Box flexDirection="column">
                    <Text color="white" bold>
                        Overall (This Month)
                    </Text>
                    <Box gap={2}>
                        <Text color="#AAAAAA">
                            Tokens: <Text color="white">1,024,500</Text>
                        </Text>
                        <Text color="#AAAAAA">
                            Requests: <Text color="white">1,240</Text>
                        </Text>
                        <Text color="#AAAAAA">
                            Cost: <Text color="#6EE7B7">$12.45</Text>
                        </Text>
                    </Box>
                </Box>

                <Box flexDirection="column" marginTop={1}>
                    <Text color="#89B4F8" bold>
                        By Model (Month)
                    </Text>
                    <Box>
                        <Box width={20}>
                            <Text color="white">gemini-2.5-flash</Text>
                        </Box>
                        <Box width={15}>
                            <Text color="#AAAAAA">850k tokens</Text>
                        </Box>
                        <Box>
                            <Text color="#6EE7B7">$8.50</Text>
                        </Box>
                    </Box>
                    <Box>
                        <Box width={20}>
                            <Text color="white">claude-3.5-sonnet</Text>
                        </Box>
                        <Box width={15}>
                            <Text color="#AAAAAA">150k tokens</Text>
                        </Box>
                        <Box>
                            <Text color="#6EE7B7">$3.45</Text>
                        </Box>
                    </Box>
                    <Box>
                        <Box width={20}>
                            <Text color="white">gpt-4o</Text>
                        </Box>
                        <Box width={15}>
                            <Text color="#AAAAAA">24.5k tokens</Text>
                        </Box>
                        <Box>
                            <Text color="#6EE7B7">$0.50</Text>
                        </Box>
                    </Box>
                </Box>
            </Box>
            <Text color="gray">enter/esc Close</Text>
        </Box>
    )
}
