import React from 'react';
import { motion } from 'framer-motion';
import { Globe } from 'lucide-react';

export const DeployVisual = () => {
    return (
        <div className="absolute inset-0 bg-[#050505] flex flex-col items-center justify-center overflow-hidden">
            
            {/* World Map Background Hint */}
            <div className="absolute inset-0 opacity-10 scale-150"
                    style={{
                    backgroundImage: 'url("https://upload.wikimedia.org/wikipedia/commons/8/80/World_map_-_low_resolution.svg")',
                    backgroundPosition: 'center',
                    backgroundRepeat: 'no-repeat',
                    filter: 'invert(1)'
                    }}
            />

            <div className="relative w-24 h-24 flex items-center justify-center">
                {/* Rotating Rings */}
                <motion.div 
                    animate={{ rotate: 360 }}
                    transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
                    className="absolute inset-0 rounded-full border border-dashed border-white/10"
                />
                <motion.div 
                    animate={{ rotate: -360 }}
                    transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
                    className="absolute inset-2 rounded-full border border-dotted border-white/5"
                />
                
                {/* Center Globe */}
                <div className="w-14 h-14 bg-white/5 rounded-full flex items-center justify-center backdrop-blur-md border border-white/10 relative z-10 shadow-[0_0_30px_rgba(255,255,255,0.1)]">
                    <Globe size={28} className="text-white" strokeWidth={1.5} />
                </div>
            </div>

            {/* Live Status */}
                <div className="mt-8 flex items-center gap-2 px-3 py-1 bg-green-500/5 border border-green-500/20 rounded-full backdrop-blur-md">
                <span className="relative flex h-2 w-2">
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                </span>
                <span className="text-[10px] font-bold text-green-500 tracking-wider uppercase">Live</span>
            </div>

        </div>
    );
};