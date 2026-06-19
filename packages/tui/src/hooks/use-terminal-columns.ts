import { useEffect, useState } from 'react'
import { useStdout } from 'ink'

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
