'use client'

import React, { useState, useEffect, useRef } from 'react'

interface MermaidProps {
    chart: string
}

export const Mermaid: React.FC<MermaidProps> = ({ chart }) => {
    const containerRef = useRef<HTMLDivElement>(null)
    const [svg, setSvg] = useState<string>('')
    const [error, setError] = useState<boolean>(false)
    const [isMounted, setIsMounted] = useState<boolean>(false)

    useEffect(() => {
        setIsMounted(true)
    }, [])

    useEffect(() => {
        if (!isMounted) return

        let active = true

        const renderChart = async () => {
            try {
                if (!(window as any).mermaid) {
                    const script = document.createElement('script')
                    script.src = 'https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js'
                    script.async = true
                    await new Promise((resolve, reject) => {
                        script.onload = resolve
                        script.onerror = reject
                        document.head.appendChild(script)
                    })
                }

                const mermaid = (window as any).mermaid
                mermaid.initialize({
                    startOnLoad: false,
                    theme: 'dark',
                    securityLevel: 'loose',
                    themeVariables: {
                        background: '#151413',
                        primaryColor: '#242322',
                        primaryTextColor: '#D6D5C9',
                        lineColor: '#383736',
                        secondaryColor: '#171615',
                        arrowheadColor: '#8F8E8D',
                    },
                })

                const id = `mermaid-${Math.random().toString(36).substring(2, 11)}`
                const { svg: renderedSvg } = await mermaid.render(id, chart)

                if (active) {
                    setSvg(renderedSvg)
                    setError(false)
                }
            } catch (err) {
                console.error('Mermaid render error:', err)
                if (active) {
                    setError(true)
                }
            }
        }

        void renderChart()

        return () => {
            active = false
        }
    }, [chart, isMounted])

    if (!isMounted || !svg) {
        return (
            <div className="h-44 w-full bg-[#1E1D1B]/50 border border-[#2B2A29]/50 rounded-xl flex items-center justify-center animate-pulse my-4">
                <span className="text-xs text-[#7B7A79] font-medium">
                    Generating visual diagram...
                </span>
            </div>
        )
    }

    if (error) {
        return (
            <div className="p-4 bg-[#1E1D1B] border border-[#2B2A29] rounded-xl text-center text-xs text-[#7B7A79] font-mono whitespace-pre overflow-x-auto my-4">
                {chart}
            </div>
        )
    }

    return (
        <div
            ref={containerRef}
            className="w-full flex justify-center bg-[#151413] border border-[#242322] rounded-xl p-5 my-5 overflow-x-auto select-none [&>svg]:max-w-full [&>svg]:h-auto"
            dangerouslySetInnerHTML={{ __html: svg }}
        />
    )
}
