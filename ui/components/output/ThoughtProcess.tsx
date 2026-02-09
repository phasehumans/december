import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, BrainCircuit, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ThoughtProcessProps {
    isGenerating: boolean;
    steps: string[];
    executionTime: number;
    isOpen: boolean;
    setIsOpen: (isOpen: boolean) => void;
}

export const ThoughtProcess: React.FC<ThoughtProcessProps> = ({
    isGenerating,
    steps,
    executionTime,
    isOpen,
    setIsOpen
}) => {
    if (!isGenerating && steps.length === 0) return null;

    return (
        <div className="w-full rounded-lg border border-white/5 bg-white/[0.02] overflow-hidden mb-2">
             <button 
                onClick={() => setIsOpen(!isOpen)}
                className="w-full flex items-center justify-between px-4 py-3 hover:bg-white/5 transition-colors group"
             >
                <div className="flex items-center gap-2.5">
                    {isGenerating ? (
                        <Loader2 className="w-3.5 h-3.5 text-neutral-400 animate-spin" />
                    ) : (
                        <BrainCircuit className="w-3.5 h-3.5 text-neutral-500" />
                    )}
                    <span className="text-xs font-medium text-neutral-500 group-hover:text-neutral-300 transition-colors">
                        {isGenerating ? 'Thinking...' : `Thought for ${executionTime.toFixed(1)}s`}
                    </span>
                </div>
                <ChevronDown 
                    size={14} 
                    className={cn("text-neutral-600 transition-transform duration-200", isOpen ? "rotate-180" : "")} 
                />
             </button>

             <AnimatePresence initial={false}>
                {isOpen && (
                    <motion.div 
                        initial={{ height: 0 }} 
                        animate={{ height: 'auto' }} 
                        exit={{ height: 0 }} 
                        className="overflow-hidden"
                    >
                        <div className="px-4 pb-4 pt-1 space-y-2 border-t border-white/5">
                             {steps.map((step, idx) => (
                                <motion.div 
                                    key={idx}
                                    initial={{ opacity: 0, x: -5 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ duration: 0.2 }}
                                    className="flex items-start gap-3"
                                >
                                    <div className={cn(
                                        "mt-1.5 w-1 h-1 rounded-full shrink-0 transition-all duration-300",
                                        isGenerating && idx === steps.length - 1 ? "bg-white shadow-[0_0_5px_rgba(255,255,255,0.5)]" : "bg-neutral-800"
                                    )} />
                                    <span className={cn(
                                        "text-xs font-mono leading-relaxed transition-colors duration-300",
                                        isGenerating && idx === steps.length - 1 ? "text-neutral-300" : "text-neutral-500"
                                    )}>
                                        {step}
                                    </span>
                                </motion.div>
                            ))}
                        </div>
                    </motion.div>
                )}
             </AnimatePresence>
        </div>
    );
};