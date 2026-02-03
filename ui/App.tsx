import React, { useState, useEffect } from 'react';
import { Navbar } from './components/Navbar';
import { Sidebar } from './components/Sidebar';
import { OutputScreen } from './components/OutputScreen';
import { DocsPage } from './components/DocsPage';
import { HistoryModal } from './components/HistoryModal';
import { SettingsModal } from './components/SettingsModal';
import { ContextCanvas } from './components/ContextCanvas';
import { AnimatePresence, motion } from 'framer-motion';
import { DitherBackground } from './components/ui/dither-background';
import { Logo } from './components/Logo';
import { CanvasItem } from './types';
import { 
    ArrowUp, 
    Plus, 
    Mic, 
    X, 
    ArrowRight, 
    ChevronDown
} from 'lucide-react';
import { cn } from './lib/utils';

// View State Definition - History and Settings are now modals, not views
type ViewState = 'home' | 'output' | 'docs';

// Google Icon Component
const GoogleIcon = () => (
  <svg viewBox="0 0 24 24" width="16" height="16" xmlns="http://www.w3.org/2000/svg">
    <g transform="matrix(1, 0, 0, 1, 27.009001, -39.238998)">
      <path fill="#4285F4" d="M -3.264 51.509 C -3.264 50.719 -3.334 49.969 -3.454 49.239 L -14.754 49.239 L -14.754 53.749 L -8.284 53.749 C -8.574 55.229 -9.424 56.479 -10.684 57.329 L -10.684 60.329 L -6.824 60.329 C -4.564 58.239 -3.264 55.159 -3.264 51.509 Z" />
      <path fill="#34A853" d="M -14.754 63.239 C -11.514 63.239 -8.804 62.159 -6.824 60.329 L -10.684 57.329 C -11.764 58.049 -13.134 58.489 -14.754 58.489 C -17.884 58.489 -20.534 56.379 -21.484 53.529 L -25.464 53.529 L -25.464 56.619 C -23.494 60.539 -19.464 63.239 -14.754 63.239 Z" />
      <path fill="#FBBC05" d="M -21.484 53.529 C -21.734 52.809 -21.864 52.039 -21.864 51.239 C -21.864 50.439 -21.724 49.669 -21.484 48.949 L -21.484 45.859 L -21.484 45.859 C -26.284 47.479 -26.754 49.299 -26.754 51.239 C -26.754 53.179 -26.284 54.999 -25.464 56.619 L -21.484 53.529 Z" />
      <path fill="#EA4335" d="M -14.754 43.989 C -12.984 43.989 -11.404 44.599 -10.154 45.799 L -6.744 42.389 C -8.804 40.469 -11.514 39.239 -14.754 39.239 C -19.464 39.239 -23.494 41.939 -25.464 45.859 L -21.484 48.949 C -20.534 46.099 -17.884 43.989 -14.754 43.989 Z" />
    </g>
  </svg>
);

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login');
  
  const [prompt, setPrompt] = useState("");
  const [placeholderText, setPlaceholderText] = useState("Ask PhaseHumans to ");
  
  const [view, setView] = useState<ViewState>('home');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(true);

  // Modals State
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Canvas State
  const [canvasItems, setCanvasItems] = useState<CanvasItem[]>([]);

  // Typewriter Effect for Placeholder
  useEffect(() => {
    const prefix = "Ask PhaseHumans to ";
    const suffixes = [
      "create a prototype...",
      "create a landing page for my SaaS...",
      "build a dashboard for analytics...",
      "design a portfolio for a photographer...",
      "create a webapp that tracks expenses..."
    ];
    
    let currentPhraseIndex = 0;
    let currentCharIndex = 0;
    let isDeleting = false;
    let timeoutId: ReturnType<typeof setTimeout>;

    const type = () => {
      const currentSuffix = suffixes[currentPhraseIndex];
      
      if (isDeleting) {
        currentCharIndex--;
      } else {
        currentCharIndex++;
      }

      setPlaceholderText(prefix + currentSuffix.substring(0, currentCharIndex));

      let typeSpeed = isDeleting ? 30 : 50;

      if (!isDeleting && currentCharIndex === currentSuffix.length) {
        typeSpeed = 3000; // Pause at end of sentence
        isDeleting = true;
      } else if (isDeleting && currentCharIndex === 0) {
        isDeleting = false;
        currentPhraseIndex = (currentPhraseIndex + 1) % suffixes.length;
        typeSpeed = 500; // Pause before new sentence
      }

      timeoutId = setTimeout(type, typeSpeed);
    };

    timeoutId = setTimeout(type, 100);

    return () => clearTimeout(timeoutId);
  }, []);

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

  const handleGoogleAuth = () => {
      // Simulate Google Auth
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

  const handleNewProject = () => {
      setPrompt("");
      setView('home');
      setIsGenerating(false);
      setCanvasItems([]);
  };

  const handleNavigate = (action: string) => {
      switch (action) {
          case 'home':
              setView('home');
              break;
          case 'history':
              setIsHistoryOpen(true);
              break;
          case 'settings':
              setIsSettingsOpen(true);
              break;
          case 'docs':
              setView('docs');
              break;
          default:
              break;
      }
  };

  const handleLogout = () => {
      setIsAuthenticated(false);
      setIsSettingsOpen(false);
      setView('home');
      setPrompt("");
      setCanvasItems([]);
  };

  const handleAddCanvasItem = (item: CanvasItem) => {
      setCanvasItems(prev => [...prev, item]);
  };

  const handleRemoveCanvasItem = (id: string) => {
      setCanvasItems(prev => prev.filter(item => item.id !== id));
  };

  // Keyboard shortcut for generation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        if (view === 'home' && prompt && !isAuthModalOpen && !isHistoryOpen && !isSettingsOpen) {
            handleGenerate();
        }
      }
      // Shortcuts for modals
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
          e.preventDefault();
          if (isAuthenticated) setIsHistoryOpen(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [prompt, view, isAuthModalOpen, isHistoryOpen, isSettingsOpen, isAuthenticated]);

  return (
    <div className="min-h-screen bg-black text-white font-sans selection:bg-white/20 overflow-x-hidden relative flex flex-col">
      
      {/* Navbar - Only show when NOT authenticated and on home view */}
      {!isAuthenticated && view === 'home' && (
        <Navbar 
            isAuthenticated={isAuthenticated} 
            onLogin={handleOpenLogin}
            onSignup={handleOpenSignup}
        />
      )}

      {/* Sidebar (Only when signed in and not on output screen) */}
      {isAuthenticated && view !== 'output' && (
        <Sidebar 
            onLogout={handleLogout} 
            isCollapsed={isSidebarCollapsed}
            toggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
            currentView={view}
            onNavigate={(viewName) => handleNavigate(viewName)}
            onNewProject={handleNewProject}
        />
      )}

      {/* Main Layout Area */}
      <main className={cn(
        "relative flex-1 transition-all duration-300 ease-in-out flex flex-col z-10",
        isAuthenticated && view !== 'output' ? (isSidebarCollapsed ? "pl-[70px]" : "pl-[260px]") : "pl-0"
      )}>
        
        <AnimatePresence mode="wait">
            {view === 'home' && (
                <motion.div 
                    key="home"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="flex-1 flex flex-col w-full relative z-20"
                >
                    {/* Fixed Background */}
                    <div className="fixed inset-0 z-0">
                         <DitherBackground />
                    </div>
                    
                    {/* Scrollable Content Container */}
                    <div className="relative z-10 w-full min-h-screen flex flex-col">
                        
                        {/* Hero / Prompt Section - Always Full Screen Height */}
                        <div className="relative w-full min-h-screen flex flex-col items-center justify-center px-4">
                            
                            <div className="w-full max-w-7xl mx-auto flex flex-col items-center justify-center">
                                {/* Hero Text */}
                                <div className="text-center space-y-3 mb-8">
                                    <h1 className="text-3xl md:text-5xl font-display font-bold tracking-tight text-white drop-shadow-lg leading-tight">
                                        What should we <span className="text-neutral-500">build</span> together?
                                    </h1>
                                    <p className="text-base md:text-lg text-neutral-400 font-light max-w-lg mx-auto">
                                        Your ideas and context, built together.
                                    </p>
                                </div>

                                {/* Lovable-style Prompt Box */}
                                <div className="w-full max-w-[52rem] bg-[#09090b] rounded-[28px] p-3 shadow-2xl border border-white/10 ring-1 ring-white/5 relative group transition-all focus-within:ring-white/20 focus-within:bg-[#0c0c0e]">
                                    
                                    <textarea 
                                        value={prompt}
                                        onChange={(e) => setPrompt(e.target.value)}
                                        placeholder={placeholderText}
                                        className="w-full bg-transparent text-white text-lg p-2 min-h-[40px] resize-none outline-none placeholder-neutral-600 font-light leading-relaxed"
                                        spellCheck={false}
                                    />

                                    <div className="flex items-center justify-between mt-1">
                                        {/* Left Action */}
                                        <button className="p-2 rounded-full text-neutral-500 hover:text-white hover:bg-neutral-800 transition-colors border border-transparent hover:border-white/5 outline-none focus-visible:ring-2 focus-visible:ring-white/20">
                                            <Plus size={20} />
                                        </button>

                                        {/* Right Actions */}
                                        <div className="flex items-center gap-2">
                                            <button className="p-2 rounded-full text-neutral-500 hover:text-white hover:bg-neutral-800 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-white/20">
                                                <Mic size={20} />
                                            </button>

                                            <button 
                                                onClick={handleGenerate}
                                                disabled={!prompt}
                                                className={cn(
                                                    "inline-flex items-center justify-center rounded-full text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/20 disabled:pointer-events-none disabled:opacity-50 ml-1 h-9 w-9",
                                                    prompt 
                                                        ? "bg-white text-black hover:bg-neutral-200 shadow-lg shadow-white/10" 
                                                        : "bg-neutral-800 text-neutral-500"
                                                )}
                                            >
                                                <ArrowUp size={16} strokeWidth={2.5} />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Context Canvas Section - Only if Authenticated */}
                        {isAuthenticated && (
                            <div id="context-canvas-section" className="w-full pb-2 px-2 pt-0 border-t border-white/5 bg-black relative z-10">
                                <div className="w-full max-w-full mx-auto mt-2">
                                    <ContextCanvas 
                                        items={canvasItems} 
                                        onAddItem={handleAddCanvasItem} 
                                        onRemoveItem={handleRemoveCanvasItem}
                                    />
                                </div>
                            </div>
                        )}

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

            {view === 'docs' && (
                <motion.div 
                    key="docs"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="flex-1 w-full bg-[#050505] relative z-20"
                >
                     <DocsPage />
                </motion.div>
            )}
        </AnimatePresence>

      </main>

      {/* Modals */}
      <HistoryModal isOpen={isHistoryOpen} onClose={() => setIsHistoryOpen(false)} />
      <SettingsModal 
          isOpen={isSettingsOpen} 
          onClose={() => setIsSettingsOpen(false)} 
          onLogout={handleLogout}
      />

      {/* Auth Modal */}
      <AnimatePresence>
        {isAuthModalOpen && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                <motion.div 
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    className="absolute inset-0 bg-black/60 backdrop-blur-md"
                    onClick={() => setIsAuthModalOpen(false)}
                />
                <motion.div 
                    initial={{ opacity: 0, scale: 0.9, y: 20, filter: "blur(10px)" }} 
                    animate={{ opacity: 1, scale: 1, y: 0, filter: "blur(0px)" }} 
                    exit={{ opacity: 0, scale: 0.9, y: 20, filter: "blur(10px)" }}
                    transition={{ type: "spring", damping: 25, stiffness: 300 }}
                    className="relative w-full max-w-[400px] bg-[#09090b] border border-white/10 rounded-[32px] p-8 shadow-2xl overflow-hidden ring-1 ring-white/5"
                >
                    {/* Decorative Gradient Blob */}
                    <div className="absolute -top-20 -right-20 w-40 h-40 bg-white/5 rounded-full blur-[50px] pointer-events-none" />
                    
                    <button 
                        onClick={() => setIsAuthModalOpen(false)}
                        className="absolute top-6 right-6 p-2 text-neutral-500 hover:text-white transition-colors rounded-full hover:bg-white/5"
                    >
                        <X size={16} />
                    </button>

                    <div className="flex flex-col items-center mb-8">
                        <div className="mb-5 scale-90">
                            <Logo />
                        </div>
                        <h2 className="text-xl font-semibold text-white tracking-tight">
                            {authMode === 'login' ? 'Welcome back' : 'Create account'}
                        </h2>
                        <p className="text-xs text-neutral-500 font-medium mt-1.5">
                            {authMode === 'login' 
                                ? 'Enter your details to access your workspace.' 
                                : 'Start building your ideas in seconds.'}
                        </p>
                    </div>

                    <div className="space-y-4">
                        <button 
                            onClick={handleGoogleAuth}
                            className="relative w-full h-11 flex items-center justify-center gap-2 bg-neutral-900 hover:bg-neutral-800 border border-white/5 text-white rounded-2xl text-sm font-medium transition-all group overflow-hidden shadow-sm"
                        >
                            <GoogleIcon />
                            <span>Continue with Google</span>
                        </button>
                        
                        <div className="flex items-center gap-3 py-2">
                            <div className="h-px flex-1 bg-gradient-to-r from-transparent via-white/10 to-transparent" />
                            <span className="text-[10px] text-neutral-600 font-mono uppercase tracking-wider">Or</span>
                            <div className="h-px flex-1 bg-gradient-to-r from-transparent via-white/10 to-transparent" />
                        </div>

                        <form onSubmit={handleAuthSubmit} className="space-y-3">
                            <div className="space-y-1.5">
                                <label className="text-[11px] font-medium text-neutral-400 ml-1">Email</label>
                                <input 
                                    type="email" 
                                    className="w-full bg-[#121214] border border-white/5 rounded-2xl px-4 py-3 text-sm text-white placeholder-neutral-600 focus:outline-none focus:border-white/20 focus:bg-[#18181b] focus:ring-1 focus:ring-white/10 transition-all font-sans"
                                    placeholder="name@example.com"
                                />
                            </div>
                            
                            <div className="space-y-1.5">
                                <label className="text-[11px] font-medium text-neutral-400 ml-1">Password</label>
                                <input 
                                    type="password" 
                                    className="w-full bg-[#121214] border border-white/5 rounded-2xl px-4 py-3 text-sm text-white placeholder-neutral-600 focus:outline-none focus:border-white/20 focus:bg-[#18181b] focus:ring-1 focus:ring-white/10 transition-all font-sans"
                                    placeholder="••••••••"
                                />
                            </div>

                            <button 
                                type="submit"
                                className="w-full h-11 mt-2 bg-white text-black hover:bg-neutral-200 rounded-2xl text-sm font-bold transition-all flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(255,255,255,0.1)] hover:shadow-[0_0_25px_rgba(255,255,255,0.2)] hover:scale-[1.02] active:scale-[0.98]"
                            >
                                <span>{authMode === 'login' ? 'Sign In' : 'Sign Up'}</span>
                                <ArrowRight size={16} />
                            </button>
                        </form>
                    </div>

                    <div className="mt-8 text-center">
                        <p className="text-xs text-neutral-500">
                            {authMode === 'login' ? "Don't have an account? " : "Already have an account? "}
                            <button 
                                onClick={() => setAuthMode(authMode === 'login' ? 'signup' : 'login')}
                                className="text-white hover:text-neutral-300 font-medium transition-colors ml-0.5"
                            >
                                {authMode === 'login' ? 'Sign up' : 'Log in'}
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