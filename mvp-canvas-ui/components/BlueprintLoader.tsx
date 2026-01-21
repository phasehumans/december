import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { 
  Terminal, 
  Layout, 
  Code2, 
  CheckCircle2, 
  Loader2,
  Sparkles,
  Zap,
  Box
} from 'lucide-react';

const steps = [
  { id: 1, text: "PARSING_INTENT", subtext: "Analyzing semantic requirements...", icon: Terminal },
  { id: 2, text: "ARCHITECTING_DOM", subtext: "Resolving component hierarchy...", icon: Layout },
  { id: 3, text: "GENERATING_ASSETS", subtext: "Synthesizing vector graphics...", icon: Box },
  { id: 4, text: "OPTIMIZING_STYLES", subtext: "Applying Tailwind utility classes...", icon: Sparkles },
  { id: 5, text: "COMPILING_BUILD", subtext: "Finalizing render pass...", icon: Zap },
];

export const BlueprintLoader = () => {
  const [currentStep, setCurrentStep] = useState(0);

  // Simulate step progression
  useEffect(() => {
    const stepDuration = 1500; // 1.5s per step -> ~7.5s total
    const interval = setInterval(() => {
      setCurrentStep((prev) => (prev < steps.length - 1 ? prev + 1 : prev));
    }, stepDuration);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="w-full h-full flex flex-col items-center justify-center bg-[#050505] relative overflow-hidden font-mono">
      {/* Background Grid Effect */}
      <div 
        className="absolute inset-0 z-0 opacity-10 pointer-events-none" 
        style={{ 
            backgroundImage: 'linear-gradient(rgba(255, 255, 255, 0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(255, 255, 255, 0.05) 1px, transparent 1px)', 
            backgroundSize: '40px 40px' 
        }} 
      />
      
      {/* Vignette */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,#050505_80%)] z-0" />

      <div className="relative z-10 w-full max-w-3xl px-6">
        {/* Main Loader Container */}
        <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="bg-[#0A0A0A] border border-white/10 rounded-xl overflow-hidden shadow-[0_0_50px_-10px_rgba(255,255,255,0.05)] backdrop-blur-sm"
        >
            
            {/* Header Bar */}
            <div className="h-10 border-b border-white/5 bg-[#0F0F0F] flex items-center justify-between px-4">
                <div className="flex gap-2 opacity-50">
                    <div className="w-2.5 h-2.5 rounded-full bg-neutral-600" />
                    <div className="w-2.5 h-2.5 rounded-full bg-neutral-600" />
                    <div className="w-2.5 h-2.5 rounded-full bg-neutral-600" />
                </div>
                <div className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                    <span className="text-[10px] text-neutral-400 font-medium tracking-widest uppercase">
                        Phase_Protocol_v2.1
                    </span>
                </div>
            </div>

            <div className="p-8 grid md:grid-cols-5 gap-8">
                
                {/* Visualizer (Left - 2 Cols) */}
                <div className="md:col-span-2 flex flex-col gap-4">
                    <div className="relative aspect-square rounded-lg bg-[#050505] border border-white/5 overflow-hidden group">
                        {/* Animated Matrix Grid */}
                        <div className="absolute inset-0 grid grid-cols-8 gap-px opacity-20">
                            {Array.from({ length: 64 }).map((_, i) => (
                                <motion.div
                                    key={i}
                                    animate={{ 
                                        opacity: [0.1, 0.4, 0.1],
                                        backgroundColor: ["transparent", "#ffffff", "transparent"]
                                    }}
                                    transition={{
                                        duration: Math.random() * 3 + 2,
                                        repeat: Infinity,
                                        delay: Math.random() * 2,
                                        ease: "easeInOut"
                                    }}
                                    className="bg-white/5"
                                />
                            ))}
                        </div>

                        {/* Central Processor */}
                        <div className="absolute inset-0 flex items-center justify-center">
                            <div className="relative w-20 h-20">
                                <motion.div 
                                    className="absolute inset-0 border-t-2 border-l-2 border-white/30 rounded-tl-xl rounded-br-xl"
                                    animate={{ rotate: 360 }}
                                    transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
                                />
                                <motion.div 
                                    className="absolute inset-2 border-b-2 border-r-2 border-white/30 rounded-tr-xl rounded-bl-xl"
                                    animate={{ rotate: -360 }}
                                    transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
                                />
                                <div className="absolute inset-0 flex items-center justify-center">
                                    <div className="w-8 h-8 bg-white rounded flex items-center justify-center shadow-[0_0_15px_rgba(255,255,255,0.4)]">
                                        <Loader2 className="animate-spin text-black" size={16} />
                                    </div>
                                </div>
                            </div>
                        </div>
                        
                        {/* Scan Line */}
                        <motion.div
                            className="absolute inset-x-0 h-px bg-gradient-to-r from-transparent via-white/50 to-transparent z-10"
                            animate={{ top: ["0%", "100%"], opacity: [0, 1, 0] }}
                            transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                        />
                    </div>
                    
                    {/* Metrics */}
                    <div className="grid grid-cols-2 gap-2">
                        <div className="p-2 bg-white/5 rounded border border-white/5">
                            <div className="text-[9px] text-neutral-500 uppercase mb-1">Tokens</div>
                            <div className="text-xs text-white font-mono flex items-center gap-1">
                                <span className="animate-pulse">4,291</span>
                            </div>
                        </div>
                        <div className="p-2 bg-white/5 rounded border border-white/5">
                            <div className="text-[9px] text-neutral-500 uppercase mb-1">Latency</div>
                            <div className="text-xs text-white font-mono">12ms</div>
                        </div>
                    </div>
                </div>

                {/* Progress Steps (Right - 3 Cols) */}
                <div className="md:col-span-3 flex flex-col justify-center">
                    <div className="space-y-5">
                        {steps.map((step, idx) => {
                            const isActive = idx === currentStep;
                            const isCompleted = idx < currentStep;
                            const isPending = idx > currentStep;

                            return (
                                <div key={step.id} className="relative">
                                    <div className={cn("flex items-start gap-4 transition-all duration-500", isPending ? "opacity-20 blur-[1px]" : "opacity-100")}>
                                        {/* Icon Container */}
                                        <div className={cn(
                                            "relative w-8 h-8 rounded-lg flex items-center justify-center border shrink-0 transition-colors duration-500",
                                            isActive ? "bg-white text-black border-white shadow-[0_0_15px_rgba(255,255,255,0.2)]" : 
                                            isCompleted ? "bg-[#111] text-neutral-400 border-neutral-800" : 
                                            "bg-transparent text-neutral-700 border-neutral-800"
                                        )}>
                                            <step.icon size={14} />
                                            {isActive && (
                                                <motion.div 
                                                    className="absolute -inset-1 border border-white/20 rounded-xl"
                                                    initial={{ scale: 0.8, opacity: 0 }}
                                                    animate={{ scale: 1.2, opacity: 0 }}
                                                    transition={{ duration: 1, repeat: Infinity }}
                                                />
                                            )}
                                        </div>

                                        {/* Text Content */}
                                        <div className="flex-1 pt-0.5">
                                            <div className="flex justify-between items-center mb-1">
                                                <span className={cn(
                                                    "text-xs font-bold tracking-wider transition-colors duration-300", 
                                                    isActive ? "text-white" : "text-neutral-500"
                                                )}>
                                                    {step.text}
                                                </span>
                                                {isActive && (
                                                    <span className="text-[10px] text-neutral-400 animate-pulse">
                                                        PROCESSING
                                                    </span>
                                                )}
                                                {isCompleted && (
                                                    <span className="text-[10px] text-green-500/80">
                                                        DONE
                                                    </span>
                                                )}
                                            </div>
                                            <p className="text-[10px] text-neutral-600 font-sans leading-relaxed">
                                                {step.subtext}
                                            </p>
                                        </div>
                                    </div>
                                    
                                    {/* Connector Line */}
                                    {idx !== steps.length - 1 && (
                                        <div className="absolute left-4 top-8 bottom-0 w-px bg-neutral-800 -mb-5 opacity-50" />
                                    )}
                                </div>
                            )
                        })}
                    </div>
                </div>

            </div>

            {/* Bottom Progress Bar */}
            <div className="relative h-1 bg-neutral-900 w-full overflow-hidden">
                <motion.div 
                    className="absolute inset-y-0 left-0 bg-white shadow-[0_0_10px_rgba(255,255,255,0.5)]"
                    initial={{ width: "0%" }}
                    animate={{ width: "100%" }}
                    transition={{ duration: 8, ease: "linear" }}
                />
            </div>
        </motion.div>

        {/* Loading Message Footer */}
        <div className="mt-8 text-center">
            <motion.p 
                initial={{ opacity: 0 }} 
                animate={{ opacity: 1 }} 
                transition={{ delay: 0.5 }}
                className="text-xs text-neutral-500 font-mono tracking-widest uppercase"
            >
                <span className="inline-block w-2 h-2 bg-green-500 rounded-full mr-2 animate-pulse" />
                Establishing Secure Environment
            </motion.p>
        </div>
      </div>
    </div>
  );
};