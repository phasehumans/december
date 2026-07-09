import { Box, Text } from 'ink'
import { marked } from 'marked'
import type { Tokens } from 'marked'
import React from 'react'

type Props = {
    children: string
}

const renderToken = (token: marked.Token, index: number): React.ReactNode => {
    switch (token.type) {
        case 'paragraph':
            return (
                <Box key={index} flexDirection="row" flexWrap="wrap">
                    {token.tokens?.map((t, i) => renderToken(t, i))}
                </Box>
            )
        case 'text':
            if ('tokens' in token && token.tokens) {
                return <Text key={index}>{token.tokens.map((t, i) => renderToken(t, i))}</Text>
            }
            return <Text key={index}>{token.text || token.raw}</Text>
        case 'strong':
            return (
                <Text key={index} bold>
                    {token.tokens?.map((t, i) => renderToken(t, i))}
                </Text>
            )
        case 'em':
            return (
                <Text key={index} italic>
                    {token.tokens?.map((t, i) => renderToken(t, i))}
                </Text>
            )
        case 'codespan':
            return (
                <Text key={index} backgroundColor="#303030" color="#89B4F8" bold={false}>
                    {' '}
                    {token.text}{' '}
                </Text>
            )
        case 'space':
            return <Text key={index}>{token.raw}</Text>
        case 'code':
            return (
                <Box
                    key={index}
                    flexDirection="column"
                    marginY={0.5}
                    paddingLeft={2}
                    borderLeft={false}
                >
                    <Text color="#555555">│ </Text>
                    <Text color="cyan">{token.text}</Text>
                </Box>
            )
        case 'list':
            return (
                <Box key={index} flexDirection="column" paddingLeft={1}>
                    {token.items.map((item, i) => (
                        <Box key={i} flexDirection="row">
                            <Text color="gray">{'• '}</Text>
                            <Box flexDirection="column">
                                {item.tokens.map((t, j) => renderToken(t, j))}
                            </Box>
                        </Box>
                    ))}
                </Box>
            )
        case 'heading':
            return (
                <Box key={index} marginTop={1}>
                    <Text bold color="white" underline>
                        {token.tokens?.map((t, i) => renderToken(t, i))}
                    </Text>
                </Box>
            )
        case 'link':
            return (
                <Text key={index} color="blue" underline>
                    {token.tokens?.map((t, i) => renderToken(t, i))}
                </Text>
            )
        case 'html':
            return <Text key={index}>{token.text}</Text>
        case 'escape':
            return <Text key={index}>{token.text}</Text>
        default:
            return <Text key={index}>{token.raw}</Text>
    }
}

export function Markdown({ children }: Props) {
    if (!children) return null
    const tokens = marked.lexer(children)
    return (
        <Box flexDirection="column">{tokens.map((token, index) => renderToken(token, index))}</Box>
    )
}
