import React, { useEffect } from 'react'
import { motion } from 'framer-motion'
import { cn } from '@/shared/lib/utils'
import type { PreviewAreaProps } from '@/features/preview/types'

const loaderDotDelays = [0, 0.12, 0.24]

export const PreviewArea: React.FC<PreviewAreaProps> = ({
    html,
    isGenerating,
    device,
    isVisualMode,
    onMessage,
    iframeRef,
    fullscreen = false,
    showStructureOnly = false,
}) => {
    // Attach message listener for iframe communication
    useEffect(() => {
        window.addEventListener('message', onMessage)
        return () => window.removeEventListener('message', onMessage)
    }, [onMessage])

    const srcDoc = React.useMemo(() => {
        if (!fullscreen) {
            return html
        }

        const hasViewportMeta = /<meta[^>]+name=["']viewport["'][^>]*>/i.test(html)

        if (hasViewportMeta) {
            return html
        }

        const viewportTag = '<meta name="viewport" content="width=device-width, initial-scale=1" />'

        if (/<head[^>]*>/i.test(html)) {
            return html.replace(/<head([^>]*)>/i, `<head$1>${viewportTag}`)
        }

        return `<!DOCTYPE html><html><head>${viewportTag}</head><body>${html}</body></html>`
    }, [html, fullscreen])

    const showLoader = isGenerating
    const showStructurePlaceholder = showStructureOnly && !isGenerating

    return (
        <div
            className={cn(
                'overflow-hidden relative bg-[#1F1F1F]',
                fullscreen
                    ? 'h-full w-full min-h-0'
                    : 'flex-1 flex items-center justify-center p-0.5 pb-2'
            )}
        >
            {!fullscreen && (
                <div
                    className="absolute inset-0 z-0 opacity-20 pointer-events-none"
                    style={{
                        backgroundImage: 'radial-gradient(#333 1px, transparent 1px)',
                        backgroundSize: '20px 20px',
                    }}
                />
            )}

            <div
                className={cn(
                    'relative transition-all duration-500 bg-white shadow-2xl overflow-hidden group',
                    fullscreen
                        ? 'w-full h-full rounded-2xl border border-white/10'
                        : device === 'mobile'
                          ? 'w-[375px] h-[812px] rounded-[3rem] border-[8px] border-[#1a1a1a]'
                          : device === 'tablet'
                            ? 'w-[768px] h-[1024px] rounded-[2rem] border-[8px] border-[#1a1a1a]'
                            : 'w-full h-full rounded-xl border border-[#262626] shadow-2xl'
                )}
            >
                {showLoader ? (
                    <div className="absolute inset-0 z-50 flex items-center justify-center bg-[#171716]">
                        <div className="flex items-center gap-2">
                            {loaderDotDelays.map((delay, index) => (
                                <motion.span
                                    key={index}
                                    className="h-2.5 w-2.5 rounded-full bg-white/80"
                                    animate={{
                                        opacity: [0.3, 1, 0.3],
                                        y: [0, -3, 0],
                                    }}
                                    transition={{
                                        duration: 0.75,
                                        repeat: Infinity,
                                        ease: 'easeInOut',
                                        delay,
                                    }}
                                />
                            ))}
                        </div>
                    </div>
                ) : showStructurePlaceholder ? (
                    <div className="absolute inset-0 z-40 bg-[#171716] p-5">
                        <div className="h-full w-full rounded-xl border border-white/10 bg-[#1F1F1F] p-4 md:p-5 flex flex-col gap-3">
                            <div className="h-8 w-40 rounded-md bg-white/10" />
                            <div className="h-3 w-72 rounded-md bg-white/5 max-w-full" />
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-2">
                                <div className="h-28 rounded-lg border border-white/10 bg-white/[0.03]" />
                                <div className="h-28 rounded-lg border border-white/10 bg-white/[0.03]" />
                            </div>
                            <div className="h-24 rounded-lg border border-white/10 bg-white/[0.03]" />
                            <div className="mt-auto h-10 rounded-md bg-white/[0.04]" />
                        </div>
                    </div>
                ) : (
                    <iframe
                        ref={iframeRef}
                        className={cn(
                            'w-full h-full border-0 transition-opacity',
                            isVisualMode ? 'cursor-crosshair' : ''
                        )}
                        title="Preview"
                        srcDoc={srcDoc}
                    />
                )}
            </div>
        </div>
    )
}
