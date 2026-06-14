import React, { useState, useEffect } from 'react'
import { render, Text, Box, useInput, useApp } from 'ink'

interface AppProps {
    model: string
}

interface LogMessage {
    type: 'system' | 'user' | 'agent' | 'thought' | 'tool' | 'output'
    content: string
    sender?: string
    timestamp: string
}

// Minimal colors matching December Web UI
const COLOR_BG = '#171615' // Warm dark grey
const COLOR_SURFACE = '#252423' // Lighter surface for input box
const COLOR_BORDER = '#333333' // Border grey
const COLOR_TEXT_MAIN = '#D6D5D4' // Light silver/grey main text
const COLOR_TEXT_MUTED = '#8F8E8D' // Medium grey subtext
const COLOR_WHITE = '#FFFFFF'

const SPINNER_FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏']

const App: React.FC<AppProps> = ({ model }) => {
    const { exit } = useApp()
    const [view, setView] = useState<'splash' | 'chat'>('splash')
    const [inputValue, setInputValue] = useState('')
    const [cursorBlink, setCursorBlink] = useState(true)

    // Execution states
    const [status, setStatus] = useState<'idle' | 'thinking' | 'streaming' | 'completed'>('idle')
    const [lastUserPrompt, setLastUserPrompt] = useState<string>('')
    const [elapsedSeconds, setElapsedSeconds] = useState(0)
    const [spinnerFrame, setSpinnerFrame] = useState(0)
    const [streamedText, setStreamedText] = useState('')

    const [messages, setMessages] = useState<LogMessage[]>([])

    // Terminal size state for responsiveness
    const [terminalSize, setTerminalSize] = useState({
        columns: process.stdout.columns || 80,
        rows: process.stdout.rows || 24,
    })

    // Track terminal resize events
    useEffect(() => {
        const handleResize = () => {
            setTerminalSize({
                columns: process.stdout.columns || 80,
                rows: process.stdout.rows || 24,
            })
        }
        process.stdout.on('resize', handleResize)
        return () => {
            process.stdout.off('resize', handleResize)
        }
    }, [])

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
                setTerminalSize({
                    columns: process.stdout.columns || 80,
                    rows: process.stdout.rows || 24,
                })
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
                            timestamp: new Date().toLocaleTimeString().slice(0, 8),
                        },
                    ])
                    setStreamedText('')
                    setStatus('completed')
                }
            }, 25) // 25ms per character for smooth typing
            return () => clearInterval(timer)
        }
    }, [status])

    // Keyboard input handler
    useInput((input, key) => {
        // Exit CLI
        if (key.ctrl && input === 'c') {
            exit()
            return
        }

        // Escape to interrupt execution
        if (key.escape) {
            if (status === 'thinking' || status === 'streaming') {
                setStreamedText('')
                setStatus('completed')
                setMessages((prev) => [
                    ...prev,
                    {
                        type: 'system',
                        content: 'Execution interrupted by user.',
                        timestamp: new Date().toLocaleTimeString().slice(0, 8),
                    },
                ])
            }
            return
        }

        // Disable input during thinking/streaming unless it is Escape/Ctrl+C
        if (status === 'thinking' || status === 'streaming') {
            return
        }

        if (key.return) {
            if (!inputValue.trim()) return

            const userMsg = inputValue
            setInputValue('')
            setLastUserPrompt(userMsg)
            setStatus('thinking')

            // Setup simulated timing transitions
            setTimeout(() => {
                setStatus('streaming')
            }, 2500) // Spend 2.5s thinking
        } else if (key.backspace || key.delete) {
            setInputValue((prev) => prev.slice(0, -1))
        } else if (input && !key.ctrl && !key.meta) {
            if (input.charCodeAt(0) >= 32) {
                setInputValue((prev) => prev + input)
            }
        }
    })

    const { columns } = terminalSize
    const showLogo = columns >= 50

    // Mathematically symmetric, high-fidelity ASCII snowflake logo (Screenshot 2 structure in line format, exactly 25 chars wide)
    const snowflake = [
        '      \\  │  /      ',
        '    \\  \\ │ /  /    ',
        '  ───\\───┼───/───  ',
        '    /  / │ \\  \\    ',
        '      /  │  \\      ',
    ]

    // Placeholder texts matching Devin CLI state
    const isBusy = status === 'thinking' || status === 'streaming'
    const inputPlaceholder = isBusy
        ? 'Guide December while it works'
        : 'Ask December to build features, fix bugs, or work on your code'

    return (
        <Box
            flexDirection="column"
            width={columns - 2}
            paddingY={1}
            paddingX={2}
            backgroundColor={COLOR_BG}
        >
            {/* BRANDING LOGO & INFO HEADER (Compact & Elegant) */}
            <Box flexDirection="row" marginBottom={2} alignItems="center">
                {/* Large White Snowflake Logo */}
                {showLogo && (
                    <Box flexDirection="column" width={26} shrink={0} marginRight={4}>
                        {snowflake.map((line, idx) => (
                            <Text key={idx} color={COLOR_WHITE} bold>
                                {line.replace(/ /g, '\u00A0')}
                            </Text>
                        ))}
                    </Box>
                )}

                <Box flexDirection="column" justifyContent="center" flexGrow={1}>
                    <Box flexDirection="row" alignItems="baseline">
                        <Text bold color={COLOR_WHITE}>
                            December CLI{' '}
                        </Text>
                        <Text color={COLOR_TEXT_MUTED} dimColor>
                            v0.1.0
                        </Text>
                    </Box>
                    <Box marginTop={0.5}>
                        <Text color={COLOR_TEXT_MUTED} wrap="wrap">
                            Free plan, use /upgrade to access better models • 100% remaining (resets
                            in 24h)
                        </Text>
                    </Box>
                </Box>
            </Box>

            {/* DYNAMIC WORKSPACE LOGS & STREAM CHAT HISTORY */}
            <Box flexDirection="column" marginY={1}>
                {/* Previous chat messages */}
                {messages.map((msg, idx) => {
                    if (msg.type === 'system') {
                        return (
                            <Box key={idx} marginY={0.5}>
                                <Text color={COLOR_TEXT_MUTED} italic>
                                    [{msg.timestamp}] {msg.content}
                                </Text>
                            </Box>
                        )
                    }
                    if (msg.type === 'user') {
                        return (
                            <Box key={idx} marginY={0.5}>
                                <Text color={COLOR_TEXT_MAIN} bold>
                                    ❯{' '}
                                </Text>
                                <Text color={COLOR_TEXT_MAIN}>{msg.content}</Text>
                            </Box>
                        )
                    }
                    return (
                        <Box key={idx} marginY={0.5}>
                            <Text color={COLOR_TEXT_MAIN}>🤖 december: {msg.content}</Text>
                        </Box>
                    )
                })}

                {/* Current running prompt and loader (Screenshot 2 view) */}
                {isBusy && lastUserPrompt && (
                    <Box flexDirection="column" marginY={0.5}>
                        <Box flexDirection="row" marginBottom={0.5}>
                            <Text color={COLOR_TEXT_MAIN} bold>
                                ❯{' '}
                            </Text>
                            <Text color={COLOR_TEXT_MAIN}>{lastUserPrompt}</Text>
                        </Box>

                        {status === 'thinking' && (
                            <Box flexDirection="row" marginY={0.5} alignItems="center">
                                <Text color="green" bold>
                                    {SPINNER_FRAMES[spinnerFrame] || '⠋'}{' '}
                                </Text>
                                <Text color={COLOR_TEXT_MUTED}>
                                    Thinking • {elapsedSeconds}s (esc to interrupt)
                                </Text>
                            </Box>
                        )}

                        {status === 'streaming' && (
                            <Box flexDirection="column" marginY={0.5}>
                                <Box flexDirection="row" alignItems="center" marginBottom={0.5}>
                                    <Text color="green" bold>
                                        {SPINNER_FRAMES[spinnerFrame] || '⠋'}{' '}
                                    </Text>
                                    <Text color={COLOR_TEXT_MUTED}>
                                        Generating response... ({elapsedSeconds}s)
                                    </Text>
                                </Box>
                                <Box flexDirection="row" marginTop={0.5}>
                                    <Text color={COLOR_TEXT_MAIN} bold>
                                        🤖 december:{' '}
                                    </Text>
                                    <Text color={COLOR_TEXT_MAIN}>{streamedText}</Text>
                                </Box>
                            </Box>
                        )}
                    </Box>
                )}
            </Box>

            {/* COMPACT INPUT BAR (Exactly 1 line height, full terminal width, no vertical padding) */}
            <Box
                flexDirection="row"
                width={columns - 4}
                paddingY={0}
                paddingX={0}
                borderStyle="single"
                borderTop={true}
                borderBottom={true}
                borderLeft={false}
                borderRight={false}
                borderColor={COLOR_BORDER}
                marginY={1}
            >
                <Text color={COLOR_TEXT_MAIN} bold>
                    ❯{' '}
                </Text>
                {inputValue ? (
                    <Text color={COLOR_TEXT_MAIN}>{inputValue}</Text>
                ) : (
                    <Text color={COLOR_TEXT_MUTED}>{inputPlaceholder}</Text>
                )}
                {cursorBlink && <Text color={COLOR_TEXT_MAIN}>█</Text>}
            </Box>

            {/* FOOTER BAR */}
            <Box justifyContent="space-between" width={columns - 4} marginBottom={1}>
                <Text color={COLOR_TEXT_MUTED}>Model: {model}</Text>
                <Text color={COLOR_TEXT_MUTED}>Looking for plan mode? /plan</Text>
            </Box>
        </Box>
    )
}

export function renderTUI(props: AppProps) {
    render(<App {...props} />)
}
