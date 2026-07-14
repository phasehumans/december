import { FitAddon } from '@xterm/addon-fit'
import { Terminal } from '@xterm/xterm'
import React, { useEffect, useRef } from 'react'
import '@xterm/xterm/css/xterm.css'

interface TerminalWorkspaceProps {
    previewSessionId?: string | null
    // Here we'd typically pass a WebSocket URL or connection function
}

export const TerminalWorkspace: React.FC<TerminalWorkspaceProps> = ({ previewSessionId }) => {
    const terminalRef = useRef<HTMLDivElement>(null)
    const xtermRef = useRef<Terminal | null>(null)
    const fitAddonRef = useRef<FitAddon | null>(null)

    useEffect(() => {
        if (!terminalRef.current) return

        const xterm = new Terminal({
            theme: {
                background: '#141414',
                foreground: '#ffffff',
                cursor: '#ffffff',
                black: '#000000',
                red: '#ef4444',
                green: '#22c55e',
                yellow: '#eab308',
                blue: '#3b82f6',
                magenta: '#ec4899',
                cyan: '#06b6d4',
                white: '#ffffff',
            },
            fontFamily: '"JetBrains Mono", "Fira Code", monospace',
            fontSize: 13,
            lineHeight: 1.4,
            cursorBlink: true,
        })

        const fitAddon = new FitAddon()
        xterm.loadAddon(fitAddon)

        xterm.open(terminalRef.current)
        fitAddon.fit()

        xterm.writeln('\x1b[38;2;135;206;235mDecember Cloud Terminal\x1b[0m')
        if (previewSessionId) {
            xterm.writeln(`Connecting to Firecracker VM session ${previewSessionId}...`)
            // TODO: Implement actual WebSocket connection to the runtime service
        } else {
            xterm.writeln('Waiting for VM to boot...')
        }
        xterm.writeln('')

        xtermRef.current = xterm
        fitAddonRef.current = fitAddon

        const resizeObserver = new ResizeObserver(() => {
            if (fitAddonRef.current) {
                fitAddonRef.current.fit()
            }
        })
        resizeObserver.observe(terminalRef.current)

        return () => {
            resizeObserver.disconnect()
            xterm.dispose()
        }
    }, [previewSessionId])

    return (
        <div className="flex-1 min-h-0 flex bg-[#141414] p-2">
            <div
                className="flex-1 border border-white/10 rounded-xl overflow-hidden p-2"
                ref={terminalRef}
            />
        </div>
    )
}
