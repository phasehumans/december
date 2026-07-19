import { Box, useInput, useStdout } from 'ink'
import React, { useState, useEffect } from 'react'

export function ScrollView({ children, height }: { children: React.ReactNode; height?: number }) {
    const { stdout } = useStdout()
    const [rows, setRows] = useState(stdout?.rows ?? 24)
    const [scrollTop, setScrollTop] = useState(0)

    useEffect(() => {
        if (!stdout || typeof stdout.on !== 'function') return
        const handleResize = () => setRows(stdout.rows)
        stdout.on('resize', handleResize)
        return () => {
            stdout.off('resize', handleResize)
        }
    }, [stdout])

    useInput((input, key) => {
        if (key.pageDown) {
            setScrollTop((s) => Math.max(0, s - 10))
        } else if (key.pageUp) {
            setScrollTop((s) => s + 10)
        }
    })

    const viewHeight = height || rows - 5 // subtract some lines for input bar

    return (
        <Box flexDirection="column" overflow="hidden" height={viewHeight}>
            <Box flexDirection="column" marginTop={-scrollTop}>
                {children}
            </Box>
        </Box>
    )
}
