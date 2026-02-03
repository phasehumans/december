import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
    Code, 
    Eye, 
    Share, 
    Monitor, 
    Smartphone, 
    Tablet,
    ArrowUp,
    Menu,
    Plus,
    Check,
    ChevronDown,
    ChevronRight,
    Copy,
    RefreshCw,
    Sparkles
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Logo } from './Logo';

interface OutputScreenProps {
    onBack?: () => void;
    isGenerating?: boolean;
}

export const OutputScreen: React.FC<OutputScreenProps> = ({ onBack, isGenerating = false }) => {
  const [activeTab, setActiveTab] = useState<'preview' | 'code'>('preview');
  const [device, setDevice] = useState<'desktop' | 'tablet' | 'mobile'>('desktop');
  
  // State for simulated thinking steps
  const [steps, setSteps] = useState<string[]>([]);
  const [isThoughtsOpen, setIsThoughtsOpen] = useState(true);
  
  useEffect(() => {
    if (isGenerating) {
        setSteps([]);
        setIsThoughtsOpen(true);
        const sequences = [
            "Analyzing request intent",
            "Scaffolding component architecture",
            "Generating Tailwind utility classes",
            "Synthesizing responsive layout",
            "Finalizing render pass"
        ];
        
        let i = 0;
        const interval = setInterval(() => {
            if (i < sequences.length) {
                setSteps(prev => [...prev, sequences[i]]);
                i++;
            } else {
                clearInterval(interval);
            }
        }, 800);
        
        return () => clearInterval(interval);
    }
  }, [isGenerating]);

  // Auto-collapse thoughts when done
  useEffect(() => {
      if (!isGenerating && steps.length > 0) {
          const timeout = setTimeout(() => setIsThoughtsOpen(false), 800);
          return () => clearTimeout(timeout);
      }
  }, [isGenerating, steps]);

  return (
    <div className="flex w-full h-full bg-black text-white font-sans overflow-hidden">
      
      {/* Sidebar - Chat / History */}
      <aside className="w-[350px] h-full border-r border-white/10 bg-[#050505] flex flex-col overflow-hidden shrink-0 z-20">
        {/* Header */}
        <div className="h-14 flex items-center px-4 border-b border-white/5 shrink-0 gap-3">
            <button onClick={onBack} className="text-neutral-500 hover:text-white transition-colors p-1 rounded-md hover:bg-white/5">
                <Menu size={18} />
            </button>
            <div className="flex items-center gap-2 select-none cursor-default">
                <Logo className="scale-75 origin-left" />
                <span className="text-neutral-600 font-mono text-sm translate-y-[1px]">{'>'}</span>
            </div>
        </div>

        {/* Chat Content */}
        <div className="flex-1 overflow-y-auto p-4 scrollbar-hide">
            <div className="flex flex-col gap-6">
                
                {/* User Message */}
                <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="group flex flex-col items-end gap-1"
                >
                    <div className="bg-[#1C1C1C] text-neutral-100 text-sm px-4 py-3 rounded-2xl rounded-tr-sm max-w-[90%] leading-relaxed border border-white/5 shadow-sm group-hover:border-white/10 transition-colors selection:bg-white/20">
                        Create a modern landing page for a SaaS company called "Acme Corp"
                    </div>
                    <span className="text-[10px] text-neutral-600 pr-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        Just now
                    </span>
                </motion.div>

                {/* AI Response Section */}
                {(isGenerating || steps.length > 0) && (
                    <div className="flex flex-col gap-4 animate-in fade-in duration-500">
                        
                        {/* Thinking Process Card */}
                        <div className="w-full bg-[#0A0A0A] rounded-xl border border-white/5 overflow-hidden transition-all duration-300 hover:border-white/10">
                             <button 
                                onClick={() => setIsThoughtsOpen(!isThoughtsOpen)}
                                className="w-full flex items-center justify-between px-4 py-3 hover:bg-white/[0.02] transition-colors group"
                             >
                                <div className="flex items-center gap-2.5">
                                    {isGenerating ? (
                                        <div className="relative flex items-center justify-center w-3.5 h-3.5">
                                            <div className="absolute inset-0 border border-neutral-700 rounded-full" />
                                            <div className="absolute inset-0 border-t border-blue-500 rounded-full animate-spin" />
                                        </div>
                                    ) : (
                                        <Check className="w-3.5 h-3.5 text-green-500" />
                                    )}
                                    <span className="text-xs font-medium text-neutral-400 font-mono tracking-tight group-hover:text-neutral-300 transition-colors">
                                        {isGenerating ? 'Thinking...' : 'Process Complete'}
                                    </span>
                                </div>
                                {isThoughtsOpen ? (
                                    <ChevronDown size={14} className="text-neutral-600 group-hover:text-neutral-400 transition-colors" />
                                ) : (
                                    <ChevronRight size={14} className="text-neutral-600 group-hover:text-neutral-400 transition-colors" />
                                )}
                             </button>

                             <AnimatePresence initial={false}>
                                {isThoughtsOpen && (
                                    <motion.div 
                                        initial={{ height: 0 }} 
                                        animate={{ height: 'auto' }} 
                                        exit={{ height: 0 }} 
                                        className="overflow-hidden"
                                    >
                                        <div className="px-4 pb-4 pt-1 space-y-3 border-t border-white/5 border-dashed bg-black/20">
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
                                                        isGenerating && idx === steps.length - 1 ? "bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.8)] scale-125" : "bg-neutral-800"
                                                    )} />
                                                    <span className={cn(
                                                        "text-xs font-mono leading-relaxed transition-colors duration-300",
                                                        isGenerating && idx === steps.length - 1 ? "text-neutral-200" : "text-neutral-500"
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

                        {/* Final LLM Message */}
                        {!isGenerating && (
                            <motion.div 
                                initial={{ opacity: 0, y: 5 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.4, delay: 0.1 }}
                                className="pl-1 space-y-3"
                            >
                                <div className="text-sm text-neutral-300 leading-7 font-light selection:bg-blue-500/20">
                                    I've crafted a high-fidelity landing page for <span className="text-white font-medium">Acme Corp</span>. 
                                    It features a dark-themed aesthetic, dynamic metrics grid, and a responsive navbar.
                                </div>
                                
                                <div className="flex gap-2 pt-1">
                                    <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 border border-white/5 hover:bg-white/10 hover:border-white/10 text-[10px] font-medium text-neutral-400 hover:text-white transition-all group">
                                        <Copy size={12} className="group-hover:scale-110 transition-transform" />
                                        <span>Copy</span>
                                    </button>
                                    <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 border border-white/5 hover:bg-white/10 hover:border-white/10 text-[10px] font-medium text-neutral-400 hover:text-white transition-all group">
                                        <RefreshCw size={12} className="group-hover:rotate-180 transition-transform duration-500" />
                                        <span>Regenerate</span>
                                    </button>
                                </div>
                            </motion.div>
                        )}
                    </div>
                )}
            </div>
        </div>

        {/* Input Area */}
        <div className="p-4 border-t border-white/5 bg-[#050505] shrink-0 z-30">
            <div className="w-full bg-[#09090b] rounded-[24px] p-3 border border-white/10 ring-1 ring-white/5 focus-within:ring-white/20 focus-within:bg-[#0c0c0e] transition-all shadow-[inset_0_2px_4px_rgba(0,0,0,0.5)] group">
                <textarea 
                    placeholder="Ask a follow-up..."
                    className="w-full bg-transparent text-sm text-white px-1 py-1 min-h-[40px] max-h-[120px] resize-none outline-none placeholder-neutral-600 font-light leading-relaxed scrollbar-hide"
                />
                <div className="flex items-center justify-between mt-2 px-1">
                    <button className="p-1.5 rounded-full text-neutral-500 hover:text-white hover:bg-neutral-800 transition-colors">
                        <Plus size={18} />
                    </button>
                    <button className="p-2 bg-white text-black rounded-full hover:scale-105 transition-all shadow-[0_0_15px_rgba(255,255,255,0.1)] active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed">
                        <ArrowUp size={16} strokeWidth={3} />
                    </button>
                </div>
            </div>
        </div>
      </aside>

      {/* Main Content - Preview / Code */}
      <div className="flex-1 flex flex-col h-full bg-[#0F0F0F] relative overflow-hidden transition-all duration-300">
        
        {/* Top Navigation Bar */}
        <div className="h-14 flex items-center justify-between px-4 border-b border-white/5 bg-[#0A0A0A] shrink-0 z-10">
            <div className="flex items-center gap-4">
                {/* View Toggle */}
                <div className="flex bg-neutral-900 rounded-lg p-0.5 border border-white/5">
                    <button 
                        onClick={() => setActiveTab('preview')}
                        className={cn(
                            "flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium transition-all",
                            activeTab === 'preview' ? "bg-neutral-800 text-white shadow-sm" : "text-neutral-400 hover:text-white"
                        )}
                    >
                        <Eye size={12} />
                        Preview
                    </button>
                    <button 
                        onClick={() => setActiveTab('code')}
                        className={cn(
                            "flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium transition-all",
                            activeTab === 'code' ? "bg-neutral-800 text-white shadow-sm" : "text-neutral-400 hover:text-white"
                        )}
                    >
                        <Code size={12} />
                        Code
                    </button>
                </div>
            </div>

            {/* Address Bar Simulation */}
            <div className="flex-1 max-w-xl mx-4 hidden md:block">
                <div className="w-full bg-black border border-white/5 rounded-md px-3 py-1.5 text-xs text-neutral-500 flex items-center justify-center font-mono cursor-default opacity-50 hover:opacity-100 transition-opacity">
                    localhost:3000
                </div>
            </div>

            <div className="flex items-center gap-3">
                 <div className="hidden lg:flex items-center gap-1 bg-neutral-900 rounded-lg p-0.5 border border-white/5">
                    <button onClick={() => setDevice('desktop')} className={cn("p-1.5 rounded hover:bg-neutral-800 transition-colors", device === 'desktop' ? "bg-neutral-800 text-white" : "text-neutral-500")}>
                        <Monitor size={14} />
                    </button>
                    <button onClick={() => setDevice('tablet')} className={cn("p-1.5 rounded hover:bg-neutral-800 transition-colors", device === 'tablet' ? "bg-neutral-800 text-white" : "text-neutral-500")}>
                        <Tablet size={14} />
                    </button>
                    <button onClick={() => setDevice('mobile')} className={cn("p-1.5 rounded hover:bg-neutral-800 transition-colors", device === 'mobile' ? "bg-neutral-800 text-white" : "text-neutral-500")}>
                        <Smartphone size={14} />
                    </button>
                 </div>
                 <button className="p-2 text-neutral-400 hover:text-white transition-colors">
                    <Share size={18} />
                 </button>
                 <button className="px-3 py-1.5 bg-white text-black text-xs font-semibold rounded-md hover:bg-neutral-200 transition-colors shadow-[0_0_15px_-3px_rgba(255,255,255,0.3)]">
                    Deploy
                 </button>
            </div>
        </div>

        {/* Content Area */}
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
                device === 'tablet' ? "w-[768px] h-[1024px] rounded-[2rem] border-[8px] border-[#1a1a1a]" : 
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
                        className="w-full h-full border-0"
                        title="Preview"
                        srcDoc={`
                            <!DOCTYPE html>
                            <html>
                            <head>
                                <script src="https://cdn.tailwindcss.com"></script>
                                <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">
                                <style>
                                    body { font-family: 'Inter', sans-serif; }
                                    .glass { background: rgba(255, 255, 255, 0.05); backdrop-filter: blur(10px); }
                                </style>
                            </head>
                            <body class="bg-black text-white antialiased selection:bg-purple-500/30">
                                <div class="min-h-screen flex flex-col relative overflow-hidden">
                                    
                                    <!-- Background Gradients -->
                                    <div class="absolute top-0 left-0 w-full h-[500px] bg-purple-900/20 blur-[100px] pointer-events-none"></div>
                                    <div class="absolute bottom-0 right-0 w-full h-[500px] bg-blue-900/10 blur-[100px] pointer-events-none"></div>

                                    <!-- Navbar -->
                                    <nav class="relative z-50 border-b border-white/10">
                                        <div class="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
                                            <div class="text-xl font-bold tracking-tight">Acme<span class="text-purple-400">.ai</span></div>
                                            <div class="hidden md:flex items-center gap-8 text-sm font-medium text-gray-400">
                                                <a href="#" class="hover:text-white transition-colors">Product</a>
                                                <a href="#" class="hover:text-white transition-colors">Solutions</a>
                                                <a href="#" class="hover:text-white transition-colors">Pricing</a>
                                                <a href="#" class="hover:text-white transition-colors">Docs</a>
                                            </div>
                                            <div class="flex items-center gap-4">
                                                <a href="#" class="text-sm font-medium text-white hover:text-gray-300">Login</a>
                                                <a href="#" class="text-sm font-medium bg-white text-black px-4 py-2 rounded-lg hover:bg-gray-100 transition-colors">Start Free</a>
                                            </div>
                                        </div>
                                    </nav>

                                    <!-- Hero -->
                                    <main class="flex-1 relative z-10 flex flex-col items-center justify-center pt-20 pb-32 px-6 text-center">
                                        <div class="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-xs font-medium text-purple-300 mb-8 hover:bg-white/10 transition-colors cursor-pointer">
                                            <span class="w-1.5 h-1.5 rounded-full bg-purple-400 animate-pulse"></span>
                                            v2.0 is now live
                                        </div>
                                        
                                        <h1 class="text-5xl md:text-7xl font-bold tracking-tight mb-8 max-w-4xl bg-clip-text text-transparent bg-gradient-to-b from-white to-white/50">
                                            Scale your infrastructure <br/> without the headache.
                                        </h1>
                                        
                                        <p class="text-lg md:text-xl text-gray-400 max-w-2xl mb-12 leading-relaxed">
                                            Deploy, manage, and scale your applications with a single command. 
                                            Built for developers who want to ship faster.
                                        </p>
                                        
                                        <div class="flex flex-col sm:flex-row items-center gap-4">
                                            <button class="w-full sm:w-auto px-8 py-4 bg-white text-black rounded-xl font-semibold hover:bg-gray-200 transition-transform hover:scale-105 active:scale-95 duration-200">
                                                Start Building
                                            </button>
                                            <button class="w-full sm:w-auto px-8 py-4 bg-white/5 border border-white/10 text-white rounded-xl font-semibold hover:bg-white/10 transition-all flex items-center justify-center gap-2 group">
                                                <span>Read Documentation</span>
                                                <svg class="w-4 h-4 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path></svg>
                                            </button>
                                        </div>

                                        <!-- Metric Grid -->
                                        <div class="mt-24 grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-12 w-full max-w-5xl border-t border-white/10 pt-12">
                                            <div class="text-center">
                                                <div class="text-3xl font-bold text-white mb-1">99.9%</div>
                                                <div class="text-sm text-gray-500">Uptime</div>
                                            </div>
                                            <div class="text-center">
                                                <div class="text-3xl font-bold text-white mb-1">50ms</div>
                                                <div class="text-sm text-gray-500">Latency</div>
                                            </div>
                                            <div class="text-center">
                                                <div class="text-3xl font-bold text-white mb-1">10k+</div>
                                                <div class="text-sm text-gray-500">Developers</div>
                                            </div>
                                            <div class="text-center">
                                                <div class="text-3xl font-bold text-white mb-1">24/7</div>
                                                <div class="text-sm text-gray-500">Support</div>
                                            </div>
                                        </div>
                                    </main>
                                </div>
                            </body>
                            </html>
                        `}
                    />
                )}
            </div>
        </div>
      </div>
    </div>
  );
};