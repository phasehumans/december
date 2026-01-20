import React, { useState, useEffect } from 'react';
import { Navbar } from './components/Navbar';
import { Sidebar } from './components/Sidebar';
import { OutputScreen } from './components/OutputScreen';
import { AnimatePresence, motion } from 'framer-motion';
import { DitherBackground } from './components/ui/dither-background';
import { Logo } from './components/Logo';
import { 
    ArrowUp, 
    Plus, 
    Mic, 
    X,
    ArrowRight
} from 'lucide-react';
import { cn } from './lib/utils';

// View State Definition
type ViewState = 'home' | 'output';

// Google Icon Component
const GoogleIcon = () => (
  <svg viewBox="0 0 24 24" width="16" height="16" xmlns="http://www.w3.org/2000/svg">
    <g transform="matrix(1, 0, 0, 1, 27.009001, -39.238998)">
      <path fill="#4285F4" d="M -3.264 51.509 C -3.264 50.719 -3.334 49.969 -3.454 49.239 L -14.754 49.239 L -14.754 53.749 L -8.284 53.749 C -8.574 55.229 -9.424 56.479 -10.684 57.329 L -10.684 60.329 L -6.824 60.329 C -4.564 58.239 -3.264 55.159 -3.264 51.509 Z" />
      <path fill="#34A853" d="M -14.754 63.239 C -11.514 63.239 -8.804 62.159 -6.824 60.329 L -10.684 57.329 C -11.764 58.049 -13.134 58.489 -14.754 58.489 C -17.884 58.489 -20.534 56.379 -21.484 53.529 L -25.464 53.529 L -25.464 56.619 C -23.494 60.539 -19.464 63.239 -14.754 63.239 Z" />
      <path fill="#FBBC05" d="M -21.484 53.529 C -21.734 52.809 -21.864 52.039 -21.864 51.239 C -21.864 50.439 -21.724 49.669 -21.484 48.949 L -21.484 45.859 L -25.464 45.859 C -26.284 47.479 -26.754 49.299 -26.754 51.239 C -26.754 53.179 -26.284 54.999 -25.464 56.619 L -21.484 53.529 Z" />
      <path fill="#EA4335" d="M -14.754 43.989 C -12.984 43.989 -11.404 44.599 -10.154 45.799 L -6.744 42.389 C -8.804 40.469 -11.514 39.239 -14.754 39.239 C -19.464 39.239 -23.494 41.939 -25.464 45.859 L -21.484 48.949 C -20.534 46.099 -17.884 43.989 -14.754 43.989 Z" />
    </g>
  </svg>
);

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login');
  
  const [prompt, setPrompt] = useState("");
  
  const [view, setView] = useState<ViewState>('home');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(true);

  const handleOpenLogin = () => {
    setAuthMode('login');
    setIsAuthModalOpen(true);
  };

  const handleOpenSignup = () => {
    setAuthMode('signup');
    setIsAuthModalOpen(true);
  };

  const handleAuthSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Simulate auth delay
    setTimeout(() => {
        setIsAuthModalOpen(false);
        setIsAuthenticated(true);
    }, 800);
  };

  const handleGenerate = () => {
    if (!prompt) return;
    
    if (!isAuthenticated) {
        handleOpenSignup();
        return;
    }

    setIsGenerating(true);
    setView('output');
    
    // Simulate processing
    setTimeout(() => {
        setIsGenerating(false);
    }, 3500);
  };

  // Keyboard shortcut for generation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        handleGenerate();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [prompt]);

  return (
    <div className="min-h-screen bg-black text-white font-sans selection:bg-white/20 overflow-x-hidden relative">
      
      {/* Navbar - Only show when NOT authenticated and on home view */}
      {!isAuthenticated && view === 'home' && (
        <Navbar 
            isAuthenticated={isAuthenticated} 
            onLogin={handleOpenLogin}
            onSignup={handleOpenSignup}
        />
      )}

      {/* Sidebar (Only when signed in and on Home) */}
      {isAuthenticated && view === 'home' && (
        <Sidebar 
            onLogout={() => { setIsAuthenticated(false); setView('home'); }} 
            isCollapsed={isSidebarCollapsed}
            toggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
        />
      )}

      {/* Main Layout Area */}
      <main className={cn(
        "relative min-h-screen transition-all duration-300 ease-in-out flex flex-col z-10",
        isAuthenticated && view === 'home' ? (isSidebarCollapsed ? "pl-[70px]" : "pl-[260px]") : "pl-0"
      )}>
        
        <AnimatePresence mode="wait">
            {view === 'home' && (
                <motion.div 
                    key="home"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="flex-1 flex flex-col w-full"
                >
                    <DitherBackground />

                    {/* Centered Content Container */}
                    <div className={cn(
                        "flex-1 flex flex-col items-center justify-center px-4 relative z-20 w-full max-w-7xl mx-auto",
                        isAuthenticated ? "mt-4" : "mt-20"
                    )}>
                        
                        {/* Hero Text - Only show when NOT authenticated */}
                        {!isAuthenticated && (
                            <div className="text-center space-y-4 mb-10">
                                <h1 className="text-5xl md:text-7xl font-bold tracking-tight text-white drop-shadow-lg leading-tight">
                                    Build something <span className="text-neutral-500">Human</span>.
                                </h1>
                                <p className="text-xl text-neutral-400 font-light max-w-lg mx-auto">
                                    Create apps and websites by chatting with AI.
                                </p>
                            </div>
                        )}

                        {/* Lovable-style Prompt Box */}
                        <div className="w-full max-w-4xl bg-[#09090b] rounded-[32px] p-5 shadow-2xl border border-white/10 ring-1 ring-white/5 relative group transition-all focus-within:ring-white/20 focus-within:bg-[#0c0c0e]">
                            
                            <textarea 
                                value={prompt}
                                onChange={(e) => setPrompt(e.target.value)}
                                placeholder="Ask PhaseHumans to create a prototype..."
                                className="w-full bg-transparent text-white text-xl p-2 min-h-[60px] resize-none outline-none placeholder-neutral-600 font-light leading-relaxed"
                                spellCheck={false}
                            />

                            <div className="flex items-center justify-between mt-4">
                                {/* Left Action */}
                                <button className="p-2.5 rounded-full text-neutral-500 hover:text-white hover:bg-neutral-800 transition-colors border border-transparent hover:border-white/5">
                                    <Plus size={22} />
                                </button>

                                {/* Right Actions */}
                                <div className="flex items-center gap-2">
                                    <button className="p-2.5 rounded-full text-neutral-500 hover:text-white hover:bg-neutral-800 transition-colors">
                                        <Mic size={22} />
                                    </button>

                                    <button 
                                        onClick={handleGenerate}
                                        disabled={!prompt}
                                        className={cn(
                                            "p-2.5 rounded-full transition-all duration-300 transform ml-1",
                                            prompt 
                                                ? "bg-white text-black hover:scale-110 shadow-[0_0_20px_rgba(255,255,255,0.2)]" 
                                                : "bg-neutral-800 text-neutral-600 cursor-not-allowed"
                                        )}
                                    >
                                        <ArrowUp size={22} strokeWidth={2.5} />
                                    </button>
                                </div>
                            </div>
                        </div>

                    </div>
                </motion.div>
            )}

            {view === 'output' && (
                <motion.div 
                    key="output"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="fixed inset-0 z-50 bg-[#000000]"
                >
                    <div className="w-full h-full">
                        <OutputScreen 
                            onBack={() => setView('home')} 
                            isGenerating={isGenerating}
                        />
                    </div>
                </motion.div>
            )}
        </AnimatePresence>

      </main>

      {/* Auth Modal */}
      <AnimatePresence>
        {isAuthModalOpen && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                <motion.div 
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    className="absolute inset-0 bg-black/80 backdrop-blur-md"
                    onClick={() => setIsAuthModalOpen(false)}
                />
                <motion.div 
                    initial={{ opacity: 0, scale: 0.95, y: 20, filter: "blur(10px)" }} 
                    animate={{ opacity: 1, scale: 1, y: 0, filter: "blur(0px)" }} 
                    exit={{ opacity: 0, scale: 0.95, y: 20, filter: "blur(10px)" }}
                    transition={{ type: "spring", damping: 25, stiffness: 300 }}
                    className="relative w-full max-w-[380px] bg-[#0A0A0A] border border-white/10 rounded-3xl p-8 shadow-[0_0_40px_-10px_rgba(255,255,255,0.05)] overflow-hidden"
                >
                    {/* Ambient background light */}
                    <div className="absolute -top-20 -right-20 w-40 h-40 bg-white/5 rounded-full blur-3xl pointer-events-none" />
                    <div className="absolute -bottom-20 -left-20 w-40 h-40 bg-white/5 rounded-full blur-3xl pointer-events-none" />

                    <button 
                        onClick={() => setIsAuthModalOpen(false)}
                        className="absolute top-4 right-4 p-2 text-neutral-600 hover:text-white transition-colors rounded-full hover:bg-white/5"
                    >
                        <X size={16} />
                    </button>

                    <div className="flex flex-col items-center mb-8">
                        <div className="mb-6 scale-90">
                            <Logo />
                        </div>
                        <h2 className="text-xl font-medium text-white tracking-tight">
                            {authMode === 'login' ? 'Welcome back' : 'Create account'}
                        </h2>
                        <p className="text-xs text-neutral-500 font-mono mt-2 tracking-wide">
                            {authMode === 'login' 
                                ? 'AUTHENTICATE_USER_SESSION' 
                                : 'INITIALIZE_NEW_USER_ENTITY'}
                        </p>
                    </div>

                    <div className="space-y-4">
                        <button className="relative w-full h-10 flex items-center justify-center gap-3 bg-[#111] hover:bg-[#161616] border border-white/10 text-neutral-300 hover:text-white rounded-lg text-sm font-medium transition-all group overflow-hidden">
                            <GoogleIcon />
                            <span>Google</span>
                            <div className="absolute inset-0 bg-white/5 translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
                        </button>
                        
                        <div className="flex items-center gap-3 py-2">
                            <div className="h-px flex-1 bg-white/5" />
                            <span className="text-[10px] text-neutral-600 font-mono">OR</span>
                            <div className="h-px flex-1 bg-white/5" />
                        </div>

                        <form onSubmit={handleAuthSubmit} className="space-y-3">
                            <div className="space-y-1">
                                <label className="text-[10px] uppercase tracking-wider text-neutral-500 font-mono ml-1">Email</label>
                                <input 
                                    type="email" 
                                    className="w-full bg-[#050505] border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-neutral-700 focus:outline-none focus:border-white/30 focus:ring-1 focus:ring-white/20 transition-all font-sans"
                                    placeholder="user@example.com"
                                />
                            </div>
                            
                            <div className="space-y-1">
                                <label className="text-[10px] uppercase tracking-wider text-neutral-500 font-mono ml-1">Password</label>
                                <input 
                                    type="password" 
                                    className="w-full bg-[#050505] border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-neutral-700 focus:outline-none focus:border-white/30 focus:ring-1 focus:ring-white/20 transition-all font-sans"
                                    placeholder="••••••••"
                                />
                            </div>

                            <button 
                                type="submit"
                                className="w-full h-10 mt-2 bg-white text-black rounded-lg text-sm font-semibold hover:bg-neutral-200 transition-all flex items-center justify-center gap-2 group shadow-[0_0_20px_-5px_rgba(255,255,255,0.3)]"
                            >
                                <span>{authMode === 'login' ? 'Enter Phase' : 'Join Phase'}</span>
                                <ArrowRight size={14} className="transition-transform group-hover:translate-x-0.5" />
                            </button>
                        </form>
                    </div>

                    <div className="mt-8 pt-4 border-t border-white/5 text-center">
                        <p className="text-xs text-neutral-500">
                            {authMode === 'login' ? "No identifier found? " : "Identifier exists? "}
                            <button 
                                onClick={() => setAuthMode(authMode === 'login' ? 'signup' : 'login')}
                                className="text-white hover:underline decoration-white/30 underline-offset-4 transition-all ml-1"
                            >
                                {authMode === 'login' ? 'Initialize' : 'Authenticate'}
                            </button>
                        </p>
                    </div>
                </motion.div>
            </div>
        )}
      </AnimatePresence>

    </div>
  );
}

export default App;