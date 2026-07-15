import { highlight } from 'cli-highlight'
import { Box, Text, useFocus, useInput } from 'ink'
import { marked } from 'marked'
import React, { useState } from 'react'

type Props = {
    children: string
}

const renderToken = (token: any, index: number): React.ReactNode => {
    switch (token.type) {
        case 'paragraph':
            return (
                <Text key={index}>
                    {token.tokens?.map((t: any, i: number) => renderToken(t, i))}
                </Text>
            )
        case 'text':
            if ('tokens' in token && token.tokens) {
                return (
                    <Text key={index}>
                        {token.tokens.map((t: any, i: number) => renderToken(t, i))}
                    </Text>
                )
            }
            return <Text key={index}>{token.text || token.raw}</Text>
        case 'strong':
            return (
                <Text key={index} bold>
                    {token.tokens?.map((t: any, i: number) => renderToken(t, i))}
                </Text>
            )
        case 'em':
            return (
                <Text key={index} italic>
                    {token.tokens?.map((t: any, i: number) => renderToken(t, i))}
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
            return null
        case 'code':
            if (token.lang === 'mermaid') {
                return (
                    <Box
                        key={index}
                        flexDirection="column"
                        paddingX={2}
                        paddingY={1}
                        borderStyle="round"
                        borderColor="#A78BFA"
                    >
                        <Text color="#A78BFA" bold>
                            Mermaid Diagram
                        </Text>
                        <Text color="#AAAAAA">{token.text}</Text>
                    </Box>
                )
            }
            return <CodeBlock token={token} key={index} />
        case 'list':
            return (
                <Box key={index} flexDirection="column" paddingLeft={1}>
                    {token.items.map((item: any, i: number) => (
                        <Box key={i} flexDirection="row">
                            <Text color="gray">{'• '}</Text>
                            <Box flexDirection="column">
                                {item.tokens.map((t: any, j: number) => renderToken(t, j))}
                            </Box>
                        </Box>
                    ))}
                </Box>
            )
        case 'heading':
            return (
                <Box key={index}>
                    <Text bold color="white" underline>
                        {token.tokens?.map((t: any, i: number) => renderToken(t, i))}
                    </Text>
                </Box>
            )
        case 'link':
            return (
                <Text key={index} color="blue" underline>
                    {token.tokens?.map((t: any, i: number) => renderToken(t, i))}
                </Text>
            )
        case 'html':
            return <Text key={index}>{token.text}</Text>
        case 'escape':
            return <Text key={index}>{token.text}</Text>
        case 'table':
            return (
                <Box
                    key={index}
                    paddingX={2}
                    paddingY={1}
                    borderStyle="round"
                    borderColor="#555555"
                >
                    <Text>{token.raw}</Text>
                </Box>
            )
        default:
            return <Text key={index}>{token.raw}</Text>
    }
}

function CodeBlock({ token }: { token: any }) {
    const { isFocused } = useFocus()
    const [expanded, setExpanded] = useState(false)

    useInput((input, key) => {
        if (isFocused && key.return) {
            setExpanded((prev) => !prev)
        }
    })

    const lines = token.text.split('\n')
    const isLarge = lines.length > 30

    const lang = token.lang || 'typescript'
    const barWidth = 60
    const topBarLength = Math.max(0, barWidth - lang.length - 4)
    const topBar = `┌── ${lang} ${'─'.repeat(topBarLength)}`
    const bottomBar = `└${'─'.repeat(barWidth - 1)}`

    let contentToHighlight = token.text
    if (isLarge && !expanded) {
        contentToHighlight = lines.slice(0, 15).join('\n')
    }

    const highlighted = React.useMemo(() => {
        return highlight(contentToHighlight, {
            language: lang,
            ignoreIllegals: true,
        })
    }, [contentToHighlight, lang])

    return (
        <Box flexDirection="column" paddingY={1}>
            <Text color={isFocused ? '#89B4F8' : '#475569'}>{topBar}</Text>
            <Box flexDirection="column" paddingLeft={2}>
                <Text>{highlighted}</Text>
            </Box>
            {isLarge && !expanded ? (
                <Box flexDirection="column" paddingLeft={2}>
                    <Text color="#475569">...</Text>
                    <Text color={isFocused ? '#89B4F8' : '#888888'}>
                        {isFocused
                            ? '> Press Enter to expand (' + (lines.length - 15) + ' more lines)'
                            : '... (truncated, tab to focus)'}
                    </Text>
                </Box>
            ) : isLarge && expanded ? (
                <Box flexDirection="column" paddingLeft={2}>
                    <Text color={isFocused ? '#89B4F8' : '#888888'}>
                        {isFocused ? '> Press Enter to collapse' : ''}
                    </Text>
                </Box>
            ) : null}
            <Text color={isFocused ? '#89B4F8' : '#475569'}>{bottomBar}</Text>
        </Box>
    )
}

export function Markdown({ children }: Props) {
    if (!children) return null
    const tokens = marked.lexer(children).filter((t) => t.type !== 'space')
    return (
        <Box flexDirection="column" gap={1}>
            {tokens.map((token, index) => renderToken(token, index))}
        </Box>
    )
}
