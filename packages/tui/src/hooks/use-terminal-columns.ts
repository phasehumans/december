import { useStdout } from 'ink'
import { useEffect, useState } from 'react'

export function useTerminalColumns() {
    const { stdout } = useStdout()
    const [columns, setColumns] = useState(stdout?.columns ?? 80)

    useEffect(() => {
        if (!stdout || typeof stdout.on !== 'function') return

        const handleResize = () => {
            setColumns(stdout.columns)
        }

        stdout.on('resize', handleResize)
        return () => {
            stdout.off('resize', handleResize)
        }
    }, [stdout])

    return columns
}
