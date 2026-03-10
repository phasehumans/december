import React, { useEffect } from 'react'
import { motion } from 'framer-motion'
import { cn } from '@/shared/lib/utils'
import type { PreviewAreaProps } from '@/features/preview/types'

export const PreviewArea: React.FC<PreviewAreaProps> = ({
    html,
    isGenerating,
    device,
    isVisualMode,
    onMessage,
    iframeRef,
}) => {
    // Attach message listener for iframe communication
    useEffect(() => {
        window.addEventListener('message', onMessage)
        return () => window.removeEventListener('message', onMessage)
    }, [onMessage])

    return (
        <div className="flex-1 overflow-hidden relative bg-[#1F1F1F] flex items-center justify-center p-0.5 pb-2">
            {/* Background Grid */}
            <div
                className="absolute inset-0 z-0 opacity-20 pointer-events-none"
                style={{
                    backgroundImage: 'radial-gradient(#333 1px, transparent 1px)',
                    backgroundSize: '20px 20px',
                }}
            />

            {/* Preview Container */}
            <div
                className={cn(
                    'relative transition-all duration-500 bg-white shadow-2xl overflow-hidden group',
                    device === 'mobile'
                        ? 'w-[375px] h-[812px] rounded-[3rem] border-[8px] border-[#1a1a1a]'
                        : device === 'tablet'
                          ? 'w-[768px] h-[1024px] rounded-[2rem] border-[8px] border-[#1a1a1a]'
                          : 'w-full h-full rounded-xl border border-[#262626] shadow-2xl'
                )}
            >
                {isGenerating ? (
                    <div className="absolute inset-0 bg-[#1F1F1F] flex flex-col items-center justify-center z-50">
                        <div className="flex flex-col items-center gap-6">
                            <div className="relative flex items-center justify-center">
                                <motion.div
                                    initial={{ scale: 0.8, opacity: 0.5 }}
                                    animate={{ scale: 1.2, opacity: 0 }}
                                    transition={{
                                        duration: 1.5,
                                        repeat: Infinity,
                                        ease: 'easeOut',
                                    }}
                                    className="absolute w-12 h-12 bg-white/10 rounded-full"
                                />
                                <motion.div
                                    initial={{ scale: 0.8, opacity: 0.5 }}
                                    animate={{ scale: 1.2, opacity: 0 }}
                                    transition={{
                                        duration: 1.5,
                                        repeat: Infinity,
                                        ease: 'easeOut',
                                        delay: 0.5,
                                    }}
                                    className="absolute w-12 h-12 bg-white/10 rounded-full"
                                />
                                <div className="w-3 h-3 bg-white rounded-full shadow-[0_0_10px_rgba(255,255,255,0.5)]" />
                            </div>
                            <motion.span
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                transition={{ duration: 0.5 }}
                                className="text-xs font-medium text-neutral-400 tracking-widest uppercase"
                            >
                                Generating
                            </motion.span>
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
                        srcDoc={html}
                    />
                )}
            </div>
        </div>
    )
}


