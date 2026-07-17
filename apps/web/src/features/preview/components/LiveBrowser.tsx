import RFB from '@novnc/novnc/core/rfb'
import React, { useEffect, useRef, useState } from 'react'
// @ts-expect-error - noVNC types might not perfectly cover core/rfb or require root import

interface LiveBrowserProps {
    vncUrl?: string // WebSocket URL for VNC
}

export const LiveBrowser: React.FC<LiveBrowserProps> = ({ vncUrl }) => {
    const containerRef = useRef<HTMLDivElement>(null)
    const [status, setStatus] = useState<string>('Disconnected')

    useEffect(() => {
        if (!vncUrl || !containerRef.current) {
            setStatus('No VNC URL provided.')
            return
        }

        let rfb: RFB | null = null

        try {
            setStatus('Connecting...')
            rfb = new RFB(containerRef.current, vncUrl, {
                credentials: { password: '' },
            })

            rfb.addEventListener('connect', () => {
                setStatus('Connected')
            })

            rfb.addEventListener('disconnect', (e: any) => {
                setStatus(`Disconnected: ${e.detail?.clean ? 'Cleanly' : 'Unexpectedly'}`)
            })

            rfb.scaleViewport = true
            rfb.resizeSession = true
        } catch (e) {
            console.error('RFB initialization failed', e)
            setStatus('Failed to initialize VNC viewer.')
        }

        return () => {
            if (rfb) {
                rfb.disconnect()
            }
        }
    }, [vncUrl])

    return (
        <div className="flex flex-col h-full w-full bg-black text-white">
            <div className="bg-gray-800 px-4 py-2 text-sm flex items-center justify-between border-b border-gray-700">
                <span className="font-semibold">Live Browser (VNC)</span>
                <span
                    className={`px-2 py-1 rounded text-xs ${status === 'Connected' ? 'bg-green-600' : 'bg-red-600'}`}
                >
                    {status}
                </span>
            </div>
            <div
                ref={containerRef}
                className="flex-1 w-full h-full overflow-hidden flex items-center justify-center"
            >
                {!vncUrl && <div className="text-gray-500">Browser is not currently active.</div>}
            </div>
        </div>
    )
}
