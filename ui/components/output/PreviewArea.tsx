import React, { useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface PreviewAreaProps {
    html: string;
    isGenerating: boolean;
    device: 'desktop' | 'mobile';
    isVisualMode: boolean;
    onMessage: (event: MessageEvent) => void;
    iframeRef: React.RefObject<HTMLIFrameElement | null>;
}

export const PreviewArea: React.FC<PreviewAreaProps> = ({
    html,
    isGenerating,
    device,
    isVisualMode,
    onMessage,
    iframeRef
}) => {
    
    // Attach message listener for iframe communication
    useEffect(() => {
        window.addEventListener('message', onMessage);
        return () => window.removeEventListener('message', onMessage);
    }, [onMessage]);

    return (
        <div className="flex-1 overflow-hidden relative bg-[#050505] flex items-center justify-center">
            
            {/* Background Grid */}
            <div className="absolute inset-0 z-0 opacity-20 pointer-events-none" 
                style={{ 
                    backgroundImage: 'radial-gradient(#333 1px, transparent 1px)', 
                    backgroundSize: '20px 20px' 
                }} 
            />

            {/* Preview Container */}
            <div className={cn(
                "relative transition-all duration-500 bg-white shadow-2xl overflow-hidden group",
                device === 'mobile' ? "w-[375px] h-[812px] rounded-[3rem] border-[8px] border-[#1a1a1a]" : 
                "w-full h-full"
            )}>
                
                {isGenerating ? (
                    <div className="absolute inset-0 bg-[#050505] flex flex-col items-center justify-center z-50">
                        {/* High Fidelity Loader */}
                        <div className="relative flex items-center justify-center">
                            {/* Outer Rings */}
                            <motion.div 
                                animate={{ rotate: 360 }}
                                transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
                                className="w-24 h-24 rounded-full border border-white/10 border-t-white/30"
                            />
                            <motion.div 
                                animate={{ rotate: -360 }}
                                transition={{ duration: 7, repeat: Infinity, ease: "linear" }}
                                className="absolute w-16 h-16 rounded-full border border-white/10 border-b-white/30"
                            />
                            
                            {/* Core */}
                            <motion.div 
                                animate={{ scale: [1, 1.1, 1], opacity: [0.5, 1, 0.5] }}
                                transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                                className="absolute w-2 h-2 bg-white rounded-full shadow-[0_0_20px_rgba(255,255,255,0.8)]"
                            />
                        </div>
                        
                        <div className="mt-8 flex flex-col items-center gap-1">
                             <motion.span 
                                animate={{ opacity: [0.4, 1, 0.4] }}
                                transition={{ duration: 1.5, repeat: Infinity }}
                                className="text-[10px] font-mono text-neutral-400 tracking-[0.2em] uppercase"
                            >
                                Synthesizing Interface
                             </motion.span>
                        </div>
                    </div>
                ) : (
                    <iframe 
                        ref={iframeRef}
                        className={cn("w-full h-full border-0 transition-opacity", isVisualMode ? "cursor-crosshair" : "")}
                        title="Preview"
                        srcDoc={html}
                    />
                )}
            </div>
        </div>
    );
};