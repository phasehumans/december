import React, { useState, useEffect } from 'react'
import { render, Text, Box, useInput, useApp, useStdout } from 'ink'

interface AppProps {
    model: string
}

interface LogMessage {
    type: 'user' | 'agent' | 'system' | 'thought' | 'tool'
    content: string
    sender?: string
}

// Minimal colors matching December/Devin terminal styling
const COLOR_WHITE = '#FFFFFF'
const COLOR_MUTED = '#8F8E8D'
const COLOR_GREEN = '#00FF00'
const COLOR_BORDER = '#333333'

const SPINNER_FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏']

// Responsive width hook utilizing Ink's stdout stream
const useStdoutDimensions = () => {
    const { stdout } = useStdout()
    const [dimensions, setDimensions] = useState({
        columns: stdout ? stdout.columns : 80,
        rows: stdout ? stdout.rows : 24,
    })

    useEffect(() => {
        if (!stdout) return
        const handler = () => {
            setDimensions({
                columns: stdout.columns,
                rows: stdout.rows,
            })
        }
        stdout.on('resize', handler)
        return () => {
            stdout.off('resize', handler)
        }
    }, [stdout])

    return [dimensions.columns, dimensions.rows] as const
}

// Coordinate-based snowflake logo
const LOGO_COORDINATES = [
    [4, 0],
    [2, 1],
    [4, 1],
    [6, 1],
    [3, 2],
    [4, 2],
    [5, 2],
    [0, 3],
    [2, 3],
    [4, 3],
    [6, 3],
    [8, 3],
    [3, 4],
    [4, 4],
    [5, 4],
    [2, 5],
    [4, 5],
    [6, 5],
    [4, 6],
]

// Generate the logo as 7 lines of 9-character grid
const generateLogo = (): string[] => {
    const grid = Array.from({ length: 7 }, () => Array(9).fill(' '))
    for (const [x, y] of LOGO_COORDINATES) {
        if (x !== undefined && y !== undefined && y >= 0 && y < 7 && x >= 0 && x < 9) {
            grid[y]![x] = '•'
        }
    }
    return grid.map((row) => row.join('').replace(/ /g, '\u00A0'))
}

const App: React.FC<AppProps> = ({ model }) => {
    const { exit } = useApp()
    const [width] = useStdoutDimensions()
    const [inputValue, setInputValue] = useState('')
    const [cursorBlink, setCursorBlink] = useState(true)

    // Execution states
    const [status, setStatus] = useState<'idle' | 'thinking' | 'streaming' | 'completed'>('idle')
    const [lastUserPrompt, setLastUserPrompt] = useState<string>('')
    const [elapsedSeconds, setElapsedSeconds] = useState(0)
    const [spinnerFrame, setSpinnerFrame] = useState(0)
    const [streamedText, setStreamedText] = useState('')

    const [messages, setMessages] = useState<LogMessage[]>([])

    // Cursor blink effect
    useEffect(() => {
        const interval = setInterval(() => {
            setCursorBlink((b) => !b)
        }, 600)
        return () => clearInterval(interval)
    }, [])

    // Spinner animation effect
    useEffect(() => {
        if (status === 'thinking' || status === 'streaming') {
            const timer = setInterval(() => {
                setSpinnerFrame((f) => (f + 1) % SPINNER_FRAMES.length)
            }, 80)
            return () => clearInterval(timer)
        }
    }, [status])

    // Elapsed seconds timer
    useEffect(() => {
        if (status === 'thinking' || status === 'streaming') {
            const timer = setInterval(() => {
                setElapsedSeconds((s) => s + 1)
            }, 1000)
            return () => clearInterval(timer)
        } else {
            setElapsedSeconds(0)
        }
    }, [status])

    // Typewriter streaming response simulation
    useEffect(() => {
        if (status === 'streaming') {
            const fullText =
                "I've successfully created the workspace files and run bun install inside the sandboxed environment. The environment is now ready for previews."
            let index = 0
            setStreamedText('')
            const timer = setInterval(() => {
                if (index < fullText.length) {
                    setStreamedText((t) => t + fullText[index])
                    index++
                } else {
                    clearInterval(timer)
                    setMessages((prev) => [
                        ...prev,
                        {
                            type: 'agent',
                            content: fullText,
                            sender: 'december',
                        },
                    ])
                    setStreamedText('')
                    setStatus('completed')
                }
            }, 25)
            return () => clearInterval(timer)
        }
    }, [status])

    // Keyboard input handler
    useInput((input, key) => {
        if (key.ctrl && input === 'c') {
            exit()
            return
        }

        if (key.escape) {
            if (status === 'thinking' || status === 'streaming') {
                setStreamedText('')
                setStatus('completed')
                setMessages((prev) => [
                    ...prev,
                    {
                        type: 'system',
                        content: 'Execution interrupted by user.',
                    },
                ])
            }
            return
        }

        if (status === 'thinking' || status === 'streaming') {
            return
        }

        if (key.return) {
            if (!inputValue.trim()) return

            const userMsg = inputValue
            setInputValue('')
            setLastUserPrompt(userMsg)
            setStatus('thinking')

            setTimeout(() => {
                setStatus('streaming')
            }, 2000)
        } else if (key.backspace || key.delete) {
            setInputValue((prev) => prev.slice(0, -1))
        } else if (input && !key.ctrl && !key.meta) {
            if (input.charCodeAt(0) >= 32) {
                setInputValue((prev) => prev + input)
            }
        }
    })

    const logoLines = generateLogo()
    const isBusy = status === 'thinking' || status === 'streaming'

    // Placeholder text matching Devin CLI state
    const inputPlaceholder = isBusy
        ? 'Guide December while it works'
        : 'Ask December to build features, fix bugs, or work on your code'

    return (
        <Box flexDirection="column" width={width} paddingY={0} paddingX={1}>
            {/* TOP HEADER */}
            <Box flexDirection="row" marginBottom={1} alignItems="flex-start">
                {/* Dotted Snowflake Logo */}
                <Box flexDirection="column" width={12} shrink={0} marginRight={4}>
                    {logoLines.map((line, idx) => (
                        <Text key={idx} color={COLOR_WHITE} bold>
                            {line}
                        </Text>
                    ))}
                </Box>

                {/* Metadata info */}
                <Box flexDirection="column" justifyContent="center">
                    <Text bold color={COLOR_WHITE}>
                        December CLI
                    </Text>
                    <Text color={COLOR_MUTED}>v0.1.0</Text>
                    <Box marginTop={1}>
                        <Text color={COLOR_MUTED}>
                            Free plan, use /upgrade to access better models • 100% remaining
                        </Text>
                    </Box>
                </Box>
            </Box>

            {/* CONVERSATION AREA */}
            <Box flexDirection="column" marginY={0}>
                {messages.map((msg, idx) => {
                    if (msg.type === 'system') {
                        return (
                            <Box key={idx} marginY={0}>
                                <Text color={COLOR_MUTED} italic>
                                    {msg.content}
                                </Text>
                            </Box>
                        )
                    }
                    if (msg.type === 'user') {
                        return (
                            <Box key={idx} marginY={0}>
                                <Text color={COLOR_WHITE} bold>
                                    ❯{' '}
                                </Text>
                                <Text color={COLOR_WHITE}>{msg.content}</Text>
                            </Box>
                        )
                    }
                    return (
                        <Box key={idx} marginY={1}>
                            <Text color={COLOR_WHITE}>december: {msg.content}</Text>
                        </Box>
                    )
                })}

                {/* Current running prompt and loader */}
                {isBusy && lastUserPrompt && (
                    <Box flexDirection="column" marginY={0}>
                        <Box flexDirection="row">
                            <Text color={COLOR_WHITE} bold>
                                ❯{' '}
                            </Text>
                            <Text color={COLOR_WHITE}>{lastUserPrompt}</Text>
                        </Box>

                        {status === 'thinking' && (
                            <Box flexDirection="row" marginY={0} alignItems="center">
                                <Text color={COLOR_GREEN} bold>
                                    {SPINNER_FRAMES[spinnerFrame] || '⠋'}{' '}
                                </Text>
                                <Text color={COLOR_MUTED}>
                                    Thinking • {elapsedSeconds}s (esc to interrupt)
                                </Text>
                            </Box>
                        )}

                        {status === 'streaming' && (
                            <Box flexDirection="column" marginY={0}>
                                <Box flexDirection="row" alignItems="center">
                                    <Text color={COLOR_GREEN} bold>
                                        {SPINNER_FRAMES[spinnerFrame] || '⠋'}{' '}
                                    </Text>
                                    <Text color={COLOR_MUTED}>
                                        Generating response... ({elapsedSeconds}s)
                                    </Text>
                                </Box>
                                <Box flexDirection="row" marginTop={0}>
                                    <Text color={COLOR_WHITE} bold>
                                        december:{' '}
                                    </Text>
                                    <Text color={COLOR_WHITE}>{streamedText}</Text>
                                </Box>
                            </Box>
                        )}
                    </Box>
                )}
            </Box>

            {/* INPUT AREA */}
            <Box flexDirection="column" marginY={1}>
                <Text color={COLOR_BORDER}>{'─'.repeat(width - 2)}</Text>
                <Box flexDirection="row" paddingY={0}>
                    <Text color={COLOR_WHITE} bold>
                        ❯{' '}
                    </Text>
                    {inputValue ? (
                        <Text color={COLOR_WHITE}>{inputValue}</Text>
                    ) : (
                        <Text color={COLOR_MUTED}>{inputPlaceholder}</Text>
                    )}
                    {cursorBlink && <Text color={COLOR_WHITE}>█</Text>}
                </Box>
                <Text color={COLOR_BORDER}>{'─'.repeat(width - 2)}</Text>
            </Box>

            {/* FOOTER */}
            <Box justifyContent="space-between" width={width - 2}>
                <Text color={COLOR_MUTED}>SWE-1.0 Fast</Text>
                <Text color={COLOR_MUTED}>Context: 14k / 200k tokens (7%)</Text>
            </Box>
        </Box>
    )
}

export function renderTUI(props: AppProps) {
    render(<App {...props} />)
}
